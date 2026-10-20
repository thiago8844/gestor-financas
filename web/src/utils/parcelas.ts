/**
 * Divisão de uma compra em parcelas. Espelha App\Support\DividirParcelas (backend): a soma é sempre
 * igual ao total e o que muda entre os modos é onde ficam os centavos que sobram, porque cada
 * banco/vendedor faz de um jeito.
 */
export type ModoCentavos = "ultima" | "primeira" | "espalhar";

export const MODOS_CENTAVOS: { valor: ModoCentavos; rotulo: string; ajuda: string }[] = [
  { valor: "ultima", rotulo: "Sobra na última parcela", ajuda: "Ex.: 333,33 / 333,33 / 333,34" },
  { valor: "primeira", rotulo: "Sobra na primeira parcela", ajuda: "Ex.: 333,34 / 333,33 / 333,33" },
  { valor: "espalhar", rotulo: "Espalhar 1 centavo nas primeiras", ajuda: "Ex.: 25,01 / 25,01 / 25,00 / 25,00" },
];

/** Divide em centavos inteiros (evita erro de ponto flutuante). */
export function dividirEmCentavos(valorTotal: number, total: number, modo: ModoCentavos = "ultima"): number[] {
  const centavosTotal = Math.round(valorTotal * 100);
  const base = Math.floor(centavosTotal / total);
  const resto = centavosTotal - base * total;

  return Array.from({ length: total }, (_, i) => {
    if (modo === "primeira") return base + (i === 0 ? resto : 0);
    if (modo === "espalhar") return base + (i < resto ? 1 : 0);
    return base + (i === total - 1 ? resto : 0);
  });
}

export function somaEmCentavos(valores: number[]): number {
  return valores.reduce((acc, v) => acc + Math.round(v * 100), 0);
}

/** Diferença (em reais) entre a soma das parcelas e o total. 0 = bate. */
export function diferencaEntreSomaETotal(valores: number[], valorTotal: number): number {
  return (somaEmCentavos(valores) - Math.round(valorTotal * 100)) / 100;
}

/** Formata uma data local como YYYY-MM-DD sem passar por UTC (toISOString desloca o dia). */
export function formatarDataISO(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Soma meses a uma data YYYY-MM-DD limitando ao último dia do mês (31/jan + 1 mês = 28/fev,
 * e não 3/mar como o Date faz por padrão).
 */
export function adicionarMesesISO(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const alvo = new Date(ano, mes - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();

  alvo.setDate(Math.min(dia, ultimoDia));

  return formatarDataISO(alvo);
}
