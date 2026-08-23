import { api } from "../api-client";
import type { NotificacoesResponse } from "../types/notificacao";

export async function getNotificacoes(filtros?: { apenas_nao_lidas?: boolean; limit?: number }) {
  const response = await api.get<NotificacoesResponse>("/notificacoes", {
    params: { ...filtros },
  });

  return response.data;
}

export async function marcarNotificacaoComoLida(id: number) {
  const response = await api.patch(`/notificacoes/${id}/marcar-lida`);
  return response.data;
}

export async function marcarTodasNotificacoesComoLidas() {
  const response = await api.patch("/notificacoes/marcar-todas-lidas");
  return response.data;
}
