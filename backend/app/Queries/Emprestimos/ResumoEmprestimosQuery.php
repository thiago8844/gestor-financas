<?php

namespace App\Queries\Emprestimos;

use App\Enums\DirecaoEmprestimo;
use App\Enums\StatusEmprestimo;
use App\Models\Emprestimo;
use App\Models\EmprestimoParcela;

/**
 * Totais da tela de empréstimos e do card do dashboard.
 */
class ResumoEmprestimosQuery
{
    private const PROXIMOS = 3;

    public static function para(int $userId): array
    {
        $emprestimos = Emprestimo::where('user_id', $userId)
            ->where('status', StatusEmprestimo::ATIVO->value)
            ->with(['ajustes', 'parcelas' => fn ($q) => $q->whereIn('status', ['PREVISTA', 'PARCIAL'])])
            ->get();

        $resumo = [];
        foreach (DirecaoEmprestimo::cases() as $direcao) {
            $daDirecao = $emprestimos->where('direction', $direcao);
            $parcelas = $daDirecao->flatMap->parcelas;

            $resumo[$direcao === DirecaoEmprestimo::TOMADO ? 'eu_devo' : 'me_devem'] = [
                'contratos' => $daDirecao->count(),
                'saldo_principal' => round($daDirecao->sum(fn (Emprestimo $e) => $e->saldoPrincipal()), 2),
                'total_restante' => round($parcelas->sum(fn (EmprestimoParcela $p) => $p->restante()), 2),
            ];
        }

        $todas = $emprestimos->flatMap(fn (Emprestimo $e) => $e->parcelas->each->setRelation('emprestimo', $e));
        $atrasadas = $todas->filter(fn (EmprestimoParcela $p) => $p->atrasada());

        $resumo['atrasadas'] = [
            'quantidade' => $atrasadas->count(),
            'valor' => round($atrasadas->sum(fn (EmprestimoParcela $p) => $p->restante()), 2),
        ];

        $resumo['proximos_vencimentos'] = $todas
            ->sortBy(fn (EmprestimoParcela $p) => $p->due_date->toDateString() . str_pad((string) $p->id, 10, '0', STR_PAD_LEFT))
            ->take(self::PROXIMOS)
            ->map(fn (EmprestimoParcela $p) => [
                'loan_id' => $p->loan_id,
                'installment_id' => $p->id,
                'number' => $p->number,
                'counterparty' => $p->emprestimo->counterparty,
                'direction' => $p->emprestimo->direction->value,
                'due_date' => $p->due_date->toDateString(),
                'amount' => $p->restante(),
                'overdue' => $p->atrasada(),
            ])
            ->values()
            ->all();

        return $resumo;
    }
}
