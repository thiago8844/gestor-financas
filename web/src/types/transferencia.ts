import type { PaginationLinks, PaginationMeta } from ".";

export type Transferencia = {
  id: number;
  from_account_id: number;
  to_account_id: number;
  amount: number | string;
  date: string;
  date_raw: string;
  description: string | null;
  conta_origem?: { id: number; name: string };
  conta_destino?: { id: number; name: string };
  created_at: string;
  updated_at: string;
};

export type TransferenciaResponse = {
  data: Transferencia;
  message?: string;
};

export type TransferenciasResponse = {
  data: Transferencia[];
  links: PaginationLinks;
  meta: PaginationMeta;
};
