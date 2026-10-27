export type DirecaoEmprestimo = "TOMADO" | "CONCEDIDO";
export type ModalidadeEmprestimo = "JUROS_PERIODICOS" | "PRICE" | "SAC" | "PAGAMENTO_UNICO" | "LIVRE";
export type TipoJuros = "SIMPLES" | "COMPOSTO" | "SEM_JUROS";
export type PeriodoTaxa = "DIA" | "MES" | "ANO";
export type FrequenciaEmprestimo = "MENSAL" | "QUINZENAL" | "SEMANAL" | "ANUAL";
export type AjusteDia = "ULTIMO_DIA_MES" | "PROXIMO_DIA" | "ULTIMO_DIA_UTIL";
export type StatusEmprestimo = "ATIVO" | "QUITADO" | "CANCELADO";
export type StatusParcela = "PREVISTA" | "PARCIAL" | "PAGA" | "CANCELADA";

export type ParcelaEmprestimo = {
  id: number;
  loan_id: number;
  number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  expected_amount: number;
  paid_amount: number;
  remaining_amount: number;
  paid_at: string | null;
  status: StatusParcela;
  overdue: boolean;
  days_overdue: number;
};

export type Emprestimo = {
  id: number;
  direction: DirecaoEmprestimo;
  counterparty: string;
  description: string | null;
  principal: number;
  contract_date: string;
  rate: number;
  rate_period: PeriodoTaxa;
  interest_type: TipoJuros;
  modality: ModalidadeEmprestimo;
  frequency: FrequenciaEmprestimo;
  due_day: number | null;
  due_day_adjustment: AjusteDia;
  first_due_date: string;
  installments: number | null;
  grace_installments: number;
  open_term: boolean;
  account_id: number | null;
  category_id: number | null;
  status: StatusEmprestimo;
  notes: string | null;
  created_at: string;
  conta?: { id: number; name: string } | null;
  categoria?: { id: number; name: string } | null;
  // Presentes quando as parcelas vêm carregadas (listagem e detalhe).
  installments_paid?: number;
  installments_total?: number;
  installments_overdue?: number;
  principal_balance?: number;
  remaining_total?: number;
  paid_total?: number;
  interest_total?: number;
  next_installment?: ParcelaEmprestimo | null;
  parcelas?: ParcelaEmprestimo[];
};

export type ParcelaLivre = {
  due_date: string;
  principal_amount: number;
  interest_amount: number;
};

export type EmprestimoPayload = {
  direction: DirecaoEmprestimo;
  counterparty: string;
  description: string | null;
  principal: number;
  contract_date: string;
  interest_type: TipoJuros;
  rate: number;
  rate_period: PeriodoTaxa;
  modality: ModalidadeEmprestimo;
  frequency: FrequenciaEmprestimo;
  due_day: number | null;
  due_day_adjustment: AjusteDia;
  first_due_date: string;
  installments: number | null;
  grace_installments: number;
  custom_installments?: ParcelaLivre[];
  account_id: number | null;
  movimentar_conta: boolean;
  notes: string | null;
};

export type PreviaParcela = {
  number: number;
  due_date: string;
  principal_amount: number;
  interest_amount: number;
  expected_amount: number;
};

export type PreviaEmprestimo = {
  open_term: boolean;
  total_interest: number;
  total_amount: number;
  installments: PreviaParcela[];
};

export type ResumoProximoVencimento = {
  loan_id: number;
  installment_id: number;
  number: number;
  counterparty: string;
  direction: DirecaoEmprestimo;
  due_date: string;
  amount: number;
  overdue: boolean;
};

export type ResumoEmprestimos = {
  eu_devo: { contratos: number; saldo_principal: number; total_restante: number };
  me_devem: { contratos: number; saldo_principal: number; total_restante: number };
  atrasadas: { quantidade: number; valor: number };
  proximos_vencimentos: ResumoProximoVencimento[];
};

export type EventoEmprestimo = {
  id: number;
  installment_id: number | null;
  type: string;
  message: string;
  created_at: string;
};

export type BaixaParcelaPayload = {
  amount?: number | null;
  paid_at?: string | null;
  account_id?: number | null;
};

export type TipoAjuste = "AMORTIZACAO" | "AUMENTO";
export type ModoAjuste = "MANTER_PRAZO" | "MANTER_PARCELA";

export type AjustePayload = {
  type: TipoAjuste;
  amount: number;
  date: string;
  mode?: ModoAjuste;
  installments?: number | null;
  account_id?: number | null;
  movimentar_conta?: boolean;
};

export type SimulacaoAjuste = {
  balance_before: number;
  balance_after: number;
  accrued_interest: number;
  amount_to_post: number;
  installments_before: number;
  installments_after: number;
  next_amount_before: number | null;
  next_amount_after: number | null;
  end_date_before: string | null;
  end_date_after: string | null;
  interest_before: number;
  interest_after: number;
  interest_difference: number;
  installments: PreviaParcela[];
};

export type LancamentoEmprestimo = {
  id: number;
  description: string | null;
  type: "EXPENSE" | "INCOME";
  status: "PENDING" | "PAID";
  amount: number;
  date: string | null;
  account: { id: number; name: string } | null;
  installment_id: number | null;
  kind: "PRINCIPAL" | "PARCELA" | "AJUSTE";
};
