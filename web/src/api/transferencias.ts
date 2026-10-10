import { api } from "../api-client";
import type { TransferenciaForm } from "../schemas/transferencia";
import type { TransferenciaResponse, TransferenciasResponse } from "../types/transferencia";

export async function getTransferencias(filtros?: {
  conta_id?: number;
  data_inicial?: string;
  data_final?: string;
  page?: number;
  limit?: number;
}) {
  const response = await api.get<TransferenciasResponse>("/transferencias", {
    params: { ...filtros },
  });

  return response.data;
}

export async function getTransferencia(id: number) {
  const response = await api.get<TransferenciaResponse>(`/transferencias/${id}`);
  return response.data;
}

export async function criarTransferencia(data: TransferenciaForm) {
  const response = await api.post("/transferencias/criar", { ...data });
  return response.data;
}

export async function updateTransferencia(id: number, data: TransferenciaForm) {
  const response = await api.put(`/transferencias/atualizar/${id}`, { ...data });
  return response.data;
}

export async function deletarTransferencia(id: number) {
  const response = await api.delete(`/transferencias/deletar/${id}`);
  return response.status;
}
