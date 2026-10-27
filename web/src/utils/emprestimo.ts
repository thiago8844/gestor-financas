import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask } from "./index";
import type { EmprestimoFormValues } from "../schemas/emprestimo";
import type {
  DirecaoEmprestimo,
  Emprestimo,
  EmprestimoPayload,
  FrequenciaEmprestimo,
  ModalidadeEmprestimo,
  ParcelaEmprestimo,
  PeriodoTaxa,
  TipoJuros,
} from "../types/emprestimo";

export const MODALIDADES: { valor: ModalidadeEmprestimo; titulo: string; descricao: string; icone: string }[] = [
  {
    valor: "JUROS_PERIODICOS",
    titulo: "Só juros, principal no fim",
    descricao: "Paga só os juros em cada período e devolve o valor emprestado na última parcela.",
    icone: "bi-cash-coin",
  },
  {
    valor: "PRICE",
    titulo: "Parcelas fixas (Price)",
    descricao: "Todas as parcelas têm o mesmo valor. Os juros diminuem e a amortização aumenta.",
    icone: "bi-grid-3x2-gap",
  },
  {
    valor: "SAC",
    titulo: "Amortização fixa (SAC)",
    descricao: "Abate o mesmo valor do principal todo mês. As parcelas começam maiores e diminuem.",
    icone: "bi-graph-down-arrow",
  },
  {
    valor: "PAGAMENTO_UNICO",
    titulo: "Pagamento único",
    descricao: "Paga tudo de uma vez, principal e juros acumulados, em uma data só.",
    icone: "bi-calendar-event",
  },
  {
    valor: "LIVRE",
    titulo: "Parcelas livres",
    descricao: "Sem fórmula: você informa a data e o valor de cada parcela.",
    icone: "bi-pencil-square",
  },
];

export const FREQUENCIAS: { valor: FrequenciaEmprestimo; label: string }[] = [
  { valor: "MENSAL", label: "Todo mês" },
  { valor: "QUINZENAL", label: "A cada 15 dias" },
  { valor: "SEMANAL", label: "Toda semana" },
  { valor: "ANUAL", label: "Todo ano" },
];

const PERIODO_ABREVIADO: Record<PeriodoTaxa, string> = { DIA: "a.d.", MES: "a.m.", ANO: "a.a." };
const TIPO_JUROS_LABEL: Record<TipoJuros, string> = {
  SIMPLES: "juros simples",
  COMPOSTO: "juros compostos",
  SEM_JUROS: "sem juros",
};

export const formatarMoeda = (valor?: number | null) => `R$ ${convertNumberToCurrencyMask(valor ?? 0)}`;

/** "2026-11-26" -> "26/11/2026", sem passar por Date (evita erro de fuso). */
export function formatarDataBr(iso?: string | null): string {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export const hojeISO = (agora: Date = new Date()) =>
  `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;

/** Aceita "2,5" ou "2.5"; devolve undefined quando não é número. */
export function parseDecimal(texto?: string | null): number | undefined {
  if (texto === undefined || texto === null || texto.trim() === "") return undefined;
  const numero = Number(texto.trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : undefined;
}

export const diaDaData = (iso: string): number | null => {
  const dia = Number(iso?.slice(8, 10));
  return dia >= 1 && dia <= 31 ? dia : null;
};

export const rotuloDirecao = (direcao: DirecaoEmprestimo) => (direcao === "TOMADO" ? "Eu devo" : "Me devem");

export const rotuloModalidade = (modalidade: ModalidadeEmprestimo) =>
  MODALIDADES.find((m) => m.valor === modalidade)?.titulo ?? modalidade;

export function rotuloTaxa(e: Pick<Emprestimo, "rate" | "rate_period" | "interest_type">): string {
  if (e.interest_type === "SEM_JUROS") return "sem juros";
  const taxa = String(e.rate).replace(".", ",");
  return `${taxa}% ${PERIODO_ABREVIADO[e.rate_period]} · ${TIPO_JUROS_LABEL[e.interest_type]}`;
}

/** Uma linha de resumo do contrato, ex.: "R$ 5.000,00 · 2% a.m. · juros simples". */
export const resumoContrato = (e: Emprestimo) => `${formatarMoeda(e.principal)} · ${rotuloTaxa(e)}`;

export type SituacaoParcela = { texto: string; variante: "success" | "danger" | "warning" | "secondary" | "info" };

/**
 * Status da parcela em texto (não só cor): "Atrasada há 3 dias", "Vence hoje", "Paga"...
 * `hoje` é injetável para os testes.
 */
export function situacaoDaParcela(
  parcela: Pick<ParcelaEmprestimo, "status" | "due_date" | "overdue" | "days_overdue">,
  direcao: DirecaoEmprestimo,
  hoje: string = hojeISO(),
): SituacaoParcela {
  switch (parcela.status) {
    case "PAGA":
      return { texto: direcao === "TOMADO" ? "Paga" : "Recebida", variante: "success" };
    case "CANCELADA":
      return { texto: "Cancelada", variante: "secondary" };
    default:
      break;
  }

  if (parcela.overdue) {
    const dias = parcela.days_overdue;
    const atraso = `Atrasada há ${dias} ${dias === 1 ? "dia" : "dias"}`;
    return { texto: parcela.status === "PARCIAL" ? `Parcial · ${atraso.toLowerCase()}` : atraso, variante: "danger" };
  }

  if (parcela.status === "PARCIAL") return { texto: "Parcial", variante: "warning" };
  if (parcela.due_date === hoje) return { texto: "Vence hoje", variante: "warning" };

  return { texto: "Prevista", variante: "secondary" };
}

/** Converte o formulário (tudo texto) no payload que a API espera. */
export function montarPayload(f: EmprestimoFormValues): EmprestimoPayload {
  const semJuros = f.interest_type === "SEM_JUROS";
  const mensal = f.frequency === "MENSAL";
  const prazoAberto = f.modality === "JUROS_PERIODICOS" && f.prazo_aberto;
  const numeroParcelas = Number(f.installments);

  const payload: EmprestimoPayload = {
    direction: f.direction,
    counterparty: f.counterparty.trim(),
    description: f.description.trim() || null,
    principal: convertCurrencyMaskToNumber(f.principal) ?? 0,
    contract_date: f.contract_date,
    interest_type: f.interest_type,
    rate: semJuros ? 0 : (parseDecimal(f.rate) ?? 0),
    rate_period: f.rate_period,
    modality: f.modality,
    frequency: f.frequency,
    // O dia fixo só faz sentido na frequência mensal; nas demais vale o intervalo a partir da primeira data.
    due_day: mensal ? diaDaData(f.first_due_date) : null,
    due_day_adjustment: f.due_day_adjustment,
    first_due_date: f.first_due_date,
    installments: !prazoAberto && f.modality !== "LIVRE" && f.modality !== "PAGAMENTO_UNICO" && numeroParcelas > 0 ? numeroParcelas : null,
    grace_installments: Number(f.grace_installments) || 0,
    account_id: f.account_id ? Number(f.account_id) : null,
    movimentar_conta: f.movimentar_conta,
    notes: f.notes.trim() || null,
  };

  if (f.modality === "LIVRE") {
    payload.custom_installments = f.custom_installments.map((p) => ({
      due_date: p.due_date,
      principal_amount: convertCurrencyMaskToNumber(p.principal_amount) ?? 0,
      interest_amount: convertCurrencyMaskToNumber(p.interest_amount) ?? 0,
    }));
  }

  return payload;
}

/**
 * Juros do primeiro mês sobre o valor emprestado, para mostrar um exemplo concreto enquanto a
 * pessoa digita a taxa ("2% ao mês sobre R$ 5.000 = R$ 100 por mês").
 */
export function jurosPrimeiroMes(principal: number, taxa: number, periodo: PeriodoTaxa, tipo: TipoJuros): number {
  if (tipo === "SEM_JUROS" || principal <= 0 || taxa <= 0) return 0;

  const t = taxa / 100;
  let mensal: number;

  if (periodo === "MES") mensal = t;
  else if (periodo === "DIA") mensal = tipo === "SIMPLES" ? t * 30 : (1 + t) ** 30 - 1;
  else mensal = tipo === "SIMPLES" ? t / 12 : (1 + t) ** (1 / 12) - 1;

  return Math.round(principal * mensal * 100) / 100;
}

export const ROTULO_LANCAMENTO: Record<"PRINCIPAL" | "PARCELA" | "AJUSTE", string> = {
  PRINCIPAL: "Valor emprestado",
  PARCELA: "Parcela",
  AJUSTE: "Amortização / aumento",
};

/** Ajustes só existem para estas modalidades (as demais não têm saldo que se recalcule). */
export const aceitaAjuste = (e: Pick<Emprestimo, "modality" | "status">, tipo: "AMORTIZACAO" | "AUMENTO"): boolean =>
  ["JUROS_PERIODICOS", "PRICE", "SAC"].includes(e.modality) &&
  (e.status === "ATIVO" || (e.status === "QUITADO" && tipo === "AUMENTO"));

/** Resumo em palavras da economia (ou custo) de juros de uma simulação. */
export function frasesDeJuros(diferenca: number): string {
  if (Math.abs(diferenca) < 0.005) return "Os juros restantes não mudam.";
  return diferenca > 0
    ? `Você economiza ${formatarMoeda(diferenca)} em juros.`
    : `Os juros restantes aumentam ${formatarMoeda(-diferenca)}.`;
}
