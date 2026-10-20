import { convertNumberToCurrencyMask } from "../../utils";

type Props = {
  /** Soma das parcelas menos o total da compra, em reais. 0 = confere. */
  diferenca: number;
};

export function IndicadorSomaParcelas({ diferenca }: Props) {
  const confere = Math.abs(diferenca) < 0.005;

  if (confere) {
    return (
      <div className="small text-success mt-2">
        <i className="bi bi-check-circle me-1"></i>A soma das parcelas confere com o total.
      </div>
    );
  }

  return (
    <div className="alert alert-warning small mt-2 mb-0">
      <i className="bi bi-exclamation-triangle me-1"></i>
      A soma das parcelas {diferenca > 0 ? "passa" : "fica abaixo"} do total em{" "}
      <strong>{convertNumberToCurrencyMask(Math.abs(diferenca))}</strong>. Ajuste as parcelas para salvar.
    </div>
  );
}
