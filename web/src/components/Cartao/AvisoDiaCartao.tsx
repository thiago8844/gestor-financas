const DIAS_QUE_PODEM_NAO_EXISTIR = [29, 30, 31];

/** Aviso para quando o dia escolhido não existe em todo mês (ex.: fevereiro não tem dia 29-31). */
export function AvisoDiaCartao({ dia }: { dia: number | string | undefined }) {
  const diaNumero = Number(dia);

  if (!diaNumero || !DIAS_QUE_PODEM_NAO_EXISTIR.includes(diaNumero)) {
    return null;
  }

  return (
    <div className="form-text text-warning">
      <i className="bi bi-exclamation-triangle me-1"></i>
      Nos meses que não têm o dia {diaNumero}, o sistema usa o último dia do mês.
    </div>
  );
}
