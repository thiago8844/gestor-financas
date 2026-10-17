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
  conta_ids?: number[];
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
  conta_ids?: number[];
  regime?: RegimeRelatorio;
  comparar_com?: ComparacaoRelatorio;
};

// --- Compromissos Futuros ---

export type OrigemCompromisso = "FATURA" | "PARCELA" | "RECORRENTE" | "LANCAMENTO";
export type ConfiancaEstimativa = "ALTA" | "MEDIA" | "BAIXA";

export type ItemFaturaProjetada = {
  transacao_id: number | null;
  descricao: string;
  categoria: string | null;
  data_compra: string | null;
  parcela: string | null;
  recorrente: boolean;
  /** Ainda não existe como lançamento: veio de uma recorrência futura. */
  projetado: boolean;
  valor: number | null;
  estimado: boolean;
  desvio: number | null;
  confianca: ConfiancaEstimativa | null;
};

export type EventoCompromisso = {
  id: string;
  /** Data considerada na projeção (vencidos aparecem em "hoje"). */
  data: string;
  data_original: string;
  atrasado: boolean;
  tipo: "INCOME" | "EXPENSE";
  origem: OrigemCompromisso;
  descricao: string;
  /** null = recorrência de valor variável ainda sem valor. */
  valor: number | null;
  estimado: boolean;
  desvio: number | null;
  confianca: ConfiancaEstimativa | null;
  sem_valor: boolean;
  projetado: boolean;
  conta_id: number;
  conta: string | null;
  categoria: string | null;
  parcela: string | null;
  recorrencia_id: number | null;
  fatura: {
    id: number | null;
    cartao_id: number;
    cartao: string;
    referencia: string;
    fechamento: string;
    vencimento: string;
  } | null;
  itens: ItemFaturaProjetada[];
  itens_sem_valor: number;
  saldo_apos: number;
};

export type MesProjecao = {
  mes: string;
  saldo_inicial: number;
  entradas: number;
  saidas: number;
  entradas_estimadas: number;
  saidas_estimadas: number;
  resultado: number;
  saldo_final: number;
  saldo_minimo: number;
  data_saldo_minimo: string | null;
  quantidade: number;
  sem_valor: number;
  /** Desvio acumulado das estimativas até o fim do mês (±). */
  incerteza: number;
};

export type PontoSaldoDiario = { data: string; saldo: number };

export type ContaProjecao = {
  conta_id: number;
  conta: string;
  saldo_inicial: number;
  saldo_final: number;
  menor_saldo: number;
  data_menor_saldo: string;
  fica_negativa: boolean;
};

export type AlertaSaldoNegativo = {
  /** null = saldo total das contas selecionadas. */
  conta_id: number | null;
  conta: string;
  data: string;
  saldo: number;
  menor_saldo: number;
  data_menor_saldo: string;
  volta_ao_positivo_em: string | null;
  evento: { descricao: string; valor: number } | null;
};

export type ComposicaoSaidas = {
  origem: OrigemCompromisso;
  total: number;
  quantidade: number;
};

export type ResumoCompromissosFuturos = {
  saldo_atual: number;
  a_receber: number;
  a_pagar: number;
  resultado: number;
  saldo_final: number;
  menor_saldo: { valor: number; data: string };
  comprometido_percentual: number | null;
  estimado: { a_receber: number; a_pagar: number };
  sem_valor: number;
  atrasados: { quantidade: number; a_pagar: number; a_receber: number };
  quantidade: number;
  composicao_saidas: ComposicaoSaidas[];
};

/** AMBOS = receitas e despesas (resultado livre); DESPESAS = pagar tudo hoje; RECEITAS = só entradas. */
export type TipoProjecao = "AMBOS" | "DESPESAS" | "RECEITAS";

/**
 * De onde vêm os compromissos: LANCADAS = o que já está lançado como pendente (avulsas, parcelas, faturas e
 * recorrências já geradas); RECORRENCIAS = só ocorrências futuras que o sistema ainda não lançou.
 */
export type FonteProjecao = "TODAS" | "LANCADAS" | "RECORRENCIAS";

export type RelatorioCompromissosFuturos = {
  periodo: { data_inicial: string; data_final: string };
  estimar_variaveis: boolean;
  tipos: TipoProjecao;
  fonte: FonteProjecao;
  resumo: ResumoCompromissosFuturos;
  meses: MesProjecao[];
  serie_diaria: PontoSaldoDiario[];
  contas: ContaProjecao[];
  alertas: AlertaSaldoNegativo[];
  eventos: EventoCompromisso[];
};

export type RelatorioCompromissosFuturosResponse = {
  data: RelatorioCompromissosFuturos;
};

export type FiltrosCompromissosFuturosParams = {
  data_final: string;
  conta_ids?: number[];
  estimar_variaveis?: boolean;
  tipos?: TipoProjecao;
  fonte?: FonteProjecao;
};

// -=-=-=- ANÁLISE DOS GASTOS -=-=-=-

export type NaturezaGasto = "FIXA" | "FIXA_VARIAVEL" | "VARIAVEL" | "PARCELADA";
export type SituacaoGasto = "PAGO" | "PENDENTE" | "PREVISTO";
export type BaseDataGastos = "GASTO" | "PAGAMENTO";
export type OrigemGastos = "TODAS" | "CONTA" | "CARTAO";

export type SomasGasto = {
  total: number;
  pago: number;
  pendente: number;
  /** Recorrência futura que ainda não virou lançamento. */
  previsto: number;
  quantidade: number;
};

export type LancamentoGasto = {
  id: number | null;
  data: string;
  data_gasto: string;
  data_pagamento: string;
  descricao: string;
  valor: number | null;
  natureza: NaturezaGasto;
  situacao: SituacaoGasto;
  estimado: boolean;
  categoria_id: number | null;
  categoria: string;
  conta_id: number;
  conta: string | null;
  cartao: string | null;
  parcela: string | null;
  grupo_parcelas: string | null;
  recorrencia_id: number | null;
  recorrencia: string | null;
};

export type ResumoGastos = SomasGasto & {
  percentual_pago: number | null;
  sem_valor: number;
  media_mensal: number;
  media_diaria: number;
  ticket_medio: number | null;
  maior: { descricao: string; valor: number; data: string; categoria: string } | null;
  fixos: number;
  fixos_mensal: number;
  rigidez_percentual: number | null;
  receitas: number;
  comprometimento_receitas: number | null;
  no_cartao: number;
  na_conta: number;
  estimado: number;
  anterior: number | null;
  variacao_percentual: number | null;
};

export type GastoPorNatureza = SomasGasto & {
  natureza: NaturezaGasto;
  percentual: number | null;
  media_mensal: number;
  no_cartao: number;
  na_conta: number;
  estimado: number;
  anterior: number | null;
  variacao_percentual: number | null;
};

export type GastoPorCategoria = SomasGasto & {
  categoria_id: number | null;
  categoria: string;
  percentual: number | null;
  naturezas: Record<NaturezaGasto, number>;
  no_cartao: number;
  anterior: number | null;
  variacao_percentual: number | null;
};

export type GastoPorMes = SomasGasto & {
  mes: string;
  naturezas: Record<NaturezaGasto, number>;
};

export type GastoPorMeio = SomasGasto & {
  tipo: "CARTAO" | "CONTA";
  nome: string;
  percentual: number | null;
};

export type RecorrenciaGasto = SomasGasto & {
  recorrencia_id: number;
  descricao: string;
  natureza: "FIXA" | "FIXA_VARIAVEL";
  categoria: string;
  meio: string | null;
  no_cartao: boolean;
  ocorrencias: number;
  media: number;
  minimo: number;
  maximo: number;
};

export type ParcelamentoGasto = SomasGasto & {
  descricao: string;
  categoria: string;
  meio: string | null;
  no_cartao: boolean;
  parcelas_no_periodo: number;
  primeira: string | null;
  ultima: string | null;
};

export type RelatorioAnaliseGastos = {
  periodo: { data_inicial: string; data_final: string; dias: number };
  filtros: { base_data: BaseDataGastos; origem: OrigemGastos; estimar_variaveis: boolean; comparar: boolean };
  resumo: ResumoGastos;
  por_natureza: GastoPorNatureza[];
  por_categoria: GastoPorCategoria[];
  por_mes: GastoPorMes[];
  por_meio: GastoPorMeio[];
  recorrencias: RecorrenciaGasto[];
  parcelamentos: ParcelamentoGasto[];
  maiores: LancamentoGasto[];
  lancamentos: LancamentoGasto[];
  lancamentos_truncados: boolean;
};

export type RelatorioAnaliseGastosResponse = { data: RelatorioAnaliseGastos };

export type FiltrosAnaliseGastosParams = {
  data_inicial: string;
  data_final: string;
  conta_ids?: number[];
  base_data?: BaseDataGastos;
  origem?: OrigemGastos;
  estimar_variaveis?: boolean;
  comparar?: boolean;
};
