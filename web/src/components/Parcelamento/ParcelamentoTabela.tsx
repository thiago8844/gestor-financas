import InputMoeda from "../InputMoeda";
import type { ParcelaLinha } from "../../hooks/useParcelamento";

type Props = {
  parcelas: ParcelaLinha[];
  onChangeParcela: (index: number, dados: Partial<ParcelaLinha>) => void;
};

export function ParcelamentoTabela({ parcelas, onChangeParcela }: Props) {
  if (parcelas.length === 0) {
    return (
      <div className="alert alert-secondary small mb-0">
        Informe o valor total, o número de parcelas e a 1ª data de vencimento e clique em
        "Gerar parcelas".
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th style={{ width: 70 }}>Parcela</th>
            <th>Vencimento</th>
            <th>Valor</th>
            <th className="text-center">Paga?</th>
            <th>Data do pagamento</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((parcela, index) => (
            <tr key={parcela.number}>
              <td>{parcela.number}</td>
              <td>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={parcela.due_date}
                  onChange={(e) => onChangeParcela(index, { due_date: e.target.value })}
                />
              </td>
              <td style={{ minWidth: 130 }}>
                <InputMoeda
                  value={parcela.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChangeParcela(index, { amount: e.target.value })
                  }
                />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={parcela.status === "PAID"}
                  onChange={(e) =>
                    onChangeParcela(index, {
                      status: e.target.checked ? "PAID" : "PENDING",
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  disabled={parcela.status !== "PAID"}
                  value={parcela.date}
                  onChange={(e) => onChangeParcela(index, { date: e.target.value })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
