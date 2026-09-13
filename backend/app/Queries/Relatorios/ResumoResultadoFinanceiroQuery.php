<?php

namespace App\Queries\Relatorios;

use App\Support\Relatorios\FiltrosResultadoFinanceiro;
use Illuminate\Support\Facades\DB;

class ResumoResultadoFinanceiroQuery
{
    /**
     * @return array{receitas: float, despesas: float, resultado: float, margem: float|null}
     */
    public static function query(FiltrosResultadoFinanceiro $filtros): array
    {
        $colunaData = $filtros->colunaData();

        $row = DB::table('transactions')
            ->where('user_id', $filtros->userId)
            ->where('is_initial_balance', false)
            ->whereIn('status', $filtros->statuses())
            ->when($filtros->contaId, fn ($q) => $q->where('account_id', $filtros->contaId))
            ->whereRaw("DATE({$colunaData}) BETWEEN ? AND ?", [
                $filtros->dataInicial->toDateString(),
                $filtros->dataFinal->toDateString(),
            ])
            ->selectRaw("
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS receitas,
                SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS despesas
            ")
            ->first();

        $receitas = round((float) ($row->receitas ?? 0), 2);
        $despesas = round((float) ($row->despesas ?? 0), 2);
        $resultado = round($receitas - $despesas, 2);

        // Margem = resultado / receitas. Sem receita no período, a margem não existe (não é 0%).
        $margem = $receitas > 0 ? round(($resultado / $receitas) * 100, 1) : null;

        return [
            'receitas' => $receitas,
            'despesas' => $despesas,
            'resultado' => $resultado,
            'margem' => $margem,
        ];
    }
}
