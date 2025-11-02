export interface Conta {
  id: number;
  user_id: number;
  name: string;
  type: "EXPENSE" | "INCOME";
  role: string;
  active: boolean;
  include_in_networth: boolean;
  currency: string;
  instituicao?: string | null;
  saldo: number;
  created_at: string;
  updated_at: string;
}

// Tipos auxiliares
export type TipoConta = "EXPENSE" | "INCOME";

export type RoleConta =
  | "dinheiro"
  | "banco"
  | "cartão de crédito"
  | "conta corrente"
  | "poupança"
  | "investimento"
  | string; // Permite outros tipos customizados

// Interface para criação de conta (sem campos auto-gerados)
export interface CriarConta {
  name: string;
  type: TipoConta;
  role: string;
  active?: boolean; // Opcional, default true
  include_in_networth?: boolean; // Opcional, default true
  currency: string;
  instituicao?: string | null;
}

// Interface para atualização de conta
export interface AtualizarConta extends Partial<CriarConta> {
  id: number;
}
