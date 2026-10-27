<?php

namespace App\Notificacoes\Regras;

use App\Enums\DirecaoEmprestimo;
use App\Models\ConfiguracaoUsuario;
use App\Models\User;
use App\Notificacoes\ParcelasEmprestimoPorVencimento;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Cobra, por até X dias depois do vencimento, as parcelas de empréstimo que continuam em aberto.
 * X é o mesmo prazo de atraso das demais despesas (0 = desligado).
 */
class EmprestimoAtrasadoRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'emprestimo_atrasado';
    }

    public function verificar(User $user): array
    {
        $configuracao = $user->configuracao ?? new ConfiguracaoUsuario();
        $dias = $configuracao->notify_overdue_days;

        if ($dias <= 0) {
            return [];
        }

        $hoje = now()->startOfDay();

        return ParcelasEmprestimoPorVencimento::entre($user, $hoje->copy()->subDays($dias), $hoje->copy()->subDay())
            ->map(function ($parcela) use ($hoje) {
                $atraso = (int) $parcela->due_date->copy()->startOfDay()->diffInDays($hoje);
                $ha = $atraso === 1 ? 'há 1 dia' : "há {$atraso} dias";
                $recebe = $parcela->emprestimo->direction === DirecaoEmprestimo::CONCEDIDO;

                return [
                    'title' => $recebe ? 'Recebimento atrasado' : 'Parcela de empréstimo atrasada',
                    'message' => ParcelasEmprestimoPorVencimento::descricao($parcela) . " venceu {$ha} ({$parcela->due_date->format('d/m/Y')}) e ainda não foi "
                        . ($recebe ? 'recebida' : 'paga') . ' - '
                        . PendenciasPorVencimento::formatarValor($parcela->restante()) . '.',
                    'severity' => 'danger',
                    'dedupe_key' => "emprestimo_atrasado:{$parcela->id}:{$hoje->toDateString()}",
                    'data' => ParcelasEmprestimoPorVencimento::dados($parcela),
                    'action_url' => "/emprestimos/{$parcela->loan_id}",
                ];
            })
            ->all();
    }
}
