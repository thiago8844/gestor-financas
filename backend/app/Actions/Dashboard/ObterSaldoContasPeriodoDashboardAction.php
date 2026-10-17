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
     * @param  int[]|null  $contaIds  contas escolhidas; null/vazio = todas (o patrimônio segue o "incluir no patrimônio").
     *                              Com seleção, o total soma exatamente as contas escolhidas.
     * @return array{contas: array<string, array>, patrimonio: array}
     */
    public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal, TimeIntervals $intervalo, ?array $contaIds = null): array
    {
        $contas = Conta::orderBy('name')
            ->where('user_id', Auth::id())
            ->when($contaIds, fn ($q) => $q->whereIn('id', $contaIds))
            ->get();

        $resultado = SaldoContaPorPeriodoQuery::series(
            $contas->pluck('id')->all(),
            $contas->filter(fn ($conta) => $contaIds || $conta->include_in_networth)->pluck('id')->all(),
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
