export type User = {
  id: string;
  name: string;
  email: string;
};

export type {
  Conta,
  TipoConta,
  RoleConta,
  CriarConta,
  AtualizarConta,
} from "./conta";

export type PaginationLink = {
  url: string | null;
  label: string;
  page: number | null;
  active: boolean;
};

export type PaginationLinks = {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
};

export type PaginationMeta = {
  current_page: number;
  from: number;
  last_page: number;
  links: PaginationLink[];
  path: string;
  per_page: number;
  to: number;
  total: number;
};

export type PaginatedData<T> = {
  data: T[];
  links: PaginationLinks;
  meta: PaginationMeta;
};

// ✅ TIPO GENÉRICO PARA OUTRAS APIS PAGINADAS
export type ApiResponse<T> = {
  data: PaginatedData<T>;
};
