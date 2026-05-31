<?php

namespace App\Http\Controllers;

use App\Actions\Dashboard\ObterDespesasPorCategoriaAction;
use App\Actions\Dashboard\ObterReceitasPorCategoriaAction;
use App\Actions\Dashboard\ObterIndicadoresDashboardAction;
use App\Actions\Dashboard\ObterSaldoContasPeriodoDashboardAction;
use App\Enums\TimeIntervals;
use Carbon\Carbon;
use Illuminate\Http\Request;


class DashboardController extends Controller
{
    // ---------------------------------------------------------------
    // GET /dashboard/indicadores
    // Retorna os cards de indicadores do mês atual (entradas, saídas, saldo, patrimônio).
    // Sem parâmetros — sempre usa o mês corrente.
    // ---------------------------------------------------------------
    public function indicadores()
    {
        $indicadoresMes = ObterIndicadoresDashboardAction::execute();

        return response()->json($indicadoresMes, 200);
    }

    // ---------------------------------------------------------------
    // GET /dashboard/saldo-contas
    // Retorna o saldo evolutivo por conta ao longo do tempo.
    // Query params:
    //   saldos_contas_alltime          (bool)   — ignora datas e retorna histórico completo
    //   saldos_contas_periodo_inicial  (date)   — início do período
    //   saldos_contas_periodo_final    (date)   — fim do período
    //   saldos_contas_periodo_intervalo (string) — DAILY | WEEKLY | MONTHLY | ...
    // ---------------------------------------------------------------
    public function saldoContas(Request $request)
    {
        $alltime = $request->boolean('saldos_contas_alltime');

        $dataInicial = $alltime ? null : Carbon::parse($request->query('saldos_contas_periodo_inicial'));
        $dataFinal   = $alltime ? null : Carbon::parse($request->query('saldos_contas_periodo_final'));
        $intervalo   = TimeIntervals::from($request->query('saldos_contas_periodo_intervalo', 'MONTHLY'));

        $dados = ObterSaldoContasPeriodoDashboardAction::execute($dataInicial, $dataFinal, $intervalo);

        return response()->json($dados, 200);
    }

    // ---------------------------------------------------------------
    // GET /dashboard/transacoes-categoria
    // Retorna despesas e receitas agrupadas por categoria.
    // Query params:
    //   despesas_categoria_alltime           (bool) — histórico completo de despesas
    //   despesas_categoria_periodo_inicial   (date)
    //   despesas_categoria_periodo_final     (date)
    //   receitas_categoria_alltime           (bool) — histórico completo de receitas
    //   receitas_categoria_periodo_inicial   (date)
    //   receitas_categoria_periodo_final     (date)
    // ---------------------------------------------------------------
    public function transacoesCategoria(Request $request)
    {
        $despesasAlltime = $request->boolean('despesas_categoria_alltime');
        $despesasInicial = $despesasAlltime ? null : Carbon::parse($request->query('despesas_categoria_periodo_inicial'));
        $despesasFinal   = $despesasAlltime ? null : Carbon::parse($request->query('despesas_categoria_periodo_final'));

        $receitasAlltime = $request->boolean('receitas_categoria_alltime');
        $receitasInicial = $receitasAlltime ? null : Carbon::parse($request->query('receitas_categoria_periodo_inicial'));
        $receitasFinal   = $receitasAlltime ? null : Carbon::parse($request->query('receitas_categoria_periodo_final'));

        return response()->json([
            'despesas_por_categoria' => ObterDespesasPorCategoriaAction::execute($despesasInicial, $despesasFinal),
            'receitas_por_categoria' => ObterReceitasPorCategoriaAction::execute($receitasInicial, $receitasFinal),
        ], 200);
    }
}
