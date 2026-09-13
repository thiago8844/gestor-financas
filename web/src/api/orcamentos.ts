import { api } from "../api-client";
import type { OrcamentoResponse, OrcamentosResponse } from "../types/orcamento";

export async function getOrcamentos(filtros?: { active?: boolean }) {
  const response = await api.get<OrcamentosResponse>("/orcamentos", {
    params: { ...filtros },
  });

  return response.data;
}

export async function getOrcamento(id: number, filtros?: { data_referencia?: string }) {
  const response = await api.get<OrcamentoResponse>(`/orcamentos/${id}`, {
    params: { ...filtros },
  });

  return response.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function criarOrcamento(data: any) {
  const response = await api.post("/orcamentos/criar", data);
  return response.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateOrcamento(id: number, data: any) {
  const response = await api.put(`/orcamentos/atualizar/${id}`, data);
  return response.data;
}

export async function deletarOrcamento(id: number) {
  const response = await api.delete(`/orcamentos/deletar/${id}`);
  return response.status;
}

export async function alternarAtivoOrcamento(id: number) {
  const response = await api.patch(`/orcamentos/${id}/alternar-ativo`);
  return response.data;
}
