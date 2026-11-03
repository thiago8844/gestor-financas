<?php

namespace App\Actions\Faturas;

use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Fatura;
use Illuminate\Support\Facades\DB;

class AplicarRegraFechamentoCartao
{
    /**
     * Depois de mudar o vencimento ou a regra de fechamento do cartão: as faturas sem nada pago voltam
     * a seguir a regra (ajustes manuais de fechamento são descartados) e as despesas pendentes são
     * realocadas pela data da compra. Faturas com algo pago ficam como estão.
     *
     * @return int quantidade de despesas que mudaram de fatura
     */
    public static function executar(Cartao $cartao): int
    {
        return DB::transaction(function () use ($cartao) {
            Fatura::where('card_id', $cartao->id)
                ->whereDoesntHave('parcelas', fn ($q) => $q->where('status', TransactionStatus::PAID))
                ->get()
                ->each(function (Fatura $fatura) use ($cartao) {
                    [$fechamento, $vencimento] = ResolverFaturaCompra::datasPorReferencia($cartao, $fatura->reference_month);

                    $fatura->update([
                        'closing_date' => $fechamento,
                        'due_date' => $vencimento,
                        'closing_manual' => false,
                    ]);
                });

            return RealocarDespesasCartao::executar($cartao);
        });
    }
}
