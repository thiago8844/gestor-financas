<?php

namespace App\Http\Controllers;

use App\Actions\Relatorios\GerarRelatorioAnaliseGastos;
use App\Actions\Relatorios\GerarRelatorioCompromissosFuturos;
use App\Actions\Relatorios\GerarRelatorioFluxoCaixa;
use App\Actions\Relatorios\GerarRelatorioResultadoFinanceiro;
use App\Actions\Relatorios\GerarSimuladorFinanceiro;
use App\Http\Requests\Relatorios\AnaliseGastosRelatorioRequest;
use App\Http\Requests\Relatorios\CompromissosFuturosRelatorioRequest;
use App\Http\Requests\Relatorios\FluxoCaixaRelatorioRequest;
use App\Http\Requests\Relatorios\ResultadoFinanceiroRelatorioRequest;
use App\Http\Requests\Relatorios\SimuladorFinanceiroRequest;
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

    /**
     * GET /relatorios/compromissos-futuros
     *
     * Projeção do saldo de hoje até `data_final`: parcelas, faturas de cartão, lançamentos
     * pendentes e recorrências futuras aplicados dia a dia ao saldo atual das contas.
     */
    public function compromissosFuturos(CompromissosFuturosRelatorioRequest $request)
    {
        $relatorio = GerarRelatorioCompromissosFuturos::executar(Auth::id(), $request->validated());

        return response()->json(['data' => $relatorio]);
    }

    /**
     * POST /relatorios/simulador-financeiro
     *
     * Projeção completa (compromissos + comportamento estimado pelo histórico) e os cenários base,
     * otimista, pessimista e personalizado. É POST só porque o cenário é um JSON aninhado:
     * nenhuma informação financeira é gravada.
     */
    public function simuladorFinanceiro(SimuladorFinanceiroRequest $request)
    {
        $relatorio = GerarSimuladorFinanceiro::executar(Auth::id(), $request->validated());

        return response()->json(['data' => $relatorio]);
    }

    /**
     * GET /relatorios/analise-gastos
     *
     * Só despesas: divisão em fixas, fixas variáveis, variáveis e parceladas, o que já foi pago,
     * o que falta e o que ainda vai vir de recorrências, por categoria, mês e meio de pagamento.
     */
    public function analiseGastos(AnaliseGastosRelatorioRequest $request)
    {
        $relatorio = GerarRelatorioAnaliseGastos::executar(Auth::id(), $request->validated());

        return response()->json(['data' => $relatorio]);
    }
}
