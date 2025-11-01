import { api } from "../api-client";
import type { ContaForm } from "../schemas/conta";

export const getContas = async (filtros: {
  active?: boolean;
  tipo?: "EXPENSE" | "INCOME";
}) => {
  const response = await api.get("/contas", { params: filtros });
  console.log(response.data);
  return response.data;
};

export const criarConta = async (conta: ContaForm) => {
  const response = await api.post("/contas/criar", conta);

  return response.status;
};

export const editarConta = async (id: number, conta: ContaForm) => {
  const response = await api.put(`/contas/atualizar/${id}`, conta);

  return response.status;
};

export const buscarConta = async (id: string) => {
  const response = await api.get(`/contas/${id}`);

  console.log('resposta da api: ', response.data.data)
  return response.data.data;
};

export const deletarConta = async (id: number) => {
  const response = await api.delete(`/contas/deletar/${id}`);

  return response.status;
};
