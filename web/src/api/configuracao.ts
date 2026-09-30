import { api } from "../api-client";
import type { Configuracao } from "../types/configuracao";

export async function getConfiguracoes() {
  const response = await api.get<{ data: Configuracao }>("/configuracoes");
  return response.data.data;
}

export async function atualizarConfiguracoes(dados: Configuracao) {
  const response = await api.put<{ data: Configuracao }>("/configuracoes", dados);
  return response.data.data;
}
