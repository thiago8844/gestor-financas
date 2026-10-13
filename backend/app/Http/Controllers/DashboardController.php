<?php

namespace App\Http\Controllers;

use App\Actions\Dashboard\ObterDespesasFuturasDashboardAction;
use App\Actions\Dashboard\ObterDespesasPorCategoriaAction;
use App\Actions\Dashboard\ObterFaturaAtualDashboardAction;
use App\Actions\Dashboard\ObterReceitasPorCategoriaAction;
use App\Actions\Dashboard\ObterIndicadoresDashboardAction;
use App\Actions\Dashboard\ObterSaldoContasPeriodoDashboardAction;
use App\Enums\TimeIntervals;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;


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
    // GET /dashboard/fatura-atual
    // Retorna a fatura do próximo vencimento, só quando o usuário tem exatamente 1 cartão
    // cadastrado. Retorna null quando não se aplica (0 ou 2+ cartões).
    // Query params:
    //   offset (int) — navega ±3 faturas a partir da do próximo vencimento (0 = padrão)
    // ---------------------------------------------------------------
    public function faturaAtual(Request $request)
    {
        $offset = (int) $request->query('offset', 0);

        return response()->json(ObterFaturaAtualDashboardAction::execute($offset), 200);
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

        $contaId = $request->filled('conta_id') ? (int) $request->query('conta_id') : null;

        return response()->json([
            'despesas_por_categoria' => ObterDespesasPorCategoriaAction::execute($despesasInicial, $despesasFinal, $contaId),
            'receitas_por_categoria' => ObterReceitasPorCategoriaAction::execute($receitasInicial, $receitasFinal, $contaId),
        ], 200);
    }

    // ---------------------------------------------------------------
    // GET /dashboard/despesas-futuras
    // Quanto ainda vai sair de hoje até data_final, separado em parcelas, recorrências e outras.
    // Query params:
    //   data_final (date) — hoje ou futura, até 5 anos à frente
    // ---------------------------------------------------------------
    public function despesasFuturas(Request $request)
    {
        $dados = $request->validate([
            'data_final' => 'required|date|after_or_equal:today|before_or_equal:' . now()->addYears(5)->toDateString(),
        ]);

        return response()->json(
            ObterDespesasFuturasDashboardAction::execute(Auth::id(), Carbon::parse($dados['data_final'])),
            200
        );
    }
}
