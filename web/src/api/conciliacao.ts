import { api } from "../api-client";
import type { Conciliacao, PainelFechamento, RevisaoConciliacao, RevisaoResponse } from "../types/conciliacao";

export async function getPainelFechamento(mes?: string) {
  const response = await api.get<{ data: PainelFechamento }>("/conciliacoes/painel", { params: mes ? { mes } : {} });
  return response.data;
}

export async function getConciliacoes(contaId?: number) {
  const response = await api.get<{ data: Conciliacao[] }>("/conciliacoes", { params: contaId ? { conta_id: contaId } : {} });
  return response.data;
}

export async function getConciliacao(id: number) {
  const response = await api.get<{ data: RevisaoConciliacao }>(`/conciliacoes/${id}`);
  return response.data;
}

export async function enviarExtrato(dados: { arquivo: File; conta_id?: number; mes?: string; lembrar_conta?: boolean }) {
  const formData = new FormData();
  formData.append("arquivo", dados.arquivo);
  if (dados.conta_id) formData.append("conta_id", String(dados.conta_id));
  if (dados.mes) formData.append("mes", dados.mes);
  if (dados.lembrar_conta) formData.append("lembrar_conta", "1");

  const response = await api.post<RevisaoResponse>("/conciliacoes", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function excluirConciliacao(id: number) {
  const response = await api.delete<{ message: string }>(`/conciliacoes/${id}`);
  return response.data;
}

/** Ações sobre a conciliação: todas devolvem a revisão inteira já atualizada. */
const acao = async (url: string, dados?: object) => (await api.post<RevisaoResponse>(url, dados ?? {})).data;

export const acoesConciliacao = {
  reconferir: (id: number) => acao(`/conciliacoes/${id}/reconferir`),
  aceitarSugestoes: (id: number, ids?: number[]) => acao(`/conciliacoes/${id}/aceitar-sugestoes`, ids ? { ids } : {}),
  finalizar: (id: number, observacao?: string) => acao(`/conciliacoes/${id}/finalizar`, { observacao }),
  reabrir: (id: number) => acao(`/conciliacoes/${id}/reabrir`),
  manterSoNoApp: (id: number, chaves: string[], note: string) => acao(`/conciliacoes/${id}/so-no-app/manter`, { chaves, note }),
  soNoAppPendente: (id: number, chave: string) => acao(`/conciliacoes/${id}/so-no-app/pendente`, { chave }),

  vincular: (id: number, itemId: number, dados: { chave: string; ajustar_valor?: boolean; ajustar_data?: boolean }) =>
    acao(`/conciliacoes/${id}/itens/${itemId}/vincular`, dados),
  lancar: (id: number, itemId: number, dados: { description?: string; category_id?: number | null; category_name?: string; budget_id?: number | null }) =>
    acao(`/conciliacoes/${id}/itens/${itemId}/lancar`, dados),
  pagamentoFatura: (id: number, itemId: number, dados: { invoice_id: number; ajuste_descricao?: string; category_id?: number | null }) =>
    acao(`/conciliacoes/${id}/itens/${itemId}/pagamento-fatura`, dados),
  transferencia: (id: number, itemId: number, dados: { conta_id: number; description?: string }) =>
    acao(`/conciliacoes/${id}/itens/${itemId}/transferencia`, dados),
  adiar: (id: number, itemId: number, note?: string) => acao(`/conciliacoes/${id}/itens/${itemId}/adiar`, { note }),
  ignorar: (id: number, itemId: number, note: string) => acao(`/conciliacoes/${id}/itens/${itemId}/ignorar`, { note }),
  desfazer: (id: number, itemId: number) => acao(`/conciliacoes/${id}/itens/${itemId}/desfazer`),
};
