import type { PaginationLinks, PaginationMeta } from ".";

export type SeveridadeNotificacao = "info" | "warning" | "danger";

export type Notificacao = {
  id: number;
  type: string;
  title: string;
  message: string;
  severity: SeveridadeNotificacao;
  data: Record<string, unknown> | null;
  action_url: string | null;
  lida: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificacoesResponse = {
  data: Notificacao[];
  links: PaginationLinks;
  meta: PaginationMeta;
  nao_lidas_count: number;
};
