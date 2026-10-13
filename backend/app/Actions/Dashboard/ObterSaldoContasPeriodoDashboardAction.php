<?php

namespace App\Actions\Dashboard;

use App\Enums\TimeIntervals;
use App\Models\Conta;
use App\Queries\Dashboard\SaldoContaPorPeriodoQuery;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class ObterSaldoContasPeriodoDashboardAction
{
    /**
     * @param  Carbon|null  $dataInicial  null = alltime (desde a 1ª transação)
     * @param  Carbon|null  $dataFinal    null = alltime (até hoje / última transação)
     * @return array{contas: array<string, array>, patrimonio: array}
     */
    public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal, TimeIntervals $intervalo): array
    {
        $contas = Conta::orderBy('name')->where('user_id', Auth::id())->get();

        $resultado = SaldoContaPorPeriodoQuery::series(
            $contas->pluck('id')->all(),
            $contas->filter(fn ($conta) => $conta->include_in_networth)->pluck('id')->all(),
            $dataInicial,
            $dataFinal,
            $intervalo,
            Auth::id(),
        );

        $porConta = [];
        foreach ($contas as $conta) {
            $porConta[$conta->name] = $resultado['contas'][$conta->id] ?? [];
        }

        return [
            'contas' => $porConta,
            'patrimonio' => $resultado['total'],
        ];
    }
}
