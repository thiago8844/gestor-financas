<?php

namespace App\Actions\Conciliacao;

use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Enums\StatusItemConciliacao;
use App\Enums\TransactionStatus;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Transacao;
use App\Queries\Conciliacao\RazaoContaQuery;
use Illuminate\Support\Collection;

/**
 * Ligar/desligar uma linha do extrato aos lançamentos do app que ela confere.
 */
class VinculoConciliacao
{
    /**
     * @param Collection<int, Transacao> $transacoes
     */
    public static function vincular(ConciliacaoItem $item, Collection $transacoes, string $matchedBy, ?int $faturaId = null): void
    {
        $ids = $transacoes->pluck('id')->all();

        Transacao::whereIn('id', $ids)->update(['reconciliation_item_id' => $item->id]);

        // Linha conferida com um lançamento comum: grava o FITID nele. Assim a importação de OFX
        // (que deduplica por FITID) também passa a reconhecer esse lançamento.
        if ($item->fitid && count($ids) === 1) {
            $transacao = $transacoes->first();
            $fitidEmUso = Transacao::where('account_id', $transacao->account_id)->where('fitid', $item->fitid)->exists();

            if (!$transacao->fitid && !$fitidEmUso && $transacao->card_id === null) {
                Transacao::where('id', $transacao->id)->update(['fitid' => $item->fitid]);
            }
        }

        $item->update([
            'status' => StatusItemConciliacao::CONCILIADO,
            'matched_by' => $matchedBy,
            'invoice_id' => $faturaId,
            'resolved_at' => now(),
            'note' => null,
        ]);
    }

    public static function desvincular(ConciliacaoItem $item, ?string $nota = null): void
    {
        if ($item->fitid) {
            // Só desfaz o FITID que a própria conciliação gravou (lançamento que não veio de importação OFX).
            Transacao::where('reconciliation_item_id', $item->id)
                ->where('fitid', $item->fitid)
                ->whereNull('ofx_import_id')
                ->update(['fitid' => null]);
        }

        Transacao::where('reconciliation_item_id', $item->id)->update(['reconciliation_item_id' => null]);

        $item->update([
            'status' => StatusItemConciliacao::PENDENTE,
            'matched_by' => null,
            'invoice_id' => null,
            'resolved_at' => null,
            'note' => $nota,
        ]);
    }

    /**
     * O vínculo continua valendo? Quebra se alguém excluiu, voltou para pendente, mudou de conta
     * ou alterou o valor de um lançamento conferido depois da conciliação.
     */
    public static function valido(ConciliacaoItem $item, int $contaId): bool
    {
        $transacoes = $item->relationLoaded('transacoes') ? $item->transacoes : $item->transacoes()->get();

        if ($transacoes->isEmpty()) {
            return false;
        }

        foreach ($transacoes as $transacao) {
            if ($transacao->status !== TransactionStatus::PAID || (int) $transacao->account_id !== $contaId) {
                return false;
            }
        }

        return abs(RazaoContaQuery::efeitoNoSaldo($transacoes) - $item->valorNoSaldo()) < 0.005;
    }

    public static function exigirAberta(Conciliacao $conciliacao): void
    {
        if ($conciliacao->isFinalizada()) {
            throw new ConciliacaoException('Esta conciliação já foi finalizada. Reabra-a para fazer alterações.', 409);
        }
    }

    public static function exigirLinhaEmAberto(ConciliacaoItem $item): void
    {
        if ($item->status === StatusItemConciliacao::CONCILIADO) {
            throw new ConciliacaoException('Esta linha já está conciliada. Desfaça a conciliação dela antes.', 409);
        }
    }
}
