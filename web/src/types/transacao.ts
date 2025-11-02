import type { Conta, PaginationLinks, PaginationMeta } from ".";

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
  amount: number;
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
};

//FUTURAMENTE COLOCAR OS TIPOS DE PAGINAÇÃO NA RESPONSE TAMBÉM
export type TransacaoResponse = {
  data: Transacao[];
  meta: PaginationMeta;
  links: PaginationLinks;
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
