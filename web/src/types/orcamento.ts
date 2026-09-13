import type { Categoria } from "./transacao";

export type TipoOrcamento = "ONE_TIME" | "RECURRING";
export type FrequenciaOrcamento = "WEEKLY" | "MONTHLY" | "YEARLY";

export type OrcamentoPeriodo = {
  id?: number;
  start_date: string;
  end_date: string;
};

export type Orcamento = {
  id: number;
  name: string;
  description: string | null;
  type: TipoOrcamento;
  amount_limit: number | null;
  alert_percentage: number | null;
  ignore_pending_installments: boolean;
  active: boolean;
  frequency: FrequenciaOrcamento | null;
  interval: number;
  start_date: string | null;
  periodos: OrcamentoPeriodo[];
  created_at: string;
};

export type PeriodoIntervalo = {
  inicio: string;
  fim: string;
};

export type PeriodoPontualComId = {
  id: number;
  inicio: string;
  fim: string;
};

export type GastoPorCategoria = {
  categoria: string;
  total: number;
};

export type TransacaoDoOrcamento = {
  id: number;
  description: string;
  amount: number;
  date: string | null;
  due_date: string | null;
  status: "PENDING" | "PAID";
  categoria: Categoria | null;
  installment_group: string | null;
  installment_number: number | null;
  installment_total: number | null;
};

export type OrcamentoResumo = {
  periodo: PeriodoIntervalo | null;
  periodo_anterior: PeriodoIntervalo | null;
  periodo_seguinte: PeriodoIntervalo | null;
  periodos_pontuais: PeriodoPontualComId[] | null;
  limite: number | null;
  gasto: number;
  disponivel: number | null;
  percentual_utilizado: number | null;
  alerta_atingido: boolean;
  gasto_por_categoria: GastoPorCategoria[];
  transacoes: TransacaoDoOrcamento[];
};

export type OrcamentoComResumo = Orcamento & { resumo: OrcamentoResumo };

export type OrcamentosResponse = {
  data: OrcamentoComResumo[];
};

export type OrcamentoResponse = {
  data: Orcamento;
  resumo: OrcamentoResumo;
  message?: string;
};
