import { api } from "../api-client";
import type {
  FiltrosFluxoCaixaParams,
  FiltrosResultadoFinanceiroParams,
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
