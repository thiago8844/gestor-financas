<?php

namespace App\Actions\Faturas;

use App\Enums\TipoTransferencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Models\Transferencia;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class LancarNaFatura
{
    /**
     * Lança uma despesa ou um crédito (estorno, ajuste) direto numa fatura específica, sem passar
     * pela regra de fechamento do cartão — é o "ajustar a fatura" da auditoria/conciliação.
     *
     * - Fatura em aberto: nasce pendente e é baixada junto com o pagamento da fatura.
     * - Fatura paga: nasce paga na data do (último) pagamento — a fatura não volta a ficar
     *   "pendente" por causa do ajuste e o saldo da conta já reflete o valor.
     * - Fatura paga PARCIALMENTE (com saldo levado para a próxima ainda não pago): o ajuste muda o
     *   que foi para a próxima fatura, não o que saiu da conta — é o que o banco faz (o que você
     *   pagou não muda; juros/IOF a mais vão para o saldo restante). Use `destino = pagamento` para
     *   forçar o ajuste na baixa (a conciliação faz isso quando o débito do banco é que difere).
     *
     * `data_pagamento` escolhe em qual baixa o ajuste entra, quando a fatura foi paga em mais de uma vez.
     *
     * @param array{type: string, amount: float|string, description: string, category_id?: ?int,
     *              budget_id?: ?int, purchase_date?: ?string, data_pagamento?: ?string,
     *              destino?: 'auto'|'pagamento'} $dados
     */
    public static function executar(Fatura $fatura, array $dados): Transacao
    {
        $fatura->loadMissing(['cartao', 'parcelas']);

        $resumo = $fatura->resumoValores();
        $dataPagamento = $dados['data_pagamento'] ?? $fatura->dataUltimoPagamento();
        $jaPaga = $resumo['paga'] && $dataPagamento !== null;

        $contaId = $fatura->parcelas->first()?->account_id ?? $fatura->cartao->account_id;
        $dataCompra = !empty($dados['purchase_date'])
            ? Carbon::parse($dados['purchase_date'])->toDateString()
            : ($dataPagamento ?? now()->toDateString());

        $tipo = TransactionType::from($dados['type']);
        $valor = round((float) $dados['amount'], 2);

        return DB::transaction(function () use ($fatura, $dados, $jaPaga, $dataPagamento, $contaId, $dataCompra, $tipo, $valor) {
            $lancamento = Transacao::create([
                'user_id' => $fatura->user_id,
                'account_id' => $contaId,
                'card_id' => $fatura->card_id,
                'invoice_id' => $fatura->id,
                'category_id' => $dados['category_id'] ?? null,
                // O cálculo do orçamento soma valores sem olhar o tipo: crédito não pode entrar nele.
                'budget_id' => $tipo === TransactionType::INCOME ? null : ($dados['budget_id'] ?? null),
                'type' => $tipo,
                'description' => $dados['description'],
                'amount' => $valor,
                'purchase_date' => $dataCompra,
                'due_date' => $fatura->due_date,
                'status' => $jaPaga ? TransactionStatus::PAID : TransactionStatus::PENDING,
                'date' => $jaPaga ? $dataPagamento : null,
            ]);

            if ($jaPaga && ($dados['destino'] ?? 'auto') === 'auto') {
                self::ajustarSaldoLevado($fatura, $tipo === TransactionType::INCOME ? -$valor : $valor);
            }

            return $lancamento;
        });
    }

    /**
     * Fatura paga parcialmente: soma (ou abate) o ajuste no saldo levado para a próxima fatura,
     * nos dois lados da rolagem, para o que saiu da conta continuar igual. Só se o saldo ainda
     * não foi pago na fatura seguinte e se não ficar negativo; senão o ajuste fica na baixa.
     */
    private static function ajustarSaldoLevado(Fatura $fatura, float $delta): void
    {
        $rolagem = Transferencia::where('source_invoice_id', $fatura->id)
            ->where('kind', TipoTransferencia::FATURA->value)
            ->with('transacoes')
            ->latest('id')
            ->first();

        if (!$rolagem) {
            return;
        }

        $debitoNaProxima = $rolagem->transacoes->firstWhere('type', TransactionType::EXPENSE);
        $novoValor = round((float) $rolagem->amount + $delta, 2);

        if (!$debitoNaProxima || $debitoNaProxima->status !== TransactionStatus::PENDING || $novoValor < 0.01) {
            return;
        }

        $rolagem->update(['amount' => $novoValor]);
        Transacao::where('transfer_id', $rolagem->id)->update(['amount' => $novoValor]);
    }
}
