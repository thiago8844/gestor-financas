<?php

namespace App\Http\Controllers;

use App\Actions\Relatorios\GerarRelatorioFluxoCaixa;
use App\Http\Requests\Relatorios\FluxoCaixaRelatorioRequest;
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
}
