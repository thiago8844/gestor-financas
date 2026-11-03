<?php

namespace App\Actions\Faturas;

use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Fatura;
use App\Models\Transacao;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RealocarDespesasCartao
{
    /**
     * Recoloca as despesas pendentes do cartão na fatura certa, pela data da compra e pelos
     * fechamentos vigentes (regra do cartão + ajustes manuais). Usada quando a regra de fechamento,
     * o vencimento ou o fechamento de uma fatura mudam.
     *
     * Não mexe em faturas com algo pago, em saldo levado de pagamento parcial nem em lançamentos
     * já conciliados com o extrato. Parcelas seguem a primeira: a parcela N cai N-1 faturas depois.
     * Faturas pendentes que ficam vazias (e sem auditoria) são removidas.
     *
     * @return int quantidade de despesas que mudaram de fatura
     */
    public static function executar(Cartao $cartao): int
    {
        return DB::transaction(function () use ($cartao) {
            $fixos = ResolverFaturaCompra::fechamentosFixos($cartao);
            $pagas = static::faturasPagas($cartao);
            $faturas = collect();
            $movidas = 0;

            Transacao::where('card_id', $cartao->id)
                ->where('status', TransactionStatus::PENDING)
                ->whereNull('transfer_id')
                ->whereNull('reconciliation_item_id')
                ->whereNotNull('invoice_id')
                ->whereNotNull('purchase_date')
                ->orderBy('id')
                ->chunkById(500, function (Collection $transacoes) use ($cartao, $fixos, $pagas, $faturas, &$movidas) {
                    foreach ($transacoes as $transacao) {
                        if ($pagas->contains($transacao->invoice_id)) {
                            continue;
                        }

                        $referencia = ResolverFaturaCompra::referenciaFaturaParaCompra($cartao, $transacao->purchase_date, $fixos)
                            ->addMonthsNoOverflow(max(1, (int) $transacao->installment_number) - 1);

                        $fatura = $faturas->get($referencia->toDateString())
                            ?? tap(ResolverFaturaCompra::localizarOuCriarPorReferencia($cartao, $referencia),
                                fn (Fatura $f) => $faturas->put($referencia->toDateString(), $f));

                        if ($fatura->id === $transacao->invoice_id || $pagas->contains($fatura->id)) {
                            continue;
                        }

                        $transacao->update(['invoice_id' => $fatura->id, 'due_date' => $fatura->due_date]);
                        $movidas++;
                    }
                });

            Fatura::where('card_id', $cartao->id)
                ->whereDoesntHave('parcelas')
                ->whereDoesntHave('auditorias')
                ->where('closing_manual', false)
                ->whereNotIn('id', $pagas)
                ->delete();

            return $movidas;
        });
    }

    /** @return Collection<int, int> */
    private static function faturasPagas(Cartao $cartao): Collection
    {
        return Fatura::where('card_id', $cartao->id)
            ->whereHas('parcelas', fn ($q) => $q->where('status', TransactionStatus::PAID))
            ->pluck('id');
    }
}
