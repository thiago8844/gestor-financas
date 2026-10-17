import type { AuditoriaFatura, PagamentoFatura } from "./fatura";

export type TipoMovimento = "INCOME" | "EXPENSE";
export type StatusConciliacao = "ABERTA" | "FINALIZADA";
export type StatusItemConciliacao = "PENDENTE" | "CONCILIADO" | "ADIADO" | "IGNORADO";
export type OrigemItemConciliacao = "EXTRATO" | "APP";
export type Confianca = "ALTA" | "MEDIA";

/** Um lançamento do app como o banco o vê (lançamento comum ou pagamento de fatura agrupado). */
export type EntradaRazao = {
  /** "t:{id}" (lançamento) ou "f:{fatura}:{data}" (pagamento de fatura). */
  chave: string;
  origem: "TRANSACAO" | "FATURA";
  type: TipoMovimento;
  amount: number;
  date: string;
  description: string;
  transacao_ids: number[];
  fatura_id: number | null;
  categoria: string | null;
  transferencia: boolean;
  quantidade: number;
};

export type Candidato = {
  chave: string;
  dias: number;
  /** Valor do app - valor do extrato. */
  diferenca: number;
  similaridade: number;
  entrada: EntradaRazao;
};

export type LancamentoVinculado = {
  id: number;
  description: string;
  amount: number;
  type: TipoMovimento;
  status: "PENDING" | "PAID";
  date: string | null;
  categoria: string | null;
  card_id: number | null;
  invoice_id: number | null;
  is_rolagem_fatura: boolean;
};

export type ItemConciliacao = {
  id: number;
  source: OrigemItemConciliacao;
  fitid: string | null;
  type: TipoMovimento;
  amount: number;
  transaction_date: string;
  description: string | null;
  status: StatusItemConciliacao;
  matched_by: "AUTO" | "MANUAL" | null;
  note: string | null;
  resolved_at: string | null;
  invoice_id: number | null;
  vinculo_quebrado: boolean;
  fatura: { id: number; cartao: string | null; reference_month: string; due_date: string } | null;
  lancamentos: LancamentoVinculado[];
  sugestao: { chave: string; confianca: Confianca; dias: number; entrada: EntradaRazao } | null;
  candidatos: Candidato[];
};

export type FaturaConciliacao = {
  id: number;
  card_id: number;
  cartao: string | null;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total: number;
  pago: number;
  pendente: number;
  levado_para_proxima: number;
  paga: boolean;
  pagamentos: PagamentoFatura[];
  lancamentos: number;
  auditoria: AuditoriaFatura | null;
  /** Só no painel. */
  conta_nome?: string | null;
  pagamento_conciliado?: boolean;
};

export type ResumoConciliacao = {
  linhas: number;
  conciliadas: number;
  conciliadas_auto: number;
  pendentes: number;
  adiadas: number;
  ignoradas: number;
  so_no_app: number;
  mantidos_so_no_app: number;
  sugestoes: number;
  vinculos_quebrados: number;
  entradas: number;
  saidas: number;
};

export type SaldoConciliacao = {
  banco: number | null;
  data: string;
  app: number;
  diferenca: number | null;
};

export type RetratoFechamento = {
  conta: string | null;
  arquivo: string | null;
  arquivo_hash: string | null;
  linhas_extrato: number;
  conciliadas_automaticamente: number;
  conciliadas_manualmente: number;
  ignoradas: number;
  mantidos_so_no_app: number;
  entradas_extrato: number;
  saidas_extrato: number;
  saldo: SaldoConciliacao;
  faturas: {
    fatura_id: number;
    cartao: string | null;
    referencia: string;
    valor_debitado: number;
    total_fatura: number;
    auditoria: "CONFERE" | "DIVERGENTE" | "NAO_AUDITADA";
  }[];
  finalizada_em: string;
};

export type Conciliacao = {
  id: number;
  account_id: number;
  conta?: { id: number; name: string };
  /** "YYYY-MM" */
  reference_month: string;
  period_start: string;
  period_end: string;
  status: StatusConciliacao;
  original_filename: string | null;
  statement_balance: number | null;
  statement_balance_date: string | null;
  note: string | null;
  summary: RetratoFechamento | null;
  finalized_at: string | null;
  reopened_at: string | null;
  created_at: string;
  contagens?: { linhas: number; conciliadas: number; pendentes: number; adiadas: number; ignoradas: number };
};

export type RevisaoConciliacao = {
  conciliacao: Conciliacao;
  resumo: ResumoConciliacao;
  saldo: SaldoConciliacao;
  itens: ItemConciliacao[];
  so_no_app: EntradaRazao[];
  faturas: FaturaConciliacao[];
  pode_finalizar: boolean;
  motivos_bloqueio: string[];
  tolerancia_dias: number;
};

export type RevisaoResponse = { data: RevisaoConciliacao; message?: string };

export type ContaNoPainel = {
  id: number;
  name: string;
  instituicao: string | null;
  role: string | null;
  esperada: boolean;
  situacao: "SEM_EXTRATO" | StatusConciliacao;
  vinculos_quebrados: number;
  ultima_finalizada: string | null;
  conciliacao: Conciliacao | null;
};

export type PainelFechamento = {
  mes: string;
  contas: ContaNoPainel[];
  faturas: FaturaConciliacao[];
  progresso: { concluidos: number; total: number };
};

export type ErroConciliacao = {
  message: string;
  necessita_conta?: boolean;
  banco_detectado?: { bank_id: string | null; branch_id: string | null; acct_id: string | null; acct_type: string | null };
  conciliacao_id?: number;
  exige_observacao?: boolean;
  diferenca?: number;
};
