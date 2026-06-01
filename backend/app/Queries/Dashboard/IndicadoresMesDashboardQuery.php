<?php

namespace App\Queries\Dashboard;

use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class IndicadoresMesDashboardQuery
{
    public static function query(int $userId, Carbon $dataInicial, Carbon $dataFinal): array
    {
        
        $row = DB::table('transactions')
            ->where('status', 'PAID')
            ->where('user_id', $userId)
            ->where('is_initial_balance', false)
            ->whereBetween('date', [$dataInicial->toDateString(), $dataFinal->toDateString()])
            ->selectRaw("
            SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS total_in,
            SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS total_out,
            SUM(
                CASE 
                    WHEN type = 'INCOME' THEN amount 
                    WHEN type = 'EXPENSE' THEN -amount 
                    ELSE 0 
                END
            ) AS net_total
            ")->first();

        return [
            'entrada' => (float) ($row->total_in ?? 0),
            'saida' => (float) ($row->total_out ?? 0),
            'saldo' => (float) ($row->net_total ?? 0),
        ];

    }
}