import { api } from "../api-client";
import type { DespesaForm } from "../schemas/despesa";
import type { TransacaoResponse } from "../types/transacao";

//DESPESAS

export async function getDespesas(filtros: {
  type: "EXPENSE";
  data_inicial?: string;
  data_final?: string;
  categoria_id?: number;
  conta_id?: number;
  periodo?: string; //TODO: TIPAR DPS
  order_by?: string; //TODO: TIPAR DPS
  page?: number;
  limit?: number;
}) {
  const response = await api.get<TransacaoResponse>("/despesas", {
    params: {
      ...filtros,
    },
  });

  return response.data;
}

// ✅ BUSCAR DESPESA ESPECÍFICA
export async function getDespesa(id: number) {
  const response = await api.get(`/transacoes/${id}`);
  return response.data;
}

// ✅ ATUALIZAR DESPESA
export async function updateDespesa(id: number, data: DespesaForm) {
  const response = await api.put(`/transacoes/atualizar/${id}`, data);
  return response.data;
}

export async function criarDespesa(data: DespesaForm) {
  const response = await api.post("/transacoes/criar", data);
  return response.status;
}

// ✅ FUNÇÃO DE STORE (ALIAS PARA CRIAR)
export const storeDespesa = criarDespesa;

export async function deletarDespesa(id: number) {
  const response = await api.delete(`/transacoes/deletar/${id}`);
  return response.status;
}