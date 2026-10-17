<?php

namespace App\Actions\Conciliacao;

use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Transacao;
use App\Queries\Conciliacao\RazaoContaQuery;
use App\Support\Conciliacao\Dto\EntradaRazao;
use Illuminate\Support\Facades\DB;

/**
 * Lançamentos pagos no app, dentro do mês, que não aparecem no extrato. Normalmente é erro
 * (lançado na conta errada, data errada, pago que na verdade não foi). As saídas são:
 *  - corrigir pelas telas normais (excluir, mudar a data) e reconferir;
 *  - voltar para pendente (não foi pago de verdade);
 *  - manter: está certo mesmo assim (ex.: o banco posta no mês seguinte), com motivo.
 */
class SoNoAppConciliacao
{
    /**
     * @param string[] $chaves
     */
    public static function manter(Conciliacao $conciliacao, array $chaves, string $nota): int
    {
        VinculoConciliacao::exigirAberta($conciliacao);

        return DB::transaction(function () use ($conciliacao, $chaves, $nota) {
            $entradas = RazaoDaConciliacao::livres($conciliacao)->keyBy('chave');
            $mantidos = 0;

            foreach (array_unique($chaves) as $chave) {
                /** @var EntradaRazao|null $entrada */
                $entrada = $entradas->get($chave);
                $transacoes = RazaoContaQuery::transacoesDaChave($chave, $conciliacao->user_id, $conciliacao->account_id);

                if (!$entrada || $transacoes->isEmpty()) {
                    continue;
                }

                $efeito = RazaoContaQuery::efeitoNoSaldo($transacoes);

                $item = ConciliacaoItem::create([
                    'reconciliation_id' => $conciliacao->id,
                    'user_id' => $conciliacao->user_id,
                    'source' => OrigemItemConciliacao::APP,
                    'external_id' => 'app:' . $chave,
                    'type' => $efeito >= 0 ? TransactionType::INCOME : TransactionType::EXPENSE,
                    'amount' => abs($efeito),
                    'transaction_date' => $entrada->data->toDateString(),
                    'description' => $entrada->descricao,
                    'status' => StatusItemConciliacao::IGNORADO,
                    'matched_by' => 'MANUAL',
                    'invoice_id' => $entrada->faturaId,
                    'note' => $nota,
                    'resolved_at' => now(),
                ]);

                Transacao::whereIn('id', $transacoes->pluck('id'))->update(['reconciliation_item_id' => $item->id]);

                $mantidos++;
            }

            return $mantidos;
        });
    }

    /** O lançamento não foi pago de verdade: volta para pendente e sai do saldo. */
    public static function voltarParaPendente(Conciliacao $conciliacao, string $chave): void
    {
        VinculoConciliacao::exigirAberta($conciliacao);

        if (!str_starts_with($chave, 't:')) {
            throw new ConciliacaoException('Para pagamento de fatura, reverta o pagamento na tela de Cartões.');
        }

        $transacoes = RazaoContaQuery::transacoesDaChave($chave, $conciliacao->user_id, $conciliacao->account_id);

        if ($transacoes->isEmpty()) {
            throw new ConciliacaoException('Lançamento não encontrado ou já conciliado.');
        }

        $transacao = $transacoes->first();

        if ($transacao->transfer_id !== null) {
            throw new ConciliacaoException('Transferência se corrige pela tela de Transferências.');
        }

        $transacao->update(['status' => TransactionStatus::PENDING]);
    }
}
