<?php

namespace App\Actions\Conciliacao;

use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Actions\Faturas\Exceptions\OperacaoFaturaException;
use App\Actions\Faturas\LancarNaFatura;
use App\Actions\Faturas\PagarFatura;
use App\Enums\OrigemItemConciliacao;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\ConciliacaoItem;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Queries\Conciliacao\RazaoContaQuery;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * "Esta linha do extrato é o pagamento da fatura X." Faz a fatura do app bater com o débito do banco
 * e concilia — é aqui que a peculiaridade do app (compras individuais, não uma despesa gigante) se
 * resolve:
 *
 *  - fatura ainda em aberto no app:
 *      débito = pendente  → paga a fatura na data do banco;
 *      débito < pendente  → pagamento parcial: paga e leva o restante para a próxima fatura;
 *      débito > pendente  → falta lançamento na fatura: lança a diferença (ajuste) e paga;
 *  - fatura já paga no app:
 *      escolhe a baixa mais próxima da data do banco; se o valor difere, lança o ajuste (despesa
 *      ou crédito) nessa baixa; se a data difere, move a baixa para a data do banco.
 *
 * O ajuste é um lançamento normal na fatura, visível e editável — e fica sinalizado pela auditoria.
 */
class ResolverPagamentoFaturaConciliacao
{
    /**
     * @param array{ajuste_descricao?: ?string, category_id?: ?int} $opcoes
     * @return array{acao: string, ajuste: float, levado: float}
     */
    public static function executar(ConciliacaoItem $item, Fatura $fatura, array $opcoes = []): array
    {
        $conciliacao = $item->conciliacao;

        VinculoConciliacao::exigirAberta($conciliacao);
        VinculoConciliacao::exigirLinhaEmAberto($item);

        if ($item->source !== OrigemItemConciliacao::EXTRATO || $item->type !== TransactionType::EXPENSE) {
            throw new ConciliacaoException('Só uma saída do extrato pode ser o pagamento de uma fatura.');
        }

        $fatura->loadMissing(['cartao', 'parcelas']);

        if ($fatura->user_id !== $conciliacao->user_id) {
            throw new ConciliacaoException('Fatura não encontrada.', 404);
        }

        $contaDaFatura = $fatura->parcelas->first()?->account_id ?? $fatura->cartao?->account_id;

        if ((int) $contaDaFatura !== (int) $conciliacao->account_id) {
            throw new ConciliacaoException('Essa fatura é paga por outra conta, não pela conta desta conciliação.');
        }

        $valor = round((float) $item->amount, 2);
        $dataBanco = $item->transaction_date->copy()->startOfDay();

        try {
            return DB::transaction(function () use ($item, $fatura, $opcoes, $valor, $dataBanco) {
                $resumo = $fatura->resumoValores();
                $resultado = !$resumo['paga']
                    ? self::pagar($fatura, $resumo['pendente'], $valor, $dataBanco, $opcoes)
                    : self::ajustarPagamentoExistente($item, $fatura, $valor, $dataBanco, $opcoes);

                $chave = "f:{$fatura->id}:{$resultado['data']}";
                $transacoes = RazaoContaQuery::transacoesDaChave($chave, $item->user_id, $item->conciliacao->account_id);

                if ($transacoes->isEmpty() || abs(RazaoContaQuery::efeitoNoSaldo($transacoes) - $item->valorNoSaldo()) >= 0.005) {
                    throw new ConciliacaoException(
                        'Depois do ajuste, o pagamento da fatura ainda não bate com o extrato. Confira a fatura na tela de Cartões.'
                    );
                }

                VinculoConciliacao::vincular($item, $transacoes, 'MANUAL', $fatura->id);

                unset($resultado['data']);

                return $resultado;
            });
        } catch (OperacaoFaturaException $e) {
            throw new ConciliacaoException($e->getMessage());
        }
    }

    /** @return array{acao: string, ajuste: float, levado: float, data: string} */
    private static function pagar(Fatura $fatura, float $pendente, float $valor, Carbon $dataBanco, array $opcoes): array
    {
        $ajuste = 0.0;

        if ($valor - $pendente >= 0.005) {
            $ajuste = round($valor - $pendente, 2);

            LancarNaFatura::executar($fatura, [
                'type' => TransactionType::EXPENSE->value,
                'amount' => $ajuste,
                'description' => self::descricaoAjuste($opcoes, 'faltava na fatura do app'),
                'category_id' => $opcoes['category_id'] ?? null,
                'purchase_date' => $dataBanco->toDateString(),
            ]);

            $levado = PagarFatura::executar($fatura->fresh(), $dataBanco);

            return ['acao' => 'AJUSTADA_E_PAGA', 'ajuste' => $ajuste, 'levado' => $levado, 'data' => $dataBanco->toDateString()];
        }

        $parcial = $pendente - $valor >= 0.005;
        $levado = PagarFatura::executar($fatura, $dataBanco, $parcial ? $valor : null);

        return [
            'acao' => $parcial ? 'PAGA_PARCIAL' : 'PAGA',
            'ajuste' => 0.0,
            'levado' => $levado,
            'data' => $dataBanco->toDateString(),
        ];
    }

    /** @return array{acao: string, ajuste: float, levado: float, data: string} */
    private static function ajustarPagamentoExistente(ConciliacaoItem $item, Fatura $fatura, float $valor, Carbon $dataBanco, array $opcoes): array
    {
        // Só baixas ainda não conciliadas com outra linha.
        $livres = $fatura->parcelas
            ->where('status', TransactionStatus::PAID)
            ->filter(fn (Transacao $t) => $t->date !== null && $t->reconciliation_item_id === null && (int) $t->account_id === (int) $item->conciliacao->account_id);

        if ($livres->isEmpty()) {
            throw new ConciliacaoException('Essa fatura não tem pagamento livre para conciliar (já foi conciliado com outra linha?).');
        }

        $datas = $livres->map(fn (Transacao $t) => $t->date->toDateString())->unique();
        $dataPagamento = $datas->sortBy(fn (string $d) => [abs(Carbon::parse($d)->diffInDays($dataBanco, false)), $d])->first();

        $grupo = $livres->filter(fn (Transacao $t) => $t->date->toDateString() === $dataPagamento);
        $pagoNoApp = -RazaoContaQuery::efeitoNoSaldo($grupo);
        $diferenca = round($valor - $pagoNoApp, 2);

        if (abs($diferenca) >= 0.005) {
            LancarNaFatura::executar($fatura, [
                'type' => $diferenca > 0 ? TransactionType::EXPENSE->value : TransactionType::INCOME->value,
                'amount' => abs($diferenca),
                'description' => self::descricaoAjuste($opcoes, $diferenca > 0 ? 'faltava na fatura do app' : 'sobrava na fatura do app'),
                'category_id' => $opcoes['category_id'] ?? null,
                'purchase_date' => $dataBanco->toDateString(),
                'data_pagamento' => $dataPagamento,
                // Aqui quem difere é o débito do banco: o ajuste tem que entrar na baixa, não no saldo levado.
                'destino' => 'pagamento',
            ]);
        }

        if ($dataPagamento !== $dataBanco->toDateString()) {
            Transacao::where('invoice_id', $fatura->id)
                ->where('status', TransactionStatus::PAID)
                ->whereNull('reconciliation_item_id')
                ->whereDate('date', $dataPagamento)
                ->update(['date' => $dataBanco->toDateString()]);
        }

        return [
            'acao' => abs($diferenca) >= 0.005 ? 'AJUSTADA' : 'VINCULADA',
            'ajuste' => $diferenca,
            'levado' => 0.0,
            'data' => $dataBanco->toDateString(),
        ];
    }

    private static function descricaoAjuste(array $opcoes, string $motivo): string
    {
        $descricao = trim((string) ($opcoes['ajuste_descricao'] ?? ''));

        return $descricao !== '' ? $descricao : "Ajuste da conciliação ({$motivo})";
    }
}
