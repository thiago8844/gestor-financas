export interface Cartao {
  id: number;
  account_id: number;
  conta_nome?: string | null;
  name: string;
  closing_day: number;
  due_day: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CriarCartao {
  account_id: number;
  name: string;
  closing_day: number;
  due_day: number;
  active?: boolean;
}

export interface AtualizarCartao extends Partial<CriarCartao> {
  id: number;
}
