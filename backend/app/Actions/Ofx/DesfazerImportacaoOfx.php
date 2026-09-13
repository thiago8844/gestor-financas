<?php

namespace App\Actions\Ofx;

use App\Actions\Ofx\Exceptions\OfxDesfazerBloqueadoException;
use App\Enums\OfxImportStatus;
use App\Models\OfxImport;
use App\Models\Transacao;
use Illuminate\Support\Facades\DB;

class DesfazerImportacaoOfx
{
    public static function executar(OfxImport $import, bool $forcar = false): OfxImport
    {
        if ($import->status !== OfxImportStatus::CONFIRMED) {
            throw new OfxDesfazerBloqueadoException($import, collect());
        }

        $transacoes = Transacao::where('ofx_import_id', $import->id)->get();

        $editadasDepois = $transacoes->filter(
            fn (Transacao $transacao) => $import->finalizada_at && $transacao->updated_at->gt($import->finalizada_at)
        );

        if ($editadasDepois->isNotEmpty() && !$forcar) {
            throw new OfxDesfazerBloqueadoException($import, $editadasDepois);
        }

        return DB::transaction(function () use ($import, $transacoes) {
            Transacao::whereIn('id', $transacoes->pluck('id'))->delete();

            $import->update([
                'status' => OfxImportStatus::UNDONE,
                'undone_at' => now(),
            ]);

            return $import->fresh(['itens', 'conta']);
        });
    }
}
