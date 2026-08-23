import type { RecorrenciaTransacao } from "../../types/recorrencia";

const DIAS_SEMANA_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function formatarFrequencia(recorrencia: RecorrenciaTransacao): string {
  const { frequency, interval, days_of_week, day_of_month, month_of_year } = recorrencia;

  switch (frequency) {
    case "DAILY":
      return interval > 1 ? `A cada ${interval} dias` : "Todo dia";
    case "WEEKLY": {
      const dias = (days_of_week || [])
        .slice()
        .sort()
        .map((d) => DIAS_SEMANA_ABREV[d])
        .join(", ");
      return `Toda ${dias || "-"}`;
    }
    case "MONTHLY":
      return interval > 1
        ? `A cada ${interval} meses, dia ${day_of_month}`
        : `Todo dia ${day_of_month}`;
    case "YEARLY": {
      const mes = month_of_year ? MESES_ABREV[month_of_year - 1] : "-";
      return interval > 1
        ? `A cada ${interval} anos, ${day_of_month}/${mes}`
        : `Todo ${day_of_month}/${mes}`;
    }
    default:
      return "-";
  }
}
