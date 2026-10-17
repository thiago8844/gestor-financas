<?php

namespace App\Actions\Faturas;

use App\Actions\Faturas\Exceptions\OperacaoFaturaException;
use App\Enums\TipoTransferencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Models\Transferencia;
use Illuminate\Support\Facades\DB;

class ReverterPagamentoFatura
{
    /**
     * Volta todas as parcelas pagas da fatura para pendente. Se o pagamento foi parcial, desfaz
     * também a rolagem (o crédito nesta fatura e o débito na seguinte) — desde que a fatura
     * seguinte ainda não tenha pago esse saldo.
     */
    public static function executar(Fatura $fatura): void
    {
        DB::transaction(function () use ($fatura) {
            $pagas = Transacao::where('invoice_id', $fatura->id)
                ->where('status', TransactionStatus::PAID);

            if ($pagas->count() === 0) {
                throw new OperacaoFaturaException('Essa fatura não tem nenhum pagamento para reverter.');
            }

            $rolagens = Transferencia::where('source_invoice_id', $fatura->id)
                ->where('kind', TipoTransferencia::FATURA->value)
                ->with(['transacoes', 'faturaDestino'])
                ->get();

            foreach ($rolagens as $rolagem) {
                $debitoNaProxima = $rolagem->transacoes->firstWhere('type', TransactionType::EXPENSE);

                if ($debitoNaProxima && $debitoNaProxima->status === TransactionStatus::PAID) {
                    $mes = $rolagem->faturaDestino
                        ? PagarFatura::mesAno($rolagem->faturaDestino->reference_month)
                        : 'seguinte';

                    throw new OperacaoFaturaException(
                        "O saldo desta fatura já foi pago junto com a fatura de {$mes}. Reverta o pagamento dela primeiro."
                    );
                }
            }

            foreach ($rolagens as $rolagem) {
                // Apaga explicitamente os dois lados antes da transferência (não depende do cascade do banco).
                Transacao::where('transfer_id', $rolagem->id)->delete();
                $rolagem->delete();
            }

            Transacao::where('invoice_id', $fatura->id)
                ->where('status', TransactionStatus::PAID)
                ->update([
                    'status' => TransactionStatus::PENDING,
                    'date' => null,
                ]);
        });
    }
}
