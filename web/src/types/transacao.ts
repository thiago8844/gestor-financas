import type { Conta, PaginationLinks, PaginationMeta } from ".";
import type { Cartao } from "./cartao";
import type { Fatura } from "./fatura";

// types/transacao.ts
export type Categoria = {
  id: number;
  user_id: number;
  name: string;
  color: string;
  // icon: string;
  created_at: string;
  updated_at: string;
};

export type Transacao = {
  id: number;
  user_id: number;
  account_id: number;
  category_id: number | null;
  amount: number | null;
  type: "EXPENSE" | "INCOME";
  date: string;
  status: "PENDING" | "PAID";
  date_raw: string; 
  due_date: string | null;
  due_date_raw: string | null;
  description: string;
  created_at: string;
  updated_at: string;
  categoria: Categoria | null;
  conta: Conta | null;
  installment_number: number | null;
  installment_total: number | null;
  installment_group: string | null;
  is_installment: boolean;
  recurring_transaction_id: number | null;
  is_recurring: boolean;
  card_id: number | null;
  invoice_id: number | null;
  purchase_date: string | null;
  purchase_date_fmt: string | null;
  created_at_fmt: string | null;
  cartao: Cartao | null;
  fatura: Fatura | null;
  /** Lado da rolagem de um pagamento parcial de fatura (gerado pelo sistema). */
  is_rolagem_fatura?: boolean;
  /** Já conferido contra o extrato do banco (conciliação). */
  conciliada?: boolean;
};

//FUTURAMENTE COLOCAR OS TIPOS DE PAGINAÇÃO NA RESPONSE TAMBÉM
export type TransacaoResponse = {
  data: Transacao[];
  meta: PaginationMeta;
  links: PaginationLinks;
  total: number;
};

export type GrupoParcelado = {
  installment_group: string;
  description: string;
  installment_total: number;
  primeira_data: string | null;
};

export type GrupoParceladoResponse = {
  data: GrupoParcelado[];
};

export type TransacaoFilters = {
  type?: "EXPENSE" | "INCOME";
  account_id?: number;
  category_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  page?: number;
};

/** Parcela dentro do detalhe de um grupo (compra parcelada inteira). */
export type ParcelaDoGrupo = Transacao & {
  /** Paga ou conciliada: valor, vencimento e fatura não podem mais ser alterados. */
  travada: boolean;
};

export type GrupoParcelasDetalhe = {
  installment_group: string;
  tipo: "cartao" | "conta";
  type: "EXPENSE" | "INCOME";
  description: string;
  category_id: number | null;
  account_id: number | null;
  card_id: number | null;
  purchase_date: string | null;
  total: number;
  pagas: number;
  pendentes: number;
  parcelas: ParcelaDoGrupo[];
};

export type AtualizarGrupoParcelasPayload = {
  description?: string;
  category_id?: number | null;
  category_name?: string | null;
  parcelas?: { id: number; amount?: number; due_date?: string | null; invoice_month?: string | null }[];
};
