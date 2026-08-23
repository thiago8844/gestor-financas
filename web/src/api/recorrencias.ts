import { api } from "../api-client";
import type { RecorrenciaForm } from "../schemas/recorrencia";
import type { RecorrenciaTransacaoResponse, RecorrenciasResponse } from "../types/recorrencia";

export async function getRecorrencias(filtros?: { type?: "EXPENSE" | "INCOME" }) {
  const response = await api.get<RecorrenciasResponse>("/recorrencias", {
    params: { ...filtros },
  });

  return response.data;
}

export async function getRecorrencia(id: number) {
  const response = await api.get<RecorrenciaTransacaoResponse>(`/recorrencias/${id}`);
  return response.data;
}

export async function criarRecorrencia(data: RecorrenciaForm) {
  const response = await api.post("/recorrencias/criar", { ...data });
  return response.status;
}

export async function updateRecorrencia(id: number, data: RecorrenciaForm) {
  const response = await api.put(`/recorrencias/atualizar/${id}`, { ...data });
  return response.data;
}

export async function deletarRecorrencia(id: number) {
  const response = await api.delete(`/recorrencias/deletar/${id}`);
  return response.status;
}

export async function alternarAtivoRecorrencia(id: number) {
  const response = await api.patch(`/recorrencias/${id}/alternar-ativo`);
  return response.data;
}
