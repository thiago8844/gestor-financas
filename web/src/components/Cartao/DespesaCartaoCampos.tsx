import { useState } from "react";
import InputMoeda from "../InputMoeda";
import { convertNumberToCurrencyMask } from "../../utils";
import type { useDespesaCartao } from "../../hooks/useDespesaCartao";
import type { Cartao } from "../../types/cartao";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(data: Date) {
  return `${MESES[data.getMonth()]}/${data.getFullYear()}`;
}

function formatarDataBr(data: Date) {
  return data.toLocaleDateString("pt-BR");
}

type Props = {
  despesaCartao: ReturnType<typeof useDespesaCartao>;
  cartao: Cartao | undefined;
};

export function DespesaCartaoCampos({ despesaCartao, cartao }: Props) {
  const {
    valorTotal,
    setValorTotal,
    purchaseDate,
    setPurchaseDate,
    installmentTotal,
    setInstallmentTotal,
    gerarPreview,
  } = despesaCartao;

  const [mostrarParcelas, setMostrarParcelas] = useState(false);

  const parcelas = gerarPreview(cartao);
  const primeiraParcela = parcelas[0];
  const isParcelado = installmentTotal > 1;

  return (
    <>
      <div className="mb-3">
        <label className="form-label">
          Valor total da compra <span className="text-danger">*</span>
        </label>
        <InputMoeda
          value={valorTotal}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorTotal(e.target.value)}
          placeholder="0,00"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="purchase_date" className="form-label">
          Data da compra
        </label>
        <input
          type="date"
          id="purchase_date"
          className="form-control"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="installment_total" className="form-label">
          Quantidade de parcelas
        </label>
        <input
          type="number"
          id="installment_total"
          min={1}
          max={60}
          className="form-control"
          value={installmentTotal}
          onChange={(e) => setInstallmentTotal(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>

      {primeiraParcela && (
        <div className="alert alert-info">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <span>
              {isParcelado ? (
                <>
                  {installmentTotal} × {convertNumberToCurrencyMask(primeiraParcela.amount)}, começando na fatura de{" "}
                  <strong>{formatarMesAno(primeiraParcela.referenceMonth)}</strong> (vence{" "}
                  {formatarDataBr(primeiraParcela.dueDate)})
                </>
              ) : (
                <>
                  Vai para a fatura de <strong>{formatarMesAno(primeiraParcela.referenceMonth)}</strong>, vencimento
                  em {formatarDataBr(primeiraParcela.dueDate)}
                </>
              )}
            </span>

            {isParcelado && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0"
                onClick={() => setMostrarParcelas((v) => !v)}
              >
                {mostrarParcelas ? "Ocultar parcelas" : "Ver parcelas"}
              </button>
            )}
          </div>
        </div>
      )}

      {mostrarParcelas && isParcelado && (
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Valor</th>
              <th>Fatura</th>
              <th>Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((parcela) => (
              <tr key={parcela.number}>
                <td>
                  {parcela.number}/{installmentTotal}
                </td>
                <td>{convertNumberToCurrencyMask(parcela.amount)}</td>
                <td>{formatarMesAno(parcela.referenceMonth)}</td>
                <td>{formatarDataBr(parcela.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
