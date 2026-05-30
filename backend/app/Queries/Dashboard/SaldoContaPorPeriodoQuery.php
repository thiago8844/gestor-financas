<?php

namespace App\Queries\Dashboard;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SaldoContaPorPeriodoQuery
{
    public static function query(Carbon $dataInicial, Carbon $dataFinal, int $intervaloDias, int $userId): array
    {
        
        DB::enableQueryLog();

        DB::table('transactions');


    }

}