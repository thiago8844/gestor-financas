import { SituacaoBadge } from "./SituacaoBadge";
import { formatarDataBr, formatarMoeda } from "../../../utils/emprestimo";
import type { Emprestimo, ParcelaEmprestimo } from "../../../types/emprestimo";

type Props = {
  emprestimo: Emprestimo;
  parcelas: ParcelaEmprestimo[];
  onBaixar: (parcela: ParcelaEmprestimo) => void;
  onReverter: (parcela: ParcelaEmprestimo) => void;
  onNaoPaga: (parcela: ParcelaEmprestimo) => void;
};

/** Tabela no desktop; lista de cartões no celular (cronograma com 5 colunas não cabe). */
export function ParcelasLista({ emprestimo, parcelas, onBaixar, onReverter, onNaoPaga }: Props) {
  const tomado = emprestimo.direction === "TOMADO";

  const acoes = (p: ParcelaEmprestimo) => (
    <div className="d-flex flex-wrap gap-1 justify-content-end">
      {(p.status === "PREVISTA" || p.status === "PARCIAL") && (
        <>
          <button type="button" className="btn btn-sm btn-success" onClick={() => onBaixar(p)}>
            <i className="bi bi-check2-circle me-1"></i>
            {tomado ? "Paga" : "Recebida"}
          </button>
          {p.overdue && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onNaoPaga(p)} title="Registrar que não foi pago">
              <i className="bi bi-x-circle me-1"></i>
              Não paga
            </button>
          )}
        </>
      )}
      {p.paid_amount > 0 && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onReverter(p)} title="Desfazer pagamento">
          <i className="bi bi-arrow-counterclockwise"></i>
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="table-responsive d-none d-md-block">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimento</th>
              <th className="text-end">Principal</th>
              <th className="text-end">Juros</th>
              <th className="text-end">Parcela</th>
              <th className="text-end">{tomado ? "Pago" : "Recebido"}</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.id} className={p.status === "CANCELADA" ? "text-muted" : ""}>
                <td>{p.number}</td>
                <td>{formatarDataBr(p.due_date)}</td>
                <td className="text-end">{formatarMoeda(p.principal_amount)}</td>
                <td className="text-end">{formatarMoeda(p.interest_amount)}</td>
                <td className="text-end fw-semibold">{formatarMoeda(p.expected_amount)}</td>
                <td className="text-end">{p.paid_amount > 0 ? formatarMoeda(p.paid_amount) : "-"}</td>
                <td><SituacaoBadge parcela={p} direcao={emprestimo.direction} /></td>
                <td>{acoes(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="d-md-none d-flex flex-column gap-2">
        {parcelas.map((p) => (
          <div key={p.id} className="border rounded p-3">
            <div className="d-flex justify-content-between align-items-start mb-1">
              <strong>Parcela {p.number}</strong>
              <SituacaoBadge parcela={p} direcao={emprestimo.direction} />
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">{formatarDataBr(p.due_date)}</span>
              <span className="fw-semibold">{formatarMoeda(p.expected_amount)}</span>
            </div>
            <small className="text-muted d-block mb-2">
              Principal {formatarMoeda(p.principal_amount)} · Juros {formatarMoeda(p.interest_amount)}
              {p.paid_amount > 0 && ` · ${tomado ? "Pago" : "Recebido"} ${formatarMoeda(p.paid_amount)}`}
            </small>
            {acoes(p)}
          </div>
        ))}
      </div>
    </>
  );
}
