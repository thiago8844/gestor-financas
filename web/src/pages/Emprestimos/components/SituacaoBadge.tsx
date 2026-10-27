import { situacaoDaParcela } from "../../../utils/emprestimo";
import type { DirecaoEmprestimo, ParcelaEmprestimo } from "../../../types/emprestimo";

/** Status da parcela sempre em texto, com a cor só como reforço. */
export function SituacaoBadge({ parcela, direcao }: { parcela: ParcelaEmprestimo; direcao: DirecaoEmprestimo }) {
  const { texto, variante } = situacaoDaParcela(parcela, direcao);
  return <span className={`badge text-bg-${variante}`}>{texto}</span>;
}
