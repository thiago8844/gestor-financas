<?php

namespace App\Actions\Ofx;

use App\Actions\Ofx\Exceptions\OfxReabrirBloqueadoException;
use App\Enums\OfxImportItemStatus;
use App\Enums\OfxImportStatus;
use App\Models\OfxImport;
use App\Models\OfxImportRule;
use App\Models\Transacao;
use Illuminate\Support\Facades\DB;

/**
 * Reabre uma importação desfeita para revisão.
 *
 * MANTER: volta exatamente com as seleções e edições que estavam na confirmação.
 * ZERAR: volta como estava logo após o upload (descrição original, sem categoria/orçamento,
 *        duplicadas recalculadas e regras ativas reaplicadas).
 */
class ReabrirImportacaoOfx
{
    public const MANTER = 'manter';
    public const ZERAR = 'zerar';

    public static function executar(OfxImport $import, string $modo): OfxImport
    {
        if ($import->status !== OfxImportStatus::UNDONE) {
            throw new OfxReabrirBloqueadoException($import);
        }

        return DB::transaction(function () use ($import, $modo) {
            $itens = $import->itens()->get();

            if ($modo === self::ZERAR) {
                self::zerarItens($import, $itens);
            } else {
                self::manterItens($itens);
            }

            $import->update([
                'status' => OfxImportStatus::STAGED,
                'undone_at' => null,
                'finalizada_at' => null,
                'imported_transactions' => 0,
                'ignored_transactions' => 0,
                'duplicate_transactions' => $import->itens()->where('status', OfxImportItemStatus::DUPLICADA)->count(),
            ]);

            return $import->fresh(['itens', 'conta']);
        });
    }

    private static function manterItens($itens): void
    {
        foreach ($itens as $item) {
            if ($item->status === OfxImportItemStatus::IMPORTADA) {
                $item->update([
                    'status' => OfxImportItemStatus::PENDENTE,
                    'created_transaction_id' => null,
                ]);
            } elseif ($item->status === OfxImportItemStatus::IGNORADA) {
                $item->update([
                    'status' => OfxImportItemStatus::PENDENTE,
                    'selecionada' => false,
                ]);
            }
        }
    }

    private static function zerarItens(OfxImport $import, $itens): void
    {
        foreach ($itens as $item) {
            $correspondente = $item->fitid
                ? Transacao::where('user_id', $import->user_id)
                    ->where('account_id', $import->account_id)
                    ->where('fitid', $item->fitid)
                    ->first()
                : null;

            $item->update([
                'status' => $correspondente ? OfxImportItemStatus::DUPLICADA : OfxImportItemStatus::PENDENTE,
                'selecionada' => !$correspondente,
                'matched_transaction_id' => $correspondente?->id,
                'created_transaction_id' => null,
                'descricao' => $item->descricao_original,
                'account_id' => $import->account_id,
                'category_id' => null,
                'budget_id' => null,
                'regra_aplicada_id' => null,
            ]);
        }

        $aplicador = new AplicarRegraOfx();

        OfxImportRule::where('user_id', $import->user_id)
            ->where('active', true)
            ->get()
            ->each(fn (OfxImportRule $regra) => $aplicador->executar($regra, $import->id));
    }
}
