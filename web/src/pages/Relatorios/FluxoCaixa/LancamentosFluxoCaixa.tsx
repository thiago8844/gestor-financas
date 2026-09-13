import { convertNumberToCurrencyMask } from "../../../utils";
import type { Transacao } from "../../../types/transacao";

type Props = {
  lancamentos: Transacao[];
  onSelecionarTransacao: (transacao: Transacao) => void;
};

export function LancamentosFluxoCaixa({ lancamentos, onSelecionarTransacao }: Props) {
  return (
    <div className="table-responsive shadow-sm rounded">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Conta</th>
            <th>Status</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {lancamentos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-5 text-muted">
                Nenhum lançamento encontrado com estes filtros.
              </td>
            </tr>
          )}

          {lancamentos.map((transacao) => (
            <tr key={transacao.id} role="button" onClick={() => onSelecionarTransacao(transacao)}>
              <td>{transacao.date ?? "-"}</td>
              <td>{transacao.description || "Sem descrição"}</td>
              <td>
                {transacao.categoria ? (
                  <span className="badge text-bg-secondary">{transacao.categoria.name}</span>
                ) : (
                  "-"
                )}
              </td>
              <td>{transacao.conta?.name ?? "-"}</td>
              <td>
                {transacao.status === "PAID" ? (
                  <span className="badge text-bg-success">PAGO</span>
                ) : (
                  <span className="badge text-bg-secondary">PENDENTE</span>
                )}
              </td>
              <td className={`fw-semibold ${transacao.type === "EXPENSE" ? "text-danger" : "text-success"}`}>
                {transacao.type === "EXPENSE" ? "- " : "+ "}
                {convertNumberToCurrencyMask(transacao.amount ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
