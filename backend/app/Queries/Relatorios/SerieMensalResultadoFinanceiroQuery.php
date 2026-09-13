<?php

namespace App\Queries\Relatorios;

use App\Support\Relatorios\FiltrosResultadoFinanceiro;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SerieMensalResultadoFinanceiroQuery
{
    /**
     * Receitas x despesas por mês, dentro do período do relatório — alimenta o
     * gráfico "Receitas x Despesas por mês" (sempre por mês, independente da
     * granularidade usada em outras telas).
     *
     * Agrupa em PHP (em vez de DATE_FORMAT em SQL) para não depender de uma
     * função específica do MySQL — o mesmo relatório roda igual em qualquer banco.
     *
     * @return array<int, array{periodo: string, receitas: float, despesas: float}>
     */
    public static function query(FiltrosResultadoFinanceiro $filtros): array
    {
        $colunaData = $filtros->colunaData();

        $linhas = DB::table('transactions')
            ->where('user_id', $filtros->userId)
            ->where('is_initial_balance', false)
            ->whereIn('status', $filtros->statuses())
            ->when($filtros->contaId, fn ($q) => $q->where('account_id', $filtros->contaId))
            ->whereRaw("DATE({$colunaData}) BETWEEN ? AND ?", [
                $filtros->dataInicial->toDateString(),
                $filtros->dataFinal->toDateString(),
            ])
            ->selectRaw("type, amount, date, due_date, created_at")
            ->get();

        $porMes = $linhas->groupBy(function ($linha) {
            $data = Carbon::parse($linha->date ?? $linha->due_date ?? $linha->created_at);

            return $data->copy()->startOfMonth()->toDateString();
        });

        return $porMes
            ->map(fn ($grupo, $periodo) => [
                'periodo' => $periodo,
                'receitas' => round((float) $grupo->where('type', 'INCOME')->sum('amount'), 2),
                'despesas' => round((float) $grupo->where('type', 'EXPENSE')->sum('amount'), 2),
            ])
            ->sortKeys()
            ->values()
            ->all();
    }
}
