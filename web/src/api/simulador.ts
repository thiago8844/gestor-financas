import { api } from "../api-client";
import type {
  CenarioSalvo,
  ConfiguracaoSalva,
  FiltrosSimuladorParams,
  RelatorioSimuladorResponse,
} from "../types/simulador";

export async function simularFinanceiro(filtros: FiltrosSimuladorParams, signal?: AbortSignal) {
  const response = await api.post<RelatorioSimuladorResponse>("/relatorios/simulador-financeiro", filtros, { signal });
  return response.data;
}

export async function listarCenariosSimulador() {
  const response = await api.get<{ data: CenarioSalvo[] }>("/relatorios/simulador-financeiro/cenarios");
  return response.data.data;
}

export async function salvarCenarioSimulador(dados: { id?: number; name: string; description?: string | null; settings: ConfiguracaoSalva }) {
  const { id, ...corpo } = dados;
  const response = id
    ? await api.put<{ data: CenarioSalvo }>(`/relatorios/simulador-financeiro/cenarios/${id}`, corpo)
    : await api.post<{ data: CenarioSalvo }>("/relatorios/simulador-financeiro/cenarios", corpo);
  return response.data.data;
}

export async function excluirCenarioSimulador(id: number) {
  await api.delete(`/relatorios/simulador-financeiro/cenarios/${id}`);
}
