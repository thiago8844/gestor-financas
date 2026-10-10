import { convertNumberToCurrencyMask } from "../../../utils";
import { isDataBRValida } from "../periodoPresets";
import type { EventoCompromisso, OrigemCompromisso } from "../../../types/relatorio";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "R$ 1.234,50" — com sinal de menos próprio quando negativo. */
export function brl(valor: number): string {
  const texto = `R$ ${convertNumberToCurrencyMask(Math.abs(valor))}`;
  return valor < 0 ? `−${texto}` : texto;
}

/** "+ R$ 5.000,00" / "− R$ 1.200,00" conforme o tipo do evento. */
export function brlComSinal(valor: number, tipo: "INCOME" | "EXPENSE"): string {
  return `${tipo === "INCOME" ? "+" : "−"} R$ ${convertNumberToCurrencyMask(Math.abs(valor))}`;
}

// Datas ISO (yyyy-mm-dd) são manipuladas como texto: `new Date("2026-11-05")` seria UTC
// e voltaria para o dia anterior no fuso do Brasil.
function partes(iso: string): [number, number, number] {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [a, m, d];
}

export function formatarDataBR(iso: string): string {
  const [a, m, d] = partes(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

/** "05 nov" */
export function formatarDiaMes(iso: string): string {
  const [, m, d] = partes(iso);
  return `${String(d).padStart(2, "0")} ${MESES_CURTOS[m - 1]}`;
}

/** "5 de novembro" */
export function formatarDataExtensa(iso: string): string {
  const [, m, d] = partes(iso);
  return `${d} de ${MESES[m - 1]}`;
}

export function diaDaSemana(iso: string): string {
  const [a, m, d] = partes(iso);
  return DIAS_SEMANA[new Date(a, m - 1, d).getDay()];
}

/** "Novembro de 2026" a partir de "2026-11". */
export function nomeMes(chave: string): string {
  const [a, m] = chave.split("-").map(Number);
  return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} de ${a}`;
}

/** "nov/26" a partir de "2026-11". */
export function mesCurto(chave: string): string {
  const [a, m] = chave.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
}

export function chaveDoMes(iso: string): string {
  return iso.slice(0, 7);
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Último dia do mês de (hoje + N meses): "3 meses" = o restante deste mês + os 3 seguintes. */
export function fimDoHorizonte(meses: number, hoje: Date = new Date()): string {
  return isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() + meses + 1, 0));
}

export const LABEL_ORIGEM: Record<OrigemCompromisso, string> = {
  FATURA: "Fatura do cartão",
  PARCELA: "Parcela",
  RECORRENTE: "Recorrente",
  LANCAMENTO: "Lançamento avulso",
};

export const ICONE_ORIGEM: Record<OrigemCompromisso, string> = {
  FATURA: "bi-credit-card-2-front",
  PARCELA: "bi-layers",
  RECORRENTE: "bi-arrow-repeat",
  LANCAMENTO: "bi-receipt",
};

/** Cores das origens nas barras de composição — da paleta Bootstrap já usada nos relatórios. */
export const COR_ORIGEM: Record<OrigemCompromisso, string> = {
  FATURA: "#0d6efd",
  PARCELA: "#6f42c1",
  RECORRENTE: "#fd7e14",
  LANCAMENTO: "#6c757d",
};

export function rotuloOrigem(evento: Pick<EventoCompromisso, "origem" | "tipo" | "parcela">): string {
  if (evento.tipo === "INCOME") {
    return evento.origem === "RECORRENTE" ? "Receita recorrente" : "Receita prevista";
  }
  if (evento.origem === "PARCELA" && evento.parcela) return `Parcela ${evento.parcela}`;
  return LABEL_ORIGEM[evento.origem];
}

export const LABEL_CONFIANCA = {
  ALTA: "Confiança alta",
  MEDIA: "Confiança média",
  BAIXA: "Confiança baixa",
} as const;

/** Erro de digitação da data final (DD/MM/AAAA); null enquanto incompleta ou válida. */
export function erroDataFinal(dataFinalBR: string): string | null {
  if (dataFinalBR.length < 10) return null;
  return isDataBRValida(dataFinalBR) ? null : "Data inválida.";
}
