<?php

namespace App\Notificacoes\Regras;

use App\Models\RecorrenciaTransacao;
use App\Models\User;
use App\Notificacoes\RegraNotificacao;

/**
 * Avisa uma única vez, a partir de X dias antes da data final, que a recorrência vai parar de lançar.
 */
class RecorrenciaEncerrandoRegra implements RegraNotificacao
{
    public const DIAS_ANTECEDENCIA = 7;

    public function tipo(): string
    {
        return 'recorrencia_encerrando';
    }

    public function verificar(User $user): array
    {
        $hoje = now()->startOfDay();

        return RecorrenciaTransacao::where('user_id', $user->id)
            ->where('active', true)
            ->whereNotNull('end_date')
            ->whereDate('end_date', '>=', $hoje->toDateString())
            ->whereDate('end_date', '<=', $hoje->copy()->addDays(self::DIAS_ANTECEDENCIA)->toDateString())
            ->get()
            ->map(fn (RecorrenciaTransacao $r) => [
                'title' => 'Recorrência perto do fim',
                'message' => "A recorrência \"{$r->description}\" termina em {$r->end_date->format('d/m/Y')}. "
                    . 'Depois disso ela para de lançar; estenda a data final se quiser continuar.',
                'severity' => 'info',
                'dedupe_key' => "recorrencia_encerrando:{$r->id}:{$r->end_date->toDateString()}",
                'data' => ['recurring_transaction_id' => $r->id, 'end_date' => $r->end_date->toDateString()],
                'action_url' => "/recorrencias/editar/{$r->id}",
            ])
            ->values()
            ->all();
    }
}
