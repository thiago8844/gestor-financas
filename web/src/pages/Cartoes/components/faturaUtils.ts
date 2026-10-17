import type { Fatura, StatusFatura } from "../../../types/fatura";
import type { Transacao } from "../../../types/transacao";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Quantos meses à frente da fatura atual aparecem sem precisar clicar em "mostrar". */
export const MESES_A_FRENTE = 18;

export function formatarMesAno(dataStr: string) {
  const [ano, mes] = dataStr.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

export function formatarDataBr(dataStr: string | null | undefined) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

export const STATUS_LABEL: Record<StatusFatura, string> = {
  ABERTA: "Aberta",
  FECHADA: "Fechada",
  VENCIDA: "Vencida",
  PAGA: "Paga",
};

export const STATUS_BADGE: Record<StatusFatura, string> = {
  ABERTA: "text-bg-primary",
  FECHADA: "text-bg-warning",
  VENCIDA: "text-bg-danger",
  PAGA: "text-bg-success",
};

/** Cor de destaque (variável do Bootstrap) usada na faixa lateral do card da fatura. */
export const STATUS_COR: Record<StatusFatura, string> = {
  ABERTA: "var(--bs-primary)",
  FECHADA: "var(--bs-warning)",
  VENCIDA: "var(--bs-danger)",
  PAGA: "var(--bs-success)",
};

/** Quanto o lançamento pesa na fatura: compra soma, crédito (estorno, saldo levado para a próxima) subtrai. */
export function valorNaFatura(p: Transacao) {
  const valor = Number(p.amount ?? 0);
  return p.type === "INCOME" ? -valor : valor;
}

/** Fatura que ainda pode ser paga (tem algo pendente, inclusive só crédito pendente). */
export function faturaPagavel(f: Fatura) {
  return f.id !== null && f.status !== "PAGA";
}

/** "YYYY-MM" de uma data (ou do mês de referência da fatura). */
export function chaveMes(dataStr: string) {
  return dataStr.slice(0, 7);
}

export function chaveMesAtual(hoje = new Date()) {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function somarMeses(chave: string, meses: number) {
  const [ano, mes] = chave.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);
  return chaveMesAtual(data);
}

export type FaturasAgrupadas = {
  anteriores: Fatura[];
  /** Da fatura do mês atual até 18 meses à frente, em ordem cronológica. */
  principais: Fatura[];
  posteriores: Fatura[];
};

export function agruparFaturas(faturas: Fatura[]): FaturasAgrupadas {
  const atual = chaveMesAtual();
  const limite = somarMeses(atual, MESES_A_FRENTE);

  const ordenadas = [...faturas].sort((a, b) =>
    a.reference_month.localeCompare(b.reference_month)
  );

  return {
    anteriores: ordenadas.filter((f) => chaveMes(f.reference_month) < atual),
    principais: ordenadas.filter((f) => {
      const k = chaveMes(f.reference_month);
      return k >= atual && k <= limite;
    }),
    posteriores: ordenadas.filter((f) => chaveMes(f.reference_month) > limite),
  };
}

// ---------- Filtros da fatura (tela do modal e exportações) ----------

export type FiltrosFatura = {
  busca: string;
  categoria: string;
  status: "" | "PAID" | "PENDING";
  parcelamento: "" | "parcelada" | "avista";
  compraDe: string;
  compraAte: string;
  valorMin: string;
  valorMax: string;
  ordem: "compra_asc" | "compra_desc" | "valor_desc" | "valor_asc" | "descricao";
};

export const FILTROS_FATURA_INICIAIS: FiltrosFatura = {
  busca: "",
  categoria: "",
  status: "",
  parcelamento: "",
  compraDe: "",
  compraAte: "",
  valorMin: "",
  valorMax: "",
  ordem: "compra_asc",
};

export function contarFiltrosAtivos(f: FiltrosFatura) {
  // A ordenação não conta como filtro
  return Object.entries(f).filter(([campo, v]) => campo !== "ordem" && v !== "").length;
}

export function filtrarParcelas(parcelas: Transacao[], f: FiltrosFatura) {
  const busca = f.busca.trim().toLowerCase();
  const min = f.valorMin !== "" ? Number(f.valorMin) : null;
  const max = f.valorMax !== "" ? Number(f.valorMax) : null;

  const lista = parcelas.filter((p) => {
    const compra = p.purchase_date?.slice(0, 10) ?? "";
    const valor = p.amount ?? 0;

    if (busca && !p.description.toLowerCase().includes(busca)) return false;
    if (f.categoria === "sem" && p.categoria) return false;
    if (f.categoria && f.categoria !== "sem" && String(p.categoria?.id) !== f.categoria) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.parcelamento === "parcelada" && !p.is_installment) return false;
    if (f.parcelamento === "avista" && p.is_installment) return false;
    if (f.compraDe && (!compra || compra < f.compraDe)) return false;
    if (f.compraAte && (!compra || compra > f.compraAte)) return false;
    if (min !== null && valor < min) return false;
    if (max !== null && valor > max) return false;
    return true;
  });

  const porCompra = (p: Transacao) => p.purchase_date?.slice(0, 10) ?? "";

  return lista.sort((a, b) => {
    switch (f.ordem) {
      case "compra_desc":
        return porCompra(b).localeCompare(porCompra(a)) || b.id - a.id;
      case "valor_desc":
        return (b.amount ?? 0) - (a.amount ?? 0);
      case "valor_asc":
        return (a.amount ?? 0) - (b.amount ?? 0);
      case "descricao":
        return a.description.localeCompare(b.description, "pt-BR");
      default:
        return porCompra(a).localeCompare(porCompra(b)) || a.id - b.id;
    }
  });
}

export function descreverFiltros(f: FiltrosFatura, nomeCategoria?: string) {
  const partes: string[] = [];
  if (f.busca) partes.push(`Busca: "${f.busca}"`);
  if (f.categoria) partes.push(`Categoria: ${f.categoria === "sem" ? "Sem categoria" : nomeCategoria ?? f.categoria}`);
  if (f.status) partes.push(`Status: ${f.status === "PAID" ? "Pagas" : "Pendentes"}`);
  if (f.parcelamento) partes.push(f.parcelamento === "parcelada" ? "Somente parceladas" : "Somente à vista");
  if (f.compraDe) partes.push(`Compra a partir de ${formatarDataBr(f.compraDe)}`);
  if (f.compraAte) partes.push(`Compra até ${formatarDataBr(f.compraAte)}`);
  if (f.valorMin) partes.push(`Valor ≥ ${f.valorMin}`);
  if (f.valorMax) partes.push(`Valor ≤ ${f.valorMax}`);
  return partes.join(" · ");
}
