import type { Transacao } from "./transacao";

export type StatusFatura = "ABERTA" | "FECHADA" | "VENCIDA" | "PAGA";

export interface Fatura {
  /** null quando é uma prévia da fatura do mês corrente, ainda sem nenhuma despesa lançada. */
  id: number | null;
  card_id: number;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total: number;
  pago: number;
  pendente: number;
  status: StatusFatura;
  parcelas: Transacao[];
}

/** Uma fatura real (persistida), a única que pode ser paga. */
export type FaturaPagavel = Fatura & { id: number };
