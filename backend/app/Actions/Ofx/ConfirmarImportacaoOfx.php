<?php

namespace App\Actions\Ofx;

use App\Actions\Ofx\Exceptions\OfxImportacaoJaFinalizadaException;
use App\Enums\OfxImportItemStatus;
use App\Enums\OfxImportStatus;
use App\Enums\TransactionStatus;
use App\Models\OfxImport;
use App\Models\Transacao;
use Illuminate\Support\Facades\DB;

class ConfirmarImportacaoOfx
{
    /**
     * @param int[] $idsSelecionados ids de OfxImportItem PENDENTE que devem virar transações reais;
     *                                os demais PENDENTE viram IGNORADA.
     */
    public static function executar(OfxImport $import, array $idsSelecionados): OfxImport
    {
        if ($import->status !== OfxImportStatus::STAGED) {
            throw new OfxImportacaoJaFinalizadaException($import);
        }

        return DB::transaction(function () use ($import, $idsSelecionados) {
            $importadas = 0;
            $ignoradas = 0;

            $itensPendentes = $import->itens()->where('status', OfxImportItemStatus::PENDENTE)->get();

            foreach ($itensPendentes as $item) {
                if (in_array($item->id, $idsSelecionados, true)) {
                    $transacao = Transacao::create([
                        'user_id' => $item->user_id,
                        'account_id' => $item->account_id,
                        'category_id' => $item->category_id,
                        'budget_id' => $item->budget_id,
                        'type' => $item->type,
                        'description' => $item->descricao,
                        'amount' => $item->amount,
                        'status' => TransactionStatus::PAID,
                        'date' => $item->transaction_date,
                        'due_date' => $item->transaction_date,
                        'fitid' => $item->fitid,
                        'ofx_import_id' => $import->id,
                    ]);

                    $item->update([
                        'status' => OfxImportItemStatus::IMPORTADA,
                        'created_transaction_id' => $transacao->id,
                        'selecionada' => true,
                    ]);

                    $importadas++;
                } else {
                    $item->update([
                        'status' => OfxImportItemStatus::IGNORADA,
                        'selecionada' => false,
                    ]);

                    $ignoradas++;
                }
            }

            $import->update([
                'status' => OfxImportStatus::CONFIRMED,
                'imported_transactions' => $importadas,
                'ignored_transactions' => $ignoradas,
                'finalizada_at' => now(),
            ]);

            return $import->fresh(['itens', 'conta']);
        });
    }
}
