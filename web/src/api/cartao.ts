import { api } from "../api-client";
import type { CartaoForm } from "../schemas/cartao";

export const getCartoes = async (filtros: {
  active?: boolean;
  account_id?: number;
}) => {
  const response = await api.get("/cartoes", { params: filtros });
  return response.data;
};

export const criarCartao = async (cartao: CartaoForm) => {
  const response = await api.post("/cartoes/criar", cartao);

  return response.status;
};

export const editarCartao = async (id: number, cartao: CartaoForm) => {
  const response = await api.put(`/cartoes/atualizar/${id}`, cartao);

  return response.status;
};

export const buscarCartao = async (id: string) => {
  const response = await api.get(`/cartoes/${id}`);

  return response.data.data;
};

export const deletarCartao = async (id: number) => {
  const response = await api.delete(`/cartoes/deletar/${id}`);

  return response.status;
};
