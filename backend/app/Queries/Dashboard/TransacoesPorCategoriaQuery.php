<?php

namespace App\Queries\Dashboard;

use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TransacoesPorCategoriaQuery
{
    /**
     * Retorna totais agrupados por categoria para um tipo de transação.
     *
     * @param  string       $tipo       'EXPENSE' ou 'INCOME'
     * @param  Carbon|null  $dataInicial  null = sem filtro (alltime)
     * @param  Carbon|null  $dataFinal    null = sem filtro (alltime)
     * @return array  [ ['categoria' => string, 'total' => float], ... ]
     */
    public static function run(
        string $tipo,
        ?Carbon $dataInicial,
        ?Carbon $dataFinal,
    ): array {
        $userId = Auth::id();

        $query = DB::table('transactions')
            // LEFT JOIN para incluir transações sem categoria ("Sem categoria")
            ->leftJoin('categories', 'transactions.category_id', '=', 'categories.id')
            ->where('transactions.user_id', $userId)
            ->where('transactions.type',   $tipo)
            ->where('transactions.status', 'PAID')
            ->where('transactions.is_initial_balance', false)
            // Filtro de período — só aplicado quando as datas forem informadas
            ->when($dataInicial && $dataFinal, function ($q) use ($dataInicial, $dataFinal) {
                $q->whereBetween('transactions.date', [
                    $dataInicial->copy()->startOfDay(),
                    $dataFinal->copy()->endOfDay(),
                ]);
            })
            ->select([
                // COALESCE garante rótulo amigável quando category_id for null
                DB::raw("COALESCE(categories.name, 'Sem categoria') as categoria"),
                DB::raw('SUM(transactions.amount) as total'),
            ])
            ->groupBy('categories.id', 'categories.name')
            // Maior gasto primeiro — ideal para gráficos de pizza/barra
            ->orderByDesc('total');

        return $query->get()
            ->map(fn($row) => [
                'categoria' => $row->categoria,
                'total'     => (float) $row->total,
            ])
            ->toArray();
    }
}