<?php

namespace App\Notificacoes\Regras;

use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Models\Conciliacao;
use App\Models\User;
use App\Notificacoes\RegraNotificacao;

/**
 * Linhas do extrato que o usuário deixou "para lançar depois": lembra uma vez por semana enquanto
 * a conciliação estiver aberta com adiamentos.
 */
class ConciliacaoPendenteRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'conciliacao_pendente';
    }

    public function verificar(User $user): array
    {
        $semana = now()->format('o-\WW');

        return Conciliacao::query()
            ->where('user_id', $user->id)
            ->where('status', StatusConciliacao::ABERTA->value)
            ->with('conta:id,name')
            ->withCount(['itens as adiadas_count' => fn ($q) => $q
                ->where('source', OrigemItemConciliacao::EXTRATO->value)
                ->where('status', StatusItemConciliacao::ADIADO->value)])
            ->get()
            ->filter(fn (Conciliacao $c) => $c->adiadas_count > 0)
            ->map(fn (Conciliacao $c) => [
                'title' => 'Conciliação com lançamentos adiados',
                'message' => "A conciliação de {$c->conta?->name} ({$c->reference_month->format('m/Y')}) tem "
                    . "{$c->adiadas_count} linha(s) do extrato esperando lançamento. Lance e finalize o mês.",
                'severity' => 'warning',
                'dedupe_key' => "conciliacao_pendente:{$c->id}:{$semana}",
                'data' => ['conciliacao_id' => $c->id, 'adiadas' => $c->adiadas_count],
                'action_url' => "/conciliacao/{$c->id}",
            ])
            ->values()
            ->all();
    }
}
