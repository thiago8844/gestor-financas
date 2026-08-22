import InputMoeda from "../InputMoeda";
import type { useParcelamento } from "../../hooks/useParcelamento";
import { ParcelamentoTabela } from "./ParcelamentoTabela";

type Props = {
  parcelamento: ReturnType<typeof useParcelamento>;
};

export function ParcelamentoCampos({ parcelamento }: Props) {
  const {
    valorTotal,
    setValorTotal,
    installmentTotal,
    setInstallmentTotal,
    primeiraDataVencimento,
    setPrimeiraDataVencimento,
    parcelas,
    gerarParcelas,
    atualizarParcela,
  } = parcelamento;

  return (
    <div className="border rounded p-3 mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Valor total da compra</label>
          <InputMoeda
            value={valorTotal}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorTotal(e.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Número de parcelas</label>
          <input
            type="number"
            min={2}
            max={60}
            className="form-control"
            value={installmentTotal}
            onChange={(e) => setInstallmentTotal(Number(e.target.value) || 2)}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">1ª data de vencimento</label>
          <input
            type="date"
            className="form-control"
            value={primeiraDataVencimento}
            onChange={(e) => setPrimeiraDataVencimento(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <button
            type="button"
            className="btn btn-outline-primary w-100"
            onClick={gerarParcelas}
          >
            Gerar parcelas
          </button>
        </div>
      </div>

      <hr />

      <ParcelamentoTabela parcelas={parcelas} onChangeParcela={atualizarParcela} />
    </div>
  );
}
