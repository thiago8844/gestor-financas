/** Como o cartão decide o fechamento: dia fixo do mês ou X dias antes do vencimento. */
export type RegraFechamento = "FIXED_DAY" | "DAYS_BEFORE_DUE";

export interface Cartao {
  id: number;
  account_id: number;
  conta_nome?: string | null;
  name: string;
  closing_day: number;
  closing_rule: RegraFechamento;
  closing_days_before_due: number | null;
  due_day: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CriarCartao {
  account_id: number;
  name: string;
  closing_day?: number;
  closing_rule?: RegraFechamento;
  closing_days_before_due?: number | null;
  due_day: number;
  active?: boolean;
}

export interface AtualizarCartao extends Partial<CriarCartao> {
  id: number;
}
