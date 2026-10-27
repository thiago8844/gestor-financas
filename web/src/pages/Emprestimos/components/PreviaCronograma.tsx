import { useState } from "react";
import { formatarDataBr, formatarMoeda } from "../../../utils/emprestimo";
import type { PreviaEmprestimo } from "../../../types/emprestimo";

const LIMITE_INICIAL = 12;

/** Cronograma calculado ao vivo no cadastro, antes de salvar. */
export function PreviaCronograma({ previa, carregando, erro }: { previa?: PreviaEmprestimo; carregando: boolean; erro?: string | null }) {
  const [verTodas, setVerTodas] = useState(false);

  if (erro) return <div className="alert alert-warning mb-0">{erro}</div>;

  if (!previa) {
    return (
      <p className="text-muted mb-0">
        {carregando ? "Calculando..." : "Preencha os dados acima para ver o cronograma."}
      </p>
    );
  }

  const parcelas = verTodas ? previa.installments : previa.installments.slice(0, LIMITE_INICIAL);
  const escondidas = previa.installments.length - parcelas.length;

  return (
    <div style={{ opacity: carregando ? 0.6 : 1 }}>
      <div className="row g-3 mb-3">
        <div className="col-6">
          <div className="border rounded p-3 h-100">
            <small className="text-muted d-block">Total de juros</small>
            <span className="fs-5 fw-semibold">{formatarMoeda(previa.total_interest)}</span>
          </div>
        </div>
        <div className="col-6">
          <div className="border rounded p-3 h-100">
            <small className="text-muted d-block">{previa.open_term ? "Pago nos próximos 24 meses" : "Total a pagar"}</small>
            <span className="fs-5 fw-semibold">{formatarMoeda(previa.total_amount)}</span>
          </div>
        </div>
      </div>

      {previa.open_term && (
        <p className="small text-muted">
          Sem prazo final: o valor emprestado só volta quando você definir o encerramento do contrato.
        </p>
      )}

      <div className="table-responsive">
        <table className="table table-sm align-middle mb-2">
          <thead>
            <tr>
              <th>#</th>
              <th>Vencimento</th>
              <th className="text-end d-none d-sm-table-cell">Principal</th>
              <th className="text-end d-none d-sm-table-cell">Juros</th>
              <th className="text-end">Parcela</th>
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => (
              <tr key={p.number}>
                <td>{p.number}</td>
                <td>{formatarDataBr(p.due_date)}</td>
                <td className="text-end d-none d-sm-table-cell">{formatarMoeda(p.principal_amount)}</td>
                <td className="text-end d-none d-sm-table-cell">{formatarMoeda(p.interest_amount)}</td>
                <td className="text-end fw-semibold">{formatarMoeda(p.expected_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {escondidas > 0 && (
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setVerTodas(true)}>
          Ver mais {escondidas} parcelas
        </button>
      )}
    </div>
  );
}
