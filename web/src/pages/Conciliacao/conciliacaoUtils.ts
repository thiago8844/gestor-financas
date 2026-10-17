import { convertNumberToCurrencyMask } from "../../utils";
import type { ItemConciliacao, StatusItemConciliacao, TipoMovimento } from "../../types/conciliacao";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const moeda = (v: number | null | undefined) => `R$ ${convertNumberToCurrencyMask(v ?? 0)}`;

/** Valor com sinal e cor do jeito do extrato: saída negativa (vermelha), entrada positiva (verde). */
export function valorExtrato(tipo: TipoMovimento, valor: number) {
  return {
    texto: `${tipo === "EXPENSE" ? "−" : "+"} ${moeda(valor)}`,
    classe: tipo === "EXPENSE" ? "text-danger" : "text-success",
  };
}

export function dataBr(data: string | null | undefined) {
  if (!data) return "-";
  const [ano, mes, dia] = data.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

export function dataCurta(data: string) {
  const [, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

/** "2026-08" ou "2026-08-01" → "Agosto/2026" */
export function mesAno(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]}/${ano}`;
}

export function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function somarMes(mes: string, n: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Dias entre duas datas "YYYY-MM-DD" (sem sinal). */
export function diasEntre(a: string, b: string) {
  const [ya, ma, da] = a.slice(0, 10).split("-").map(Number);
  const [yb, mb, db] = b.slice(0, 10).split("-").map(Number);
  return Math.round(Math.abs(Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 86400000);
}

export const STATUS_ITEM_LABEL: Record<StatusItemConciliacao, string> = {
  PENDENTE: "Sem correspondência",
  CONCILIADO: "Conferida",
  ADIADO: "Adiada",
  IGNORADO: "Ignorada",
};

export const STATUS_ITEM_BADGE: Record<StatusItemConciliacao, string> = {
  PENDENTE: "text-bg-warning",
  CONCILIADO: "text-bg-success",
  ADIADO: "text-bg-info",
  IGNORADO: "text-bg-secondary",
};

export function precisaAtencao(item: ItemConciliacao) {
  return item.source === "EXTRATO" && (item.status === "PENDENTE" || item.status === "ADIADO" || item.vinculo_quebrado);
}

/** Link para editar o lançamento do app por trás de uma chave "t:{id}". */
export function linkEdicao(chave: string, tipo: TipoMovimento) {
  const m = chave.match(/^t:(\d+)$/);
  if (!m) return "/cartoes";
  return tipo === "EXPENSE" ? `/despesas/editar/${m[1]}` : `/receitas/editar/${m[1]}`;
}

export const pareceFatura = (descricao: string | null | undefined) =>
  /fatura|cart[aã]o|credito|cr[eé]dito|card|nubank|visa|master/i.test(descricao ?? "");

export const pareceTransferencia = (descricao: string | null | undefined) =>
  /\bTED\b|\bDOC\b|TRANSF|MESMA TITULARIDADE|APLICA[CÇ]|RESGATE|POUPAN|INVEST|CDB/i.test(descricao ?? "");
