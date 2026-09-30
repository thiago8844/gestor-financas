<?php

namespace App\Notificacoes\Regras;

use App\Models\ConfiguracaoUsuario;
use App\Models\User;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Notificação de aviso: a cada dia, de X dias antes até o dia do vencimento, lembra do que
 * ainda não foi pago. X vem das configurações do usuário (0 = desligado).
 */
class PagamentoAVencerRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'pagamento_a_vencer';
    }

    public function verificar(User $user): array
    {
        $configuracao = $user->configuracao ?? new ConfiguracaoUsuario();
        $dias = $configuracao->notify_upcoming_days;

        if ($dias <= 0) {
            return [];
        }

        $hoje = now()->startOfDay();

        return PendenciasPorVencimento::entre($user, $hoje, $hoje->copy()->addDays($dias))
            ->map(function (array $pendencia) use ($hoje) {
                $faltam = (int) $hoje->diffInDays($pendencia['vencimento']->copy()->startOfDay());
                $quando = match ($faltam) {
                    0 => 'vence hoje',
                    1 => 'vence amanhã',
                    default => "vence em {$faltam} dias",
                };

                return [
                    'title' => 'Pagamento a vencer',
                    'message' => "{$pendencia['descricao']} {$quando} ({$pendencia['vencimento']->format('d/m/Y')}) - "
                        . PendenciasPorVencimento::formatarValor($pendencia['valor']) . '.',
                    'severity' => 'warning',
                    // Uma notificação por dia, por item: é o "aviso todo dia até o vencimento".
                    'dedupe_key' => "pagamento_a_vencer:{$pendencia['chave']}:{$hoje->toDateString()}",
                    'data' => [
                        ...$pendencia['data'],
                        'amount' => $pendencia['valor'],
                        'due_date' => $pendencia['vencimento']->toDateString(),
                    ],
                    'action_url' => $pendencia['action_url'],
                ];
            })
            ->all();
    }
}
