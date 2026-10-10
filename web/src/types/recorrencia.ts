import type { Conta } from ".";
import type { Cartao } from "./cartao";
import type { Categoria } from "./transacao";

export type FrequenciaRecorrencia = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type RecorrenciaTransacao = {
  id: number;
  user_id: number;
  account_id: number;
  card_id: number | null;
  category_id: number | null;
  type: "EXPENSE" | "INCOME";
  description: string;
  amount: number | null;
  default_status: "PENDING" | "PAID";
  frequency: FrequenciaRecorrencia;
  interval: number;
  days_of_week: number[] | null;
  day_of_month: number | null;
  month_of_year: number | null;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  active: boolean;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
  categoria: Categoria | null;
  conta: Conta | null;
  cartao: Cartao | null;
};

export type RecorrenciaTransacaoResponse = {
  data: RecorrenciaTransacao;
  message?: string;
};

export type RecorrenciasResponse = {
  data: RecorrenciaTransacao[];
};

/** Lançamento passado que pode ser vinculado a uma recorrência (forma de TransacaoResource). */
export type LancamentoVinculavel = {
  id: number;
  description: string | null;
  amount: number;
  type: "EXPENSE" | "INCOME";
  status: "PENDING" | "PAID";
  date_raw: string | null;
  due_date_raw: string | null;
  purchase_date: string | null;
  categoria: Categoria | null;
  conta: Conta | null;
  cartao: Cartao | null;
};
