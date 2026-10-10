import { api } from "../api-client";
import type { RecorrenciaForm } from "../schemas/recorrencia";
import type {
  LancamentoVinculavel,
  RecorrenciaTransacao,
  RecorrenciaTransacaoResponse,
  RecorrenciasResponse,
} from "../types/recorrencia";
import type { Transacao } from "../types/transacao";

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
  const response = await api.post<{ data: RecorrenciaTransacao; message?: string }>("/recorrencias/criar", { ...data });
  return response.data;
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

export async function getLancamentosCandidatos(id: number) {
  const response = await api.get<{ data: LancamentoVinculavel[] }>(`/recorrencias/${id}/lancamentos-candidatos`);
  return response.data.data;
}

export async function getLancamentosVinculados(id: number) {
  const response = await api.get<{ data: Transacao[] }>(`/recorrencias/${id}/lancamentos`);
  return response.data.data;
}

export async function vincularLancamentos(id: number, transacaoIds: number[]) {
  const response = await api.post(`/recorrencias/${id}/lancamentos`, { transacao_ids: transacaoIds });
  return response.data;
}

export async function desvincularLancamento(id: number, transacaoId: number) {
  const response = await api.delete(`/recorrencias/${id}/lancamentos/${transacaoId}`);
  return response.data;
}
