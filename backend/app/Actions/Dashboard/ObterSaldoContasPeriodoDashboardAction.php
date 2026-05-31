<?php

namespace App\Actions\Dashboard;

use App\Enums\TimeIntervals;
use App\Models\Conta;
use App\Queries\Dashboard\IndicadoresMesDashboardQuery;
use App\Queries\Dashboard\SaldoContaPorPeriodoQuery;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;


class ObterSaldoContasPeriodoDashboardAction
{
    /**
     * @param  Carbon|null  $dataInicial  null = alltime (desde a 1ª transação)
     * @param  Carbon|null  $dataFinal    null = alltime (até a última transação)
     */
    public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal, TimeIntervals $intervaloDias)
    {

        $contas = Conta::orderBy('name')->where('user_id', Auth::id())->get();
        
        $dadosPorConta = [];

        foreach ($contas as $conta) {
            // copy() evita que startOfDay/endOfDay mutem a instância original
            // a cada iteração do loop, o que causaria datas incorretas.
            $dadosPorConta[$conta->name] = SaldoContaPorPeriodoQuery::query(
                $dataInicial?->copy()->startOfDay(),
                $dataFinal?->copy()->endOfDay(),
                $intervaloDias,
                Auth::id(),
                $conta->id   // filtra as transações por conta
            );
        }

        return $dadosPorConta;
    }
}
