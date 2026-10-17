import type { Transacao } from "./transacao";

export type StatusFatura = "ABERTA" | "FECHADA" | "VENCIDA" | "PAGA";

/** Uma baixa da fatura numa data (é o que aparece como débito no extrato da conta). */
export type PagamentoFatura = {
  data: string;
  valor: number;
  /** Só vem nas telas de conciliação: a baixa já foi conferida com o extrato. */
  conciliado?: boolean;
};

export type StatusAuditoriaFatura = "CONFERE" | "DIVERGENTE";

/** Auditoria manual: o total que o banco cobrou, comparado com o total da fatura no app. */
export type AuditoriaFatura = {
  id: number;
  invoice_id: number;
  bank_total: number;
  app_total: number;
  difference: number;
  /** Total da fatura no app agora (pode ter mudado depois da auditoria). */
  total_atual: number;
  /** bank_total - total_atual: é isso que diz se confere. */
  diferenca_atual: number;
  status: StatusAuditoriaFatura;
  /** A fatura do app mudou depois que a auditoria foi registrada. */
  alterada_depois: boolean;
  note: string | null;
  created_at: string;
};

export interface Fatura {
  /** null quando é uma prévia da fatura do mês corrente, ainda sem nenhuma despesa lançada. */
  id: number | null;
  card_id: number;
  reference_month: string;
  closing_date: string;
  due_date: string;
  /** Valor da fatura (compras - créditos/estornos + saldo vindo da fatura anterior). */
  total: number;
  /** O que saiu da conta. */
  pago: number;
  pendente: number;
  /** Pagamento parcial: o que não foi pago e foi para a fatura seguinte. */
  levado_para_proxima?: number;
  pagamentos?: PagamentoFatura[];
  status: StatusFatura;
  auditoria?: AuditoriaFatura | null;
  parcelas: Transacao[];
}

/** Uma fatura real (persistida), a única que pode ser paga. */
export type FaturaPagavel = Fatura & { id: number };

/**
 * O mínimo que os modais de lançar/auditar precisam. Serve tanto a Fatura da tela de cartões
 * quanto o resumo de fatura das telas de conciliação.
 */
export type FaturaParaModal = {
  id: number;
  reference_month: string;
  total: number;
  levado_para_proxima?: number;
  auditoria?: AuditoriaFatura | null;
  status?: StatusFatura;
  paga?: boolean;
  pagamentos?: PagamentoFatura[];
};
