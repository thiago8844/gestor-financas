import { api } from "../api-client";
import type { AuditoriaFatura, Fatura } from "../types/fatura";

export async function getFaturasDoCartao(cartaoId: number) {
  const response = await api.get<{ data: Fatura[] }>(`/cartoes/${cartaoId}/faturas`);
  return response.data;
}

/** Sem `amount` paga o pendente inteiro; com um valor menor é pagamento parcial (o resto vai para a próxima fatura). */
export async function pagarFatura(faturaId: number, date: string, amount?: number) {
  const response = await api.post<{ data: Fatura; message: string }>(`/faturas/${faturaId}/pagar`, {
    date,
    ...(amount !== undefined ? { amount } : {}),
  });
  return response.data;
}

export async function reverterPagamentoFatura(faturaId: number) {
  const response = await api.post<{ data: Fatura; message: string }>(`/faturas/${faturaId}/reverter`);
  return response.data;
}

export type LancamentoNaFatura = {
  type: "EXPENSE" | "INCOME";
  amount: number;
  description: string;
  accrual_date?: string;
  category_id?: number | null;
  category_name?: string;
};

/** Despesa ou crédito/estorno direto numa fatura (se ela já está paga, entra como pago). */
export async function lancarNaFatura(faturaId: number, dados: LancamentoNaFatura) {
  const response = await api.post<{ data: Fatura; message: string }>(`/faturas/${faturaId}/lancamentos`, dados);
  return response.data;
}

export async function getAuditoriasFatura(faturaId: number) {
  const response = await api.get<{ data: AuditoriaFatura[] }>(`/faturas/${faturaId}/auditorias`);
  return response.data;
}

export async function auditarFatura(faturaId: number, dados: { bank_total: number; note?: string }) {
  const response = await api.post<{ data: AuditoriaFatura; message: string }>(`/faturas/${faturaId}/auditorias`, dados);
  return response.data;
}

/** Ajusta à mão o fechamento da fatura e realoca despesas para a seguinte. Sem data, volta à regra do cartão. */
export async function ajustarFechamentoFatura(faturaId: number, closingDate?: string) {
  const response = await api.put<{ data: Fatura; message: string }>(
    `/faturas/${faturaId}/fechamento`,
    closingDate ? { closing_date: closingDate } : {}
  );
  return response.data;
}
