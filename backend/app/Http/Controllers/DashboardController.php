<?php

namespace App\Http\Controllers;

use App\Models\Conta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {


        $user = Auth::user();

        $inicioMes = now()->startOfMonth()->toDateString();
        $fimMes = now()->endOfMonth()->toDateString();

        $totais = DB::table('transactions')
            ->where('user_id', $user->id)
            ->whereBetween('date', [$inicioMes, $fimMes])
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
            ")
            ->first();
        $totais = collect($totais);

        $entrada  = $totais->get('total_in');
        $saida = $totais->get('total_out');
        $entradaMenosSaida = $totais->get('net_total');

        $patrimonioLiquido = 0;
        $contas = Conta::where('user_id', $user->id)->get();


        $patrimonioLiquido = $contas->sum(function ($conta) {
            return $conta->include_in_networth ? $conta->saldo : 0;
        });

        return response()->json([
            'entrada' => $entrada,
            'saida' => $saida,
            'entrada_menos_saida' => $entradaMenosSaida,
            'patrimonio_liquido' => $patrimonioLiquido,
        ], 200);
    }
}
