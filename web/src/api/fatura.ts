import { api } from "../api-client";
import type { Fatura } from "../types/fatura";

export async function getFaturasDoCartao(cartaoId: number) {
  const response = await api.get<{ data: Fatura[] }>(`/cartoes/${cartaoId}/faturas`);
  return response.data;
}

export async function pagarFatura(faturaId: number, date: string) {
  const response = await api.post<{ data: Fatura; message: string }>(`/faturas/${faturaId}/pagar`, { date });
  return response.data;
}

export async function reverterPagamentoFatura(faturaId: number) {
  const response = await api.post<{ data: Fatura; message: string }>(`/faturas/${faturaId}/reverter`);
  return response.data;
}
