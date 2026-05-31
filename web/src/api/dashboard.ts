import { api } from "../api-client";

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
  return response.data as Record<
    string,
    import("../pages/Dashboard/components/SaldoPorContaPeriodo").SaldoPonto[]
  >;
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
}

export const getTransacoesCategoria = async ({
  despesasAlltime = false,
  despesasDataInicial,
  despesasDataFinal,
  receitasAlltime = false,
  receitasDataInicial,
  receitasDataFinal,
}: TransacoesCategoriaParams = {}) => {
  const params: Record<string, string | boolean> = {
    despesas_categoria_alltime: despesasAlltime,
    despesas_categoria_periodo_inicial:
      despesasDataInicial ?? primeiroDiaMesAtual(),
    despesas_categoria_periodo_final: despesasDataFinal ?? ultimoDiaMesAtual(),
    receitas_categoria_alltime: receitasAlltime,
    receitas_categoria_periodo_inicial:
      receitasDataInicial ?? primeiroDiaMesAtual(),
    receitas_categoria_periodo_final: receitasDataFinal ?? ultimoDiaMesAtual(),
  };
  const response = await api.get("/dashboard/transacoes-categoria", { params });
  return response.data as {
    despesas_por_categoria: import("../pages/Dashboard/components/TransacaoCategoria").CategoriaPonto[];
    receitas_por_categoria: import("../pages/Dashboard/components/TransacaoCategoria").CategoriaPonto[];
  };
};
