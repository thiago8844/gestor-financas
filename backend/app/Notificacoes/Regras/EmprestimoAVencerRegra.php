<?php

namespace App\Notificacoes\Regras;

use App\Enums\DirecaoEmprestimo;
use App\Models\ConfiguracaoUsuario;
use App\Models\User;
use App\Notificacoes\ParcelasEmprestimoPorVencimento;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Aviso diário, de X dias antes até o vencimento, das parcelas de empréstimo que ainda não foram
 * pagas (eu devo) ou recebidas (me devem). X é o mesmo prazo de aviso das demais despesas (0 = desligado).
 */
class EmprestimoAVencerRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'emprestimo_a_vencer';
    }

    public function verificar(User $user): array
    {
        $configuracao = $user->configuracao ?? new ConfiguracaoUsuario();
        $dias = $configuracao->notify_upcoming_days;

        if ($dias <= 0) {
            return [];
        }

        $hoje = now()->startOfDay();

        return ParcelasEmprestimoPorVencimento::entre($user, $hoje, $hoje->copy()->addDays($dias))
            ->map(function ($parcela) use ($hoje) {
                $faltam = (int) $hoje->diffInDays($parcela->due_date->copy()->startOfDay());
                $quando = match ($faltam) {
                    0 => 'vence hoje',
                    1 => 'vence amanhã',
                    default => "vence em {$faltam} dias",
                };
                $recebe = $parcela->emprestimo->direction === DirecaoEmprestimo::CONCEDIDO;

                return [
                    'title' => $recebe ? 'Recebimento a vencer' : 'Parcela de empréstimo a vencer',
                    'message' => ParcelasEmprestimoPorVencimento::descricao($parcela) . " {$quando} ({$parcela->due_date->format('d/m/Y')}) - "
                        . PendenciasPorVencimento::formatarValor($parcela->restante()) . '.',
                    'severity' => 'warning',
                    'dedupe_key' => "emprestimo_a_vencer:{$parcela->id}:{$hoje->toDateString()}",
                    'data' => ParcelasEmprestimoPorVencimento::dados($parcela),
                    'action_url' => "/emprestimos/{$parcela->loan_id}",
                ];
            })
            ->all();
    }
}
