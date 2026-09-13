<?php

namespace App\Http\Controllers;

use App\Actions\Relatorios\GerarRelatorioFluxoCaixa;
use App\Actions\Relatorios\GerarRelatorioResultadoFinanceiro;
use App\Http\Requests\Relatorios\FluxoCaixaRelatorioRequest;
use App\Http\Requests\Relatorios\ResultadoFinanceiroRelatorioRequest;
use Illuminate\Support\Facades\Auth;

class RelatorioController extends Controller
{
    /**
     * GET /relatorios/fluxo-de-caixa
     *
     * Retorna, num único payload, tudo que as abas Resumo/Tabela/Gráficos/Lançamentos
     * precisam para o mesmo conjunto de filtros — trocar de aba não dispara nova consulta.
     */
    public function fluxoCaixa(FluxoCaixaRelatorioRequest $request)
    {
        $relatorio = GerarRelatorioFluxoCaixa::executar(Auth::id(), $request->validated());

        return response()->json(['data' => $relatorio]);
    }

    /**
     * GET /relatorios/resultado-financeiro
     *
     * Receitas x despesas do período, com a quebra hierárquica por categoria
     * (cada categoria já traz os lançamentos que a compõem).
     */
    public function resultadoFinanceiro(ResultadoFinanceiroRelatorioRequest $request)
    {
        $relatorio = GerarRelatorioResultadoFinanceiro::executar(Auth::id(), $request->validated());

        return response()->json(['data' => $relatorio]);
    }
}
