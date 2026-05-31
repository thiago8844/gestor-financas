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
        $patrimonio = Conta::where('user_id', $userId)->get()->sum(fn($conta) => $conta->include_in_networth ? $conta->saldo: 0);
        
        return [
          ...$indicadoresMes,
          'patrimonio_liquido' => $patrimonio
        ];
    }
}