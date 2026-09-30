<?php

namespace App\Notificacoes\Regras;

use App\Models\ConfiguracaoUsuario;
use App\Models\User;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Notificação de urgência: a cada dia, por até X dias depois do vencimento, cobra o que
 * continua sem pagar. Passado esse prazo, para de avisar. X vem das configurações do
 * usuário (0 = desligado).
 */
class DespesaVencidaRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'despesa_vencida';
    }

    public function verificar(User $user): array
    {
        $configuracao = $user->configuracao ?? new ConfiguracaoUsuario();
        $dias = $configuracao->notify_overdue_days;

        if ($dias <= 0) {
            return [];
        }

        $hoje = now()->startOfDay();

        return PendenciasPorVencimento::entre($user, $hoje->copy()->subDays($dias), $hoje->copy()->subDay())
            ->map(function (array $pendencia) use ($hoje) {
                $atraso = (int) $pendencia['vencimento']->copy()->startOfDay()->diffInDays($hoje);
                $ha = $atraso === 1 ? 'há 1 dia' : "há {$atraso} dias";
                $ehFatura = isset($pendencia['data']['fatura_id']);

                return [
                    'title' => $ehFatura ? 'Fatura atrasada' : 'Despesa vencida',
                    'message' => "{$pendencia['descricao']} venceu {$ha} ({$pendencia['vencimento']->format('d/m/Y')}) e ainda não foi paga - "
                        . PendenciasPorVencimento::formatarValor($pendencia['valor']) . '.',
                    'severity' => 'danger',
                    'dedupe_key' => "despesa_vencida:{$pendencia['chave']}:{$hoje->toDateString()}",
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
