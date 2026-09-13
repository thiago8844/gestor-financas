import type { Conta } from ".";
import type { Categoria } from "./transacao";
import type { Orcamento } from "./orcamento";

export type OfxImportStatus = "STAGED" | "CONFIRMED" | "UNDONE";
export type OfxImportItemStatus = "PENDENTE" | "DUPLICADA" | "IGNORADA" | "IMPORTADA";
export type OfxTipoTransacao = "INCOME" | "EXPENSE";

export type OfxImportItem = {
  id: number;
  ofx_import_id: number;
  fitid: string | null;
  type: OfxTipoTransacao;
  amount: number;
  transaction_date: string;
  descricao_original: string;
  descricao: string | null;
  editada: boolean;
  status: OfxImportItemStatus;
  selecionada: boolean;
  account_id: number | null;
  category_id: number | null;
  budget_id: number | null;
  conta: Conta | null;
  categoria: Categoria | null;
  orcamento: Orcamento | null;
  matched_transaction_id: number | null;
  regra_aplicada_id: number | null;
  created_transaction_id: number | null;
};

export type OfxImport = {
  id: number;
  original_filename: string;
  ofx_version: string | null;
  status: OfxImportStatus;
  period_start: string | null;
  period_end: string | null;
  total_transactions: number;
  imported_transactions: number;
  duplicate_transactions: number;
  ignored_transactions: number;
  finalizada_at: string | null;
  undone_at: string | null;
  pode_desfazer: boolean;
  account_id: number | null;
  conta: Conta | null;
  itens: OfxImportItem[];
  created_at: string;
};

export type OfxImportResponse = {
  data: OfxImport;
  message?: string;
};

export type OfxImportsResponse = {
  data: OfxImport[];
};

export type OfxNecessitaContaError = {
  message: string;
  necessita_conta: true;
  banco_detectado: {
    bank_id: string | null;
    branch_id: string | null;
    acct_id: string | null;
    acct_type: string | null;
  };
};

export type OfxArquivoDuplicadoError = {
  message: string;
  importacao_existente: OfxImport;
};

export type OfxDesfazerBloqueadoError = {
  message: string;
  transacoes_editadas: number[];
};

export type OfxImportRule = {
  id: number;
  name: string | null;
  conditions: {
    descricao_contains?: string;
    tipo?: OfxTipoTransacao;
  };
  actions: {
    descricao?: string;
    category_id?: number | null;
    budget_id?: number | null;
  };
  active: boolean;
  vezes_aplicada: number;
  created_at: string;
};

export type OfxImportRulesResponse = {
  data: OfxImportRule[];
};

export type OfxImportRuleResponse = {
  data: OfxImportRule;
  message?: string;
  itens_aplicados?: number | null;
};
