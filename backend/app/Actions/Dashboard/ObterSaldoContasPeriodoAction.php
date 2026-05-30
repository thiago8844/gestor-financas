<?php

namespace App\Actions\Dashboard;

use App\Models\Conta;
use App\Queries\Dashboard\IndicadoresMesDashboardQuery;
use App\Queries\Dashboard\SaldoContaPorPeriodoQuery;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class ObterSaldoContasPeriodoDashboardAction
{
    public static function execute(Carbon $dataInicial, Carbon $dataFinal, int $intervaloDias)
    {
        
        $contas = Conta::orderBy('nome')->where('user_id', Auth::id())->get();

        $dadosPorConta = [];

        foreach($contas as $conta) {
            $conta = SaldoContaPorPeriodoQuery::query($dataInicial->startOfDay(), $dataFinal->endOfDay(), $intervaloDias, Auth::id());
        }


    }
}