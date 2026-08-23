import type { Conta } from ".";
import type { Categoria } from "./transacao";

export type FrequenciaRecorrencia = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type RecorrenciaTransacao = {
  id: number;
  user_id: number;
  account_id: number;
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
};

export type RecorrenciaTransacaoResponse = {
  data: RecorrenciaTransacao;
  message?: string;
};

export type RecorrenciasResponse = {
  data: RecorrenciaTransacao[];
};
