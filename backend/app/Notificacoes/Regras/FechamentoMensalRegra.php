<?php

namespace App\Notificacoes\Regras;

use App\Enums\StatusConciliacao;
use App\Models\Conciliacao;
use App\Models\Conta;
use App\Models\User;
use App\Notificacoes\RegraNotificacao;

/**
 * A partir do dia X do mês, lembra (uma vez por mês, por conta) de fechar a conciliação do mês
 * anterior. Só para contas que já foram conciliadas alguma vez: quem não usa o módulo não é avisado.
 */
class FechamentoMensalRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'fechamento_mensal';
    }

    public function verificar(User $user): array
    {
        if (now()->day < (int) config('conciliacao.lembrete_fechamento_dia', 5)) {
            return [];
        }

        $mesAnterior = now()->startOfMonth()->subMonthNoOverflow();

        $contasQueUsam = Conciliacao::where('user_id', $user->id)
            ->whereDate('reference_month', '<=', $mesAnterior->toDateString())
            ->distinct()
            ->pluck('account_id');

        if ($contasQueUsam->isEmpty()) {
            return [];
        }

        $finalizadas = Conciliacao::where('user_id', $user->id)
            ->whereDate('reference_month', $mesAnterior->toDateString())
            ->where('status', StatusConciliacao::FINALIZADA->value)
            ->pluck('account_id')
            ->flip();

        return Conta::whereIn('id', $contasQueUsam)
            ->where('active', true)
            ->get()
            ->reject(fn (Conta $conta) => $finalizadas->has($conta->id))
            ->map(fn (Conta $conta) => [
                'title' => 'Hora de fechar o mês',
                'message' => "A conciliação de {$conta->name} de {$mesAnterior->format('m/Y')} ainda não foi finalizada.",
                'severity' => 'info',
                'dedupe_key' => "fechamento_mensal:{$conta->id}:{$mesAnterior->format('Y-m')}",
                'data' => ['account_id' => $conta->id, 'mes' => $mesAnterior->format('Y-m')],
                'action_url' => '/conciliacao?mes=' . $mesAnterior->format('Y-m'),
            ])
            ->values()
            ->all();
    }
}
