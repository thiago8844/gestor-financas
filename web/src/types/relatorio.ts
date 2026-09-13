import type { Transacao } from "./transacao";

export type RegimeRelatorio = "CAIXA" | "COMPETENCIA";
export type ComparacaoRelatorio = "NENHUM" | "PERIODO_ANTERIOR" | "MESMO_PERIODO_ANO_ANTERIOR";
export type AgrupamentoRelatorio = "DAILY" | "WEEKLY" | "MONTHLY";

export type ComparacaoResumo = {
  periodo_inicio: string;
  periodo_fim: string;
  resultado_liquido: number;
  variacao_percentual: number | null;
};

export type ResumoFluxoCaixa = {
  saldo_inicial: number;
  entradas: number;
  saidas: number;
  resultado_liquido: number;
  saldo_final: number;
  comparacao: ComparacaoResumo | null;
};

export type PontoFluxoCaixa = {
  periodo: string;
  entradas: number;
  saidas: number;
  saldo_periodo: number;
  saldo_acumulado: number;
  transacoes: Transacao[];
};

export type RelatorioFluxoCaixa = {
  resumo: ResumoFluxoCaixa;
  serie: PontoFluxoCaixa[];
  lancamentos: Transacao[];
};

export type RelatorioFluxoCaixaResponse = {
  data: RelatorioFluxoCaixa;
};

export type FiltrosFluxoCaixaParams = {
  data_inicial: string;
  data_final: string;
  conta_id?: number;
  regime?: RegimeRelatorio;
  comparar_com?: ComparacaoRelatorio;
  agrupamento?: AgrupamentoRelatorio;
  category_id?: number;
  budget_id?: number;
  type?: "INCOME" | "EXPENSE";
  status?: "PAID" | "PENDING";
  valor_minimo?: number;
  valor_maximo?: number;
  descricao?: string;
};

// --- Resultado Financeiro ---

export type LinhaCategoriaResultado = {
  categoria_id: number | null;
  categoria: string;
  total: number;
  percentual: number | null;
  periodo_anterior: number | null;
  variacao_percentual: number | null;
  transacoes: Transacao[];
};

export type ComparacaoResumoResultado = {
  periodo_inicio: string;
  periodo_fim: string;
  resultado: number;
  variacao_percentual: number | null;
};

export type ResumoResultadoFinanceiro = {
  receitas: number;
  despesas: number;
  resultado: number;
  margem: number | null;
  comparacao: ComparacaoResumoResultado | null;
};

export type PontoMensalResultado = {
  periodo: string;
  receitas: number;
  despesas: number;
};

export type RelatorioResultadoFinanceiro = {
  resumo: ResumoResultadoFinanceiro;
  receitas: LinhaCategoriaResultado[];
  despesas: LinhaCategoriaResultado[];
  serie_mensal: PontoMensalResultado[];
};

export type RelatorioResultadoFinanceiroResponse = {
  data: RelatorioResultadoFinanceiro;
};

export type FiltrosResultadoFinanceiroParams = {
  data_inicial: string;
  data_final: string;
  conta_id?: number;
  regime?: RegimeRelatorio;
  comparar_com?: ComparacaoRelatorio;
};
