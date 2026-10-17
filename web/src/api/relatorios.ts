import { api } from "../api-client";
import type {
  FiltrosAnaliseGastosParams,
  FiltrosCompromissosFuturosParams,
  FiltrosFluxoCaixaParams,
  FiltrosResultadoFinanceiroParams,
  RelatorioAnaliseGastosResponse,
  RelatorioCompromissosFuturosResponse,
  RelatorioFluxoCaixaResponse,
  RelatorioResultadoFinanceiroResponse,
} from "../types/relatorio";

export async function getRelatorioFluxoCaixa(filtros: FiltrosFluxoCaixaParams) {
  const response = await api.get<RelatorioFluxoCaixaResponse>("/relatorios/fluxo-de-caixa", {
    params: filtros,
  });

  return response.data;
}

export async function getRelatorioResultadoFinanceiro(filtros: FiltrosResultadoFinanceiroParams) {
  const response = await api.get<RelatorioResultadoFinanceiroResponse>("/relatorios/resultado-financeiro", {
    params: filtros,
  });

  return response.data;
}

export async function getRelatorioCompromissosFuturos(filtros: FiltrosCompromissosFuturosParams) {
  const response = await api.get<RelatorioCompromissosFuturosResponse>("/relatorios/compromissos-futuros", {
    // O backend valida "boolean" (aceita 1/0, não "true"/"false").
    params: { ...filtros, estimar_variaveis: filtros.estimar_variaveis ? 1 : 0 },
  });

  return response.data;
}

export async function getRelatorioAnaliseGastos(filtros: FiltrosAnaliseGastosParams) {
  const response = await api.get<RelatorioAnaliseGastosResponse>("/relatorios/analise-gastos", {
    // O backend valida "boolean" (aceita 1/0, não "true"/"false").
    params: { ...filtros, estimar_variaveis: filtros.estimar_variaveis ? 1 : 0, comparar: filtros.comparar ? 1 : 0 },
  });

  return response.data;
}
