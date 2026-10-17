<?php

namespace App\Actions\Conciliacao;

use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Actions\Transferencias\SalvarTransferencia;
use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Conta;
use App\Models\Transacao;
use App\Models\Transferencia;
use App\Queries\Conciliacao\RazaoContaQuery;
use Illuminate\Support\Facades\DB;

/**
 * As decisões sobre uma linha do extrato: vincular a um lançamento, lançar agora, adiar, ignorar
 * e desfazer. (Pagamento de fatura tem ação própria: ResolverPagamentoFaturaConciliacao.)
 */
class ResolverItemConciliacao
{
    /**
     * Vincula manualmente a linha a um lançamento (ou pagamento de fatura) do app.
     * Valor diferente só passa com `$ajustarValor` (corrige o lançamento para o valor do banco);
     * `$ajustarData` move a data do lançamento para a do extrato.
     */
    public static function vincular(ConciliacaoItem $item, string $chave, bool $ajustarValor = false, bool $ajustarData = false): void
    {
        $conciliacao = $item->conciliacao;
        self::exigirLinhaDoExtrato($conciliacao, $item);

        DB::transaction(function () use ($conciliacao, $item, $chave, $ajustarValor, $ajustarData) {
            $transacoes = RazaoContaQuery::transacoesDaChave($chave, $conciliacao->user_id, $conciliacao->account_id);

            if ($transacoes->isEmpty()) {
                throw new ConciliacaoException('Lançamento não encontrado ou já conciliado com outra linha.');
            }

            $efeito = RazaoContaQuery::efeitoNoSaldo($transacoes);

            if (($efeito >= 0) !== ($item->type === TransactionType::INCOME)) {
                throw new ConciliacaoException(
                    $item->type === TransactionType::INCOME
                        ? 'A linha do extrato é uma entrada e o lançamento escolhido é uma saída.'
                        : 'A linha do extrato é uma saída e o lançamento escolhido é uma entrada.'
                );
            }

            $diferenca = round(abs($item->valorNoSaldo()) - abs($efeito), 2);

            if (abs($diferenca) >= 0.005) {
                if (!$ajustarValor) {
                    throw new ConciliacaoException(
                        'Os valores não batem: extrato R$ ' . self::moeda((float) $item->amount)
                        . ', app R$ ' . self::moeda(abs($efeito)) . '.',
                        422,
                        ['diferenca' => $diferenca]
                    );
                }

                if ($transacoes->count() !== 1 || RazaoContaQuery::faturaDaChave($chave) !== null) {
                    throw new ConciliacaoException('Pagamento de fatura com diferença se resolve pelo "É pagamento de fatura", que ajusta a fatura.');
                }

                $transacoes->first()->update(['amount' => $item->amount]);
            }

            if ($ajustarData) {
                Transacao::whereIn('id', $transacoes->pluck('id'))->update(['date' => $item->transaction_date->toDateString()]);
            }

            VinculoConciliacao::vincular($item, $transacoes->fresh(), 'MANUAL', RazaoContaQuery::faturaDaChave($chave));
        });
    }

    /**
     * Lança agora, no app, o que só estava no extrato (já pago, na data e valor do banco) e concilia.
     *
     * @param array{description?: ?string, category_id?: ?int, budget_id?: ?int} $dados
     */
    public static function lancar(ConciliacaoItem $item, array $dados): Transacao
    {
        $conciliacao = $item->conciliacao;
        self::exigirLinhaDoExtrato($conciliacao, $item);

        return DB::transaction(function () use ($conciliacao, $item, $dados) {
            $fitidLivre = $item->fitid
                && !Transacao::where('account_id', $conciliacao->account_id)->where('fitid', $item->fitid)->exists();

            $transacao = Transacao::create([
                'user_id' => $conciliacao->user_id,
                'account_id' => $conciliacao->account_id,
                'category_id' => $dados['category_id'] ?? null,
                // O cálculo do orçamento soma valores sem olhar o tipo: só despesa entra nele.
                'budget_id' => $item->type === TransactionType::EXPENSE ? ($dados['budget_id'] ?? null) : null,
                'type' => $item->type,
                'description' => trim((string) ($dados['description'] ?? '')) ?: $item->description,
                'amount' => $item->amount,
                'status' => TransactionStatus::PAID,
                'date' => $item->transaction_date->toDateString(),
                'due_date' => $item->transaction_date->toDateString(),
                'fitid' => $fitidLivre ? $item->fitid : null,
            ]);

            VinculoConciliacao::vincular($item, collect([$transacao]), 'MANUAL');

            return $transacao;
        });
    }

    /**
     * A linha é uma transferência entre contas do próprio usuário que ainda não está no app: cria a
     * transferência (a mesma da tela de Transferências: saída numa conta, entrada na outra, fora dos
     * relatórios de receita/despesa) e concilia o lado desta conta. O outro lado casa sozinho na
     * conciliação da outra conta, pelo mesmo valor e data.
     */
    public static function transferir(ConciliacaoItem $item, int $outraContaId, ?string $descricao = null): Transferencia
    {
        $conciliacao = $item->conciliacao;
        self::exigirLinhaDoExtrato($conciliacao, $item);

        if ($outraContaId === (int) $conciliacao->account_id) {
            throw new ConciliacaoException('Escolha a outra conta da transferência, não a desta conciliação.');
        }

        if (!Conta::where('user_id', $conciliacao->user_id)->whereKey($outraContaId)->exists()) {
            throw new ConciliacaoException('Conta não encontrada.', 404);
        }

        return DB::transaction(function () use ($conciliacao, $item, $outraContaId, $descricao) {
            $saida = $item->type === TransactionType::EXPENSE;

            $transferencia = SalvarTransferencia::executar($conciliacao->user_id, [
                'from_account_id' => $saida ? $conciliacao->account_id : $outraContaId,
                'to_account_id' => $saida ? $outraContaId : $conciliacao->account_id,
                'amount' => $item->amount,
                'date' => $item->transaction_date->toDateString(),
                'description' => trim((string) $descricao) ?: $item->description,
            ]);

            $ladoDestaConta = Transacao::where('transfer_id', $transferencia->id)
                ->where('account_id', $conciliacao->account_id)
                ->get();

            VinculoConciliacao::vincular($item, $ladoDestaConta, 'MANUAL');

            return $transferencia;
        });
    }

    /** "Vou lançar depois": segura o fechamento e gera aviso até ser resolvido. */
    public static function adiar(ConciliacaoItem $item, ?string $nota): void
    {
        self::exigirLinhaDoExtrato($item->conciliacao, $item);

        $item->update([
            'status' => StatusItemConciliacao::ADIADO,
            'note' => $nota,
            'resolved_at' => null,
        ]);
    }

    /** Não entra no app (com motivo): não segura o fechamento. Ex.: cobrança contestada no banco. */
    public static function ignorar(ConciliacaoItem $item, string $nota): void
    {
        self::exigirLinhaDoExtrato($item->conciliacao, $item);

        $item->update([
            'status' => StatusItemConciliacao::IGNORADO,
            'matched_by' => 'MANUAL',
            'note' => $nota,
            'resolved_at' => now(),
        ]);
    }

    /**
     * Volta a linha para pendente (desvinculando, se estava conciliada). Para um item "só no app"
     * confirmado, desfazer remove a confirmação.
     */
    public static function desfazer(ConciliacaoItem $item): void
    {
        VinculoConciliacao::exigirAberta($item->conciliacao);

        DB::transaction(function () use ($item) {
            if ($item->source === OrigemItemConciliacao::APP) {
                Transacao::where('reconciliation_item_id', $item->id)->update(['reconciliation_item_id' => null]);
                $item->delete();

                return;
            }

            VinculoConciliacao::desvincular($item);
        });
    }

    private static function exigirLinhaDoExtrato(Conciliacao $conciliacao, ConciliacaoItem $item): void
    {
        VinculoConciliacao::exigirAberta($conciliacao);

        if ($item->source !== OrigemItemConciliacao::EXTRATO) {
            throw new ConciliacaoException('Ação disponível só para linhas do extrato.');
        }

        VinculoConciliacao::exigirLinhaEmAberto($item);
    }

    private static function moeda(float $valor): string
    {
        return number_format($valor, 2, ',', '.');
    }
}
