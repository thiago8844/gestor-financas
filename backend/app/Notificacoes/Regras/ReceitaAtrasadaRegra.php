<?php

namespace App\Notificacoes\Regras;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\ConfiguracaoUsuario;
use App\Models\Transacao;
use App\Models\User;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Receita que devia ter entrado e continua pendente: cobra a baixa por até X dias depois do
 * vencimento (mesmo prazo de atraso das despesas; 0 = desligado).
 */
class ReceitaAtrasadaRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'receita_atrasada';
    }

    public function verificar(User $user): array
    {
        $dias = ($user->configuracao ?? new ConfiguracaoUsuario())->notify_overdue_days;

        if ($dias <= 0) {
            return [];
        }

        $hoje = now()->startOfDay();

        return Transacao::where('user_id', $user->id)
            ->where('type', TransactionType::INCOME)
            ->where('status', TransactionStatus::PENDING)
            ->where('is_initial_balance', false)
            ->whereNull('card_id')
            ->whereDate('due_date', '>=', $hoje->copy()->subDays($dias)->toDateString())
            ->whereDate('due_date', '<=', $hoje->copy()->subDay()->toDateString())
            ->get()
            ->map(function (Transacao $t) use ($hoje) {
                $atraso = (int) $t->due_date->copy()->startOfDay()->diffInDays($hoje);
                $ha = $atraso === 1 ? 'há 1 dia' : "há {$atraso} dias";

                return [
                    'title' => 'Receita atrasada',
                    'message' => "\"{$t->description}\" devia ter entrado {$ha} ({$t->due_date->format('d/m/Y')}) e ainda não foi recebida - "
                        . PendenciasPorVencimento::formatarValor((float) $t->amount) . '.',
                    'severity' => 'warning',
                    'dedupe_key' => "receita_atrasada:{$t->id}:{$hoje->toDateString()}",
                    'data' => ['transacao_id' => $t->id, 'amount' => (float) $t->amount, 'due_date' => $t->due_date->toDateString()],
                    'action_url' => "/receitas/editar/{$t->id}",
                ];
            })
            ->values()
            ->all();
    }
}
