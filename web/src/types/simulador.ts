// Tipos do Simulador Financeiro Futuro (POST /relatorios/simulador-financeiro).

export type TipoLancamento = "INCOME" | "EXPENSE";
export type Confianca = "ALTA" | "MEDIA" | "BAIXA";
/** O que o valor é: compromisso registrado, ocorrência futura de recorrência, previsão estatística ou simulação. */
export type Natureza = "CONHECIDO" | "RECORRENCIA" | "ESTIMADO" | "HIPOTETICO" | "FATURA";
export type OrigemSimulacao = "FATURA" | "PARCELA" | "RECORRENTE" | "LANCAMENTO" | "ESTIMADO" | "HIPOTETICO";
export type NomeCenario = "base" | "otimista" | "pessimista" | "personalizado";

// -=-=-=- CENÁRIO (o que o usuário configura) -=-=-=-

export type AlvoAjuste =
  | "CATEGORIA"
  | "DESPESAS_ESTIMADAS"
  | "RECEITAS_ESTIMADAS"
  | "DESPESAS_RECORRENTES"
  | "RECEITAS_RECORRENTES"
  | "RECORRENCIA"
  | "CARTAO";

export type ModoAjuste = "PERCENTUAL" | "DEFINIR" | "DELTA";

export type AjusteCenario = {
  id: string;
  rotulo?: string;
  ativo?: boolean;
  alvo: AlvoAjuste;
  tipo?: TipoLancamento | null;
  categoria_id?: number | null;
  cartao_id?: number | null;
  recorrencia_id?: number | null;
  modo: ModoAjuste;
  valor: number;
  mes_inicio?: string | null;
  mes_fim?: string | null;
};

export type FrequenciaEvento = "WEEKLY" | "MONTHLY" | "YEARLY";

export type EventoHipotetico = {
  id: string;
  ativo?: boolean;
  descricao: string;
  tipo: TipoLancamento;
  valor: number;
  data: string;
  categoria_id?: number | null;
  conta_id?: number | null;
  cartao_id?: number | null;
  parcelas?: number;
  frequencia?: FrequenciaEvento | null;
  data_fim?: string | null;
};

export type CenarioConfig = {
  inflacao_mensal: number;
  ajustes: AjusteCenario[];
  eventos: EventoHipotetico[];
};

export type FiltrosSimuladorParams = {
  data_final: string;
  conta_ids?: number[];
  cartao_ids?: number[];
  meses_historico?: number | null;
  estimar_variaveis: boolean;
  prever_despesas_variaveis: boolean;
  prever_receitas_variaveis: boolean;
  cenario?: CenarioConfig;
};

// -=-=-=- RESULTADO -=-=-=-

export type Partes = { total: number; conhecidas: number; estimadas: number; hipoteticas: number };

export type ResumoSimulacao = {
  saldo_atual: number;
  saldo_final: number;
  resultado: number;
  receitas: Partes;
  despesas: Partes;
  faturas: number;
  comprometimento_confirmado_pct: number | null;
  comprometimento_total_pct: number | null;
  taxa_poupanca_pct: number | null;
  poupanca_mensal_media: number;
  menor_saldo: { valor: number; data: string };
  dias_negativos: number;
  sem_valor: number;
};

export type MesSimulacao = {
  mes: string;
  saldo_inicial: number;
  saldo_final: number;
  saldo_minimo: number;
  data_saldo_minimo: string | null;
  saldo_maximo: number;
  entradas: number;
  saidas: number;
  resultado: number;
  quantidade: number;
  sem_valor: number;
  incerteza: number;
  dias_negativos: number;
  receitas: Partes;
  despesas: Partes & { fora_cartao: { conhecidas: number; estimadas: number; hipoteticas: number } };
  faturas: { total: number; conhecido: number; estimado: number; hipotetico: number };
  comprometimento_confirmado_pct: number | null;
  comprometimento_total_pct: number | null;
};

export type PontoSaldo = { data: string; saldo: number };

export type ResultadoCenario = {
  resumo: ResumoSimulacao;
  meses: MesSimulacao[];
  serie_diaria: PontoSaldo[];
};

export type ItemFaturaSimulacao = {
  descricao: string;
  categoria?: string | null;
  data_compra?: string;
  parcela?: string;
  valor: number | null;
  natureza: Exclude<Natureza, "FATURA">;
  confianca?: Confianca;
  transacao_id?: number;
  evento_id?: string;
  ajustado?: boolean;
};

export type EventoSimulacao = {
  id: string;
  data: string;
  data_original?: string;
  atrasado?: boolean;
  tipo: TipoLancamento;
  origem: OrigemSimulacao;
  natureza: Natureza;
  descricao: string;
  valor: number | null;
  confianca?: Confianca;
  conta_id: number;
  categoria?: string;
  categoria_id?: number;
  parcela?: string;
  recorrencia_id?: number;
  transacao_id?: number;
  evento_id?: string;
  data_estimada?: "PERFIL" | "NEUTRA";
  ajustado?: boolean;
  saldo_apos: number;
  fatura?: {
    id: number | null;
    cartao_id: number;
    cartao: string;
    referencia: string;
    fechamento: string;
    vencimento: string;
  };
  composicao?: { conhecido: number; estimado: number; hipotetico: number };
  itens?: ItemFaturaSimulacao[];
};

export type CategoriaMes = {
  chave: string;
  tipo: TipoLancamento;
  categoria_id: number | null;
  categoria: string;
  total: number;
  meses: { mes: string; conhecido: number; estimado: number; hipotetico: number }[];
};

export type StatusEstimativa = "PROJETADA" | "INSUFICIENTE" | "EVENTUAL";

export type EstatisticasCategoria = {
  meses: number;
  meses_com_valor: number;
  frequencia: number;
  media: number;
  mediana: number;
  minimo: number;
  maximo: number;
  valor_tipico: number | null;
  coeficiente_variacao: number | null;
  tendencia: { classificacao: "ESTAVEL" | "SUBINDO" | "CAINDO"; variacao_mensal_pct: number } | null;
  atipicos: number[];
};

export type CategoriaSimulador = {
  chave: string;
  tipo: TipoLancamento;
  categoria_id: number | null;
  categoria: string;
  status: StatusEstimativa;
  motivo: string | null;
  projetada: boolean;
  metodo: string | null;
  metodo_rotulo: string | null;
  estimativa_mensal: number | null;
  desvio: number | null;
  confianca: Confianca | null;
  estatisticas: EstatisticasCategoria | null;
  validacao: { meses: number; mae: number; wape: number | null; metodos: Record<string, number> } | null;
  historico: { mes: string; valor: number; atipico: boolean; extraordinario: number }[];
  /** Valores isolados muito acima do padrão (herança, venda de bem, compra de carro): fora da previsão. */
  extraordinarios: { data: string; descricao: string; valor: number; futuro: boolean }[];
  perfil: { padrao: "INICIO" | "MEIO" | "FIM" | "DISTRIBUIDO" | "NEUTRO"; pesos: number[] } | null;
  canais: { canal: string; tipo: "CARTAO" | "CONTA"; id: number; nome: string; participacao: number }[];
  projecao: {
    mes: string;
    automatico: number;
    conhecido: number;
    adicional_base: number;
    previsto_cenario: number;
    adicional_cenario: number;
  }[];
};

export type SaldoNegativoRisco = {
  primeira_data: string;
  menor_saldo: number;
  data_menor_saldo: string;
  volta_ao_positivo_em: string | null;
  dias: number;
  contribuintes: { descricao: string; data: string; valor: number; natureza: Natureza }[];
};

export type RiscosSimulacao = {
  saldo_negativo: {
    base: SaldoNegativoRisco | null;
    personalizado: SaldoNegativoRisco | null;
    contas: { conta_id: number; conta: string; data: string; menor_saldo: number; volta_ao_positivo_em: string | null }[];
  };
  comprometimento: {
    mes: string;
    confirmado_pct: number | null;
    total_pct: number | null;
    receitas: number;
    despesas: number;
    nivel: "OK" | "ALTO" | "EXCEDE" | "SEM_RECEITA";
  }[];
  receitas_incertas: {
    estimadas: number;
    percentual: number;
    menor_saldo_sem_elas: number;
    saldo_final_sem_elas: number;
    alerta: boolean;
  };
  meses_atipicos: {
    mes: string;
    despesas: number;
    mediana: number;
    excesso: number;
    principais: { descricao: string; valor: number; data: string }[];
  }[];
  categorias_volateis: {
    chave: string;
    categoria: string;
    estimativa: number;
    desvio: number;
    coeficiente_variacao: number;
    maximo: number;
  }[];
};

export type SensibilidadeItem = {
  id: string;
  rotulo: string;
  ajuste: AjusteCenario;
  impacto_saldo_final: number;
  impacto_menor_saldo: number;
};

export type ImpactoDecisao = {
  id: string;
  rotulo: string;
  impacto_saldo_final: number;
  impacto_menor_saldo: number;
  impacto_receitas: number;
  impacto_despesas: number;
  mensal: { mes: string; diferenca: number }[];
};

export type ContaSimulador = {
  id: number;
  nome: string;
  saldo_atual: number;
  saldo_final: number;
  menor_saldo: number;
  data_menor_saldo: string;
  fica_negativa: boolean;
};

export type CartaoSimulador = {
  id: number;
  nome: string;
  conta_id: number;
  fechamento: number;
  vencimento: number;
  ativo: boolean;
};

export type RelatorioSimulador = {
  periodo: { data_inicial: string; data_final: string; meses: string[] };
  configuracao: {
    estimar_variaveis: boolean;
    prever_despesas_variaveis: boolean;
    prever_receitas_variaveis: boolean;
    meses_historico: number | null;
    historico: { inicio: string | null; meses: number };
  };
  cenario_ativo: boolean;
  contas: ContaSimulador[];
  cartoes: CartaoSimulador[];
  cenarios: Record<NomeCenario, ResultadoCenario>;
  eventos: EventoSimulacao[];
  categorias_mes: CategoriaMes[];
  categorias: CategoriaSimulador[];
  historico: { mes: string; receitas: number; despesas: number; saldo_final: number }[];
  riscos: RiscosSimulacao;
  sensibilidade: SensibilidadeItem[];
  impactos: ImpactoDecisao[];
  confiabilidade: {
    nivel: Confianca;
    percentual_estimado: number;
    confianca_media: number;
    meses_historico: number;
    motivos: string[];
  };
  avisos: string[];
};

export type RelatorioSimuladorResponse = { data: RelatorioSimulador };

// -=-=-=- CENÁRIOS SALVOS -=-=-=-

export type ConfiguracaoSalva = {
  horizonte?: number | string;
  data_final?: string;
  conta_ids?: number[];
  cartao_ids?: number[];
  meses_historico?: number | null;
  estimar_variaveis?: boolean;
  prever_despesas_variaveis?: boolean;
  prever_receitas_variaveis?: boolean;
  cenario?: CenarioConfig;
};

export type CenarioSalvo = {
  id: number;
  name: string;
  description: string | null;
  settings: ConfiguracaoSalva;
  created_at: string;
  updated_at: string;
};
