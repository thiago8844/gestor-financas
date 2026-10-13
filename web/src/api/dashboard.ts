import { api } from "../api-client";
import type { Fatura } from "../types/fatura";

// Intervalos disponíveis — espelham o enum TimeIntervals do backend
export type TimeInterval =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "THREE_MONTHS"
  | "SIX_MONTHS"
  | "YEARLY";

// Retorna "YYYY-MM-DD" sem depender de biblioteca externa
const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const hoje = () => new Date();
const primeiroDiaMesAtual = () => {
  const d = hoje();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
};
const ultimoDiaMesAtual = () => {
  const d = hoje();
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};

// ---------------------------------------------------------------------------
// GET /dashboard/indicadores
// Sem parâmetros — sempre retorna os indicadores do mês corrente.
// ---------------------------------------------------------------------------
export const getIndicadoresDashboard = async () => {
  const response = await api.get("/dashboard/indicadores");
  return response.data;
};

// ---------------------------------------------------------------------------
// GET /dashboard/fatura-atual
// Só vem preenchido quando o usuário tem exatamente 1 cartão cadastrado. Nos
// demais casos a API retorna {} (sem as chaves cartao/fatura), então sempre
// confira `data?.fatura` antes de usar.
// `offset` navega ±3 faturas a partir da do próximo vencimento (0 = padrão).
// ---------------------------------------------------------------------------
export interface FaturaAtualDashboard {
  cartao: { id: number; name: string; conta_nome: string | null };
  fatura: Fatura;
  offset: number;
}

export const FATURA_ATUAL_OFFSET_MAXIMO = 3;

export const getFaturaAtualDashboard = async (offset = 0) => {
  const response = await api.get<Partial<FaturaAtualDashboard>>("/dashboard/fatura-atual", {
    params: { offset },
  });
  return response.data;
};

// ---------------------------------------------------------------------------
// GET /dashboard/saldo-contas
// ---------------------------------------------------------------------------
export interface SaldoContasParams {
  /** true = histórico completo, ignora as datas. */
  alltime?: boolean;
  dataInicial?: string;
  dataFinal?: string;
  /** Granularidade. Padrão: DAILY no mês, MONTHLY no alltime. */
  intervalo?: TimeInterval;
}

export const getSaldoContas = async ({
  alltime = false,
  dataInicial,
  dataFinal,
  intervalo,
}: SaldoContasParams = {}) => {
  const params: Record<string, string | boolean> = {
    saldos_contas_alltime: alltime,
    saldos_contas_periodo_intervalo:
      intervalo ?? (alltime ? "MONTHLY" : "DAILY"),
    saldos_contas_periodo_inicial: dataInicial ?? primeiroDiaMesAtual(),
    saldos_contas_periodo_final: dataFinal ?? ultimoDiaMesAtual(),
  };
  const response = await api.get("/dashboard/saldo-contas", { params });
  return response.data as import("../pages/Dashboard/components/SaldoPorContaPeriodo").SaldoPorContaData;
};

// ---------------------------------------------------------------------------
// GET /dashboard/transacoes-categoria
// ---------------------------------------------------------------------------
export interface TransacoesCategoriaParams {
  despesasAlltime?: boolean;
  despesasDataInicial?: string;
  despesasDataFinal?: string;
  receitasAlltime?: boolean;
  receitasDataInicial?: string;
  receitasDataFinal?: string;
  contaId?: number;
}

export const getTransacoesCategoria = async ({
  despesasAlltime = false,
  despesasDataInicial,
  despesasDataFinal,
  receitasAlltime = false,
  receitasDataInicial,
  receitasDataFinal,
  contaId,
}: TransacoesCategoriaParams = {}) => {
  const params: Record<string, string | boolean | number> = {
    despesas_categoria_alltime: despesasAlltime,
    despesas_categoria_periodo_inicial:
      despesasDataInicial ?? primeiroDiaMesAtual(),
    despesas_categoria_periodo_final: despesasDataFinal ?? ultimoDiaMesAtual(),
    receitas_categoria_alltime: receitasAlltime,
    receitas_categoria_periodo_inicial:
      receitasDataInicial ?? primeiroDiaMesAtual(),
    receitas_categoria_periodo_final: receitasDataFinal ?? ultimoDiaMesAtual(),
    ...(contaId ? { conta_id: contaId } : {}),
  };
  const response = await api.get("/dashboard/transacoes-categoria", { params });
  return response.data as {
    despesas_por_categoria: import("../pages/Dashboard/components/TransacaoCategoria").CategoriaPonto[];
    receitas_por_categoria: import("../pages/Dashboard/components/TransacaoCategoria").CategoriaPonto[];
  };
};

// ---------------------------------------------------------------------------
// GET /dashboard/despesas-futuras
// Quanto ainda vai sair de hoje até `dataFinal`, separado em parcelas,
// recorrências e outras (só valores já garantidos; sem estimativas).
// ---------------------------------------------------------------------------
export interface TotalDespesasFuturas {
  total: number;
  quantidade: number;
}

export interface DespesasFuturasDashboard {
  periodo: { data_inicial: string; data_final: string };
  total: number;
  quantidade: number;
  parcelas: TotalDespesasFuturas;
  recorrencias: TotalDespesasFuturas;
  outras: TotalDespesasFuturas;
  /** Itens sem valor definido (não entram no total). */
  sem_valor: number;
  faturas: { cartao: string; vencimento: string; total: number }[];
  meses: {
    mes: string;
    parcelas: number;
    recorrencias: number;
    outras: number;
    total: number;
  }[];
}

export const getDespesasFuturasDashboard = async (dataFinal: string) => {
  const response = await api.get<DespesasFuturasDashboard>(
    "/dashboard/despesas-futuras",
    { params: { data_final: dataFinal } },
  );
  return response.data;
};
