import { useEffect, useState } from "react";
import type {
  AjusteCenario,
  CenarioConfig,
  Confianca,
  EventoSimulacao,
  NomeCenario,
  Natureza,
  PontoSaldo,
} from "../../../types/simulador";

export { brl, formatarDataBR, formatarDiaMes, formatarDataExtensa, mesCurto, nomeMes, diaDaSemana } from "../CompromissosFuturos/formatadores";

// -=-=-=- CORES -=-=-=-
// Semânticas do projeto (mesmas dos outros relatórios): entrada verde, saída vermelha, saldo azul.
export const COR = {
  receita: "#198754",
  despesa: "#dc3545",
  saldo: "#0d6efd",
  fatura: "#0d6efd",
  hipotetico: "#6f42c1",
  neutro: "#6c757d",
  grade: "#f0f0f0",
} as const;

/** Linhas dos cenários no gráfico principal. */
export const COR_CENARIO: Record<NomeCenario, string> = {
  base: "#0d6efd",
  otimista: "#198754",
  pessimista: "#dc3545",
  personalizado: "#6f42c1",
};

export const LABEL_CENARIO: Record<NomeCenario, string> = {
  base: "Previsão automática",
  otimista: "Otimista",
  pessimista: "Pessimista",
  personalizado: "Minha simulação",
};

/**
 * Paleta categórica validada (ordem fixa, nunca ciclada): a cor segue a CATEGORIA — atribuída
 * pela ordem de importância na previsão-base — e não muda quando um filtro esconde outras.
 * Da 8ª categoria em diante, "Outras" em cinza.
 */
export const PALETA_CATEGORIAS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
export const COR_OUTRAS = "#9aa0a6";

export function mapaCoresCategorias(chavesEmOrdem: string[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  chavesEmOrdem.forEach((chave, i) => {
    mapa[chave] = PALETA_CATEGORIAS[i] ?? COR_OUTRAS;
  });
  return mapa;
}

// -=-=-=- RÓTULOS -=-=-=-

export const LABEL_CONFIANCA: Record<Confianca | "INSUFICIENTE" | "EVENTUAL", string> = {
  ALTA: "Alta",
  MEDIA: "Moderada",
  BAIXA: "Baixa",
  INSUFICIENTE: "Dados insuficientes",
  EVENTUAL: "Eventual",
};

export const CLASSE_CONFIANCA: Record<Confianca | "INSUFICIENTE" | "EVENTUAL", string> = {
  ALTA: "text-bg-success",
  MEDIA: "text-bg-warning",
  BAIXA: "text-bg-danger",
  INSUFICIENTE: "text-bg-secondary",
  EVENTUAL: "text-bg-light border",
};

export const LABEL_NATUREZA: Record<Natureza, string> = {
  CONHECIDO: "Cadastrado",
  RECORRENCIA: "Recorrência",
  ESTIMADO: "Previsão",
  HIPOTETICO: "Simulado",
  FATURA: "Fatura",
};

export const ICONE_NATUREZA: Record<Natureza, string> = {
  CONHECIDO: "bi-check2-circle",
  RECORRENCIA: "bi-arrow-repeat",
  ESTIMADO: "bi-magic",
  HIPOTETICO: "bi-lightbulb",
  FATURA: "bi-credit-card-2-front",
};

export const LABEL_PADRAO_MES: Record<string, string> = {
  INICIO: "concentrado no início do mês",
  MEIO: "concentrado no meio do mês",
  FIM: "concentrado no fim do mês",
  DISTRIBUIDO: "distribuído ao longo do mês",
  NEUTRO: "sem padrão de dias identificável (distribuição neutra)",
};

export const LABEL_TENDENCIA: Record<string, string> = {
  ESTAVEL: "Estável",
  SUBINDO: "Subindo",
  CAINDO: "Caindo",
};

// -=-=-=- NÚMEROS -=-=-=-

export const compacto = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(v);

export const pct = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

export function brlSinal(valor: number): string {
  const abs = `R$ ${Math.abs(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (Math.abs(valor) < 0.005) return abs;
  return valor > 0 ? `+ ${abs}` : `− ${abs}`;
}

// -=-=-=- DATAS -=-=-=-

export function hojeISO(): string {
  const d = new Date();
  return isoLocal(d);
}

export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Datas ISO como texto → Date ao meio-dia local (evita escorregar de dia por fuso). */
export const tsDe = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();

export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Saldo ao fim de cada dia entre início e fim (a série só traz os dias com movimento). */
export function expandirDiario(serie: PontoSaldo[], inicio: string, fim: string): PontoSaldo[] {
  const pontos = new Map(serie.map((p) => [p.data, p.saldo]));
  const saida: PontoSaldo[] = [];
  let saldo = serie[0]?.saldo ?? 0;
  const d = new Date(`${inicio}T12:00:00`);
  const limite = new Date(`${fim}T12:00:00`);

  while (d <= limite) {
    const iso = isoLocal(d);
    saldo = pontos.get(iso) ?? saldo;
    saida.push({ data: iso, saldo });
    d.setDate(d.getDate() + 1);
  }
  return saida;
}

export type Granularidade = "DIARIA" | "SEMANAL" | "MENSAL";

/** Reduz a série diária ao último saldo de cada semana (domingo) ou mês. */
export function agruparSerie(diaria: PontoSaldo[], granularidade: Granularidade): PontoSaldo[] {
  if (granularidade === "DIARIA") return diaria;

  const chave = (iso: string) => {
    if (granularidade === "MENSAL") return iso.slice(0, 7);
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    return isoLocal(d);
  };

  const ultimos = new Map<string, PontoSaldo>();
  diaria.forEach((p, i) => {
    // O primeiro ponto (hoje) fica sempre, para a linha começar exatamente no saldo atual.
    if (i === 0) ultimos.set("__inicio", p);
    else ultimos.set(chave(p.data), p);
  });
  return [...ultimos.values()];
}

// -=-=-=- CENÁRIO -=-=-=-

export const CENARIO_VAZIO: CenarioConfig = { inflacao_mensal: 0, ajustes: [], eventos: [] };

export function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function cenarioVazio(cenario: CenarioConfig): boolean {
  return cenario.inflacao_mensal === 0 && cenario.ajustes.length === 0 && cenario.eventos.length === 0;
}

/** Ajuste da tabela de categorias (um por categoria, id estável). */
export const idAjusteCategoria = (chave: string) => `cat:${chave}`;

export function ajusteDaCategoria(cenario: CenarioConfig, chave: string): AjusteCenario | undefined {
  return cenario.ajustes.find((a) => a.id === idAjusteCategoria(chave));
}

/** Debounce de um valor: os sliders respondem na hora, o recálculo espera o usuário parar. */
export function useDebounce<T>(valor: T, atraso: number): T {
  const [atual, setAtual] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtual(valor), atraso);
    return () => clearTimeout(t);
  }, [valor, atraso]);
  return atual;
}

/** Lançamentos "de caixa" de um mês, abrindo as faturas em seus itens quando pedido. */
export function eventosDoMes(eventos: EventoSimulacao[], mes: string): EventoSimulacao[] {
  return eventos.filter((e) => e.data.startsWith(mes));
}

export function rotuloAlvo(ajuste: AjusteCenario): string {
  switch (ajuste.alvo) {
    case "DESPESAS_ESTIMADAS":
      return "Gastos variáveis estimados";
    case "RECEITAS_ESTIMADAS":
      return "Receitas variáveis estimadas";
    case "DESPESAS_RECORRENTES":
      return "Despesas recorrentes futuras";
    case "RECEITAS_RECORRENTES":
      return "Receitas recorrentes futuras";
    case "RECORRENCIA":
      return "Recorrência";
    case "CARTAO":
      return "Compras estimadas no cartão";
    default:
      return "Categoria";
  }
}

export function descreverAjuste(ajuste: AjusteCenario): string {
  const valor =
    ajuste.modo === "PERCENTUAL"
      ? `${ajuste.valor > 0 ? "+" : ""}${ajuste.valor.toLocaleString("pt-BR")}%`
      : ajuste.modo === "DELTA"
        ? `${ajuste.valor > 0 ? "+" : "−"} R$ ${Math.abs(ajuste.valor).toLocaleString("pt-BR")}/mês`
        : `R$ ${ajuste.valor.toLocaleString("pt-BR")}/mês`;
  const periodo =
    ajuste.mes_inicio || ajuste.mes_fim
      ? ` · ${ajuste.mes_inicio ? mesCurtoLocal(ajuste.mes_inicio) : "início"} a ${ajuste.mes_fim ? mesCurtoLocal(ajuste.mes_fim) : "fim"}`
      : "";
  return `${valor}${periodo}`;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function mesCurtoLocal(chave: string): string {
  const [a, m] = chave.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
}
