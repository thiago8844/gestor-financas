<?php

namespace App\Notificacoes\Regras;

use App\Enums\OfxImportStatus;
use App\Models\OfxImport;
use App\Models\User;
use App\Notificacoes\RegraNotificacao;

/**
 * Importação de extrato (OFX) enviada mas nunca confirmada: lembra uma vez por semana,
 * depois de 2 dias parada.
 */
class ImportacaoOfxPendenteRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'importacao_ofx_pendente';
    }

    public function verificar(User $user): array
    {
        $semana = now()->format('o-\WW');

        return OfxImport::where('user_id', $user->id)
            ->where('status', OfxImportStatus::STAGED->value)
            ->where('created_at', '<=', now()->subDays(2))
            ->with('conta:id,name')
            ->get()
            ->map(fn (OfxImport $import) => [
                'title' => 'Importação de extrato pendente',
                'message' => 'A importação do extrato' . ($import->conta ? " da conta {$import->conta->name}" : '')
                    . " enviada em {$import->created_at->format('d/m/Y')} ainda não foi confirmada.",
                'severity' => 'warning',
                'dedupe_key' => "importacao_ofx_pendente:{$import->id}:{$semana}",
                'data' => ['ofx_import_id' => $import->id],
                'action_url' => "/importacoes-ofx/{$import->id}",
            ])
            ->values()
            ->all();
    }
}
