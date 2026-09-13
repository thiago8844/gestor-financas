// Helpers de período compartilhados entre os relatórios — presets rápidos
// (Este mês / Mês passado / 3 meses / Ano / Personalizado) resolvidos para
// datas ISO (yyyy-mm-dd), no mesmo espírito do resolvedor de período do Dashboard.

export type PresetPeriodo =
  | "este_mes"
  | "mes_passado"
  | "ultimos_3_meses"
  | "ano_atual"
  | "personalizado";

const toISO = (d: Date) => d.toISOString().slice(0, 10);

export function brParaISO(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function isDataBRValida(br: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return false;
  const [d, m, y] = br.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function mascararData(valor: string): string {
  const digits = valor.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function resolverPresetPeriodo(
  preset: PresetPeriodo,
  dataInicialBR?: string,
  dataFinalBR?: string
): { data_inicial: string; data_final: string } | null {
  const hoje = new Date();

  if (preset === "personalizado") {
    if (
      dataInicialBR &&
      isDataBRValida(dataInicialBR) &&
      dataFinalBR &&
      isDataBRValida(dataFinalBR)
    ) {
      const inicio = brParaISO(dataInicialBR);
      const fim = brParaISO(dataFinalBR);
      return inicio <= fim ? { data_inicial: inicio, data_final: fim } : null;
    }
    return null;
  }

  if (preset === "este_mes") {
    return {
      data_inicial: toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
      data_final: toISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    };
  }

  if (preset === "mes_passado") {
    return {
      data_inicial: toISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      data_final: toISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    };
  }

  if (preset === "ultimos_3_meses") {
    return {
      data_inicial: toISO(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)),
      data_final: toISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    };
  }

  // ano_atual
  return {
    data_inicial: toISO(new Date(hoje.getFullYear(), 0, 1)),
    data_final: toISO(new Date(hoje.getFullYear(), 11, 31)),
  };
}

/** Granularidade de agrupamento sugerida conforme a duração do período. */
export function sugerirAgrupamento(dataInicial: string, dataFinal: string): "DAILY" | "WEEKLY" | "MONTHLY" {
  const diffDias =
    (new Date(dataFinal).getTime() - new Date(dataInicial).getTime()) / (1000 * 60 * 60 * 24);

  if (diffDias <= 31) return "DAILY";
  if (diffDias <= 120) return "WEEKLY";
  return "MONTHLY";
}
