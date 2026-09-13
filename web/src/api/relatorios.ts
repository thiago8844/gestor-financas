import { api } from "../api-client";
import type { FiltrosFluxoCaixaParams, RelatorioFluxoCaixaResponse } from "../types/relatorio";

export async function getRelatorioFluxoCaixa(filtros: FiltrosFluxoCaixaParams) {
  const response = await api.get<RelatorioFluxoCaixaResponse>("/relatorios/fluxo-de-caixa", {
    params: filtros,
  });

  return response.data;
}
