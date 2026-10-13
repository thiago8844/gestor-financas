<?php

namespace App\Actions\Dashboard;

use App\Models\Conta;
use App\Queries\Dashboard\IndicadoresMesDashboardQuery;
use Illuminate\Support\Facades\Auth;

class ObterIndicadoresDashboardAction
{
    public static function execute()
    {
        $userId = Auth::id();
        $inicioMes = now()->startOfMonth();
        $fimMes = now()->endOfMonth();

        $indicadoresMes = IndicadoresMesDashboardQuery::query($userId, $inicioMes, $fimMes);

        $contasNoPatrimonio = Conta::where('user_id', $userId)->get()->filter(fn ($conta) => $conta->include_in_networth);
        $saldoDisponivel = $contasNoPatrimonio->sum(fn ($conta) => $conta->saldo);

        // Patrimônio = saldo realizado (só transações PAID) das contas que entram no patrimônio.
        // Despesas ainda não pagas não reduzem o patrimônio.
        $patrimonio = $saldoDisponivel;

        return [
          ...$indicadoresMes,
          'patrimonio_liquido' => $patrimonio
        ];
    }
}