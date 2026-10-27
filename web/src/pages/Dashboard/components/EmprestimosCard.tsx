import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getResumoEmprestimos } from "../../../api/emprestimos";
import { formatarDataBr, formatarMoeda } from "../../../utils/emprestimo";

/** Resumo de empréstimos no dashboard. Some quando a pessoa não tem nenhum empréstimo ativo. */
export function EmprestimosCard() {
  const { data } = useQuery({ queryKey: ["emprestimos-resumo"], queryFn: getResumoEmprestimos });

  if (!data || data.eu_devo.contratos + data.me_devem.contratos === 0) return null;

  return (
    <div className="container py-2">
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
            <div>
              <h6 className="fw-bold mb-1">
                <i className="bi bi-cash-coin me-2 text-primary"></i>
                Empréstimos
              </h6>
              <small className="text-muted">Valores emprestados ainda em aberto</small>
            </div>
            <Link to="/emprestimos" className="btn btn-sm btn-outline-primary">Ver todos</Link>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="border rounded p-3 h-100">
                <small className="text-muted d-block">Eu devo</small>
                <span className="fs-5 fw-semibold text-danger">{formatarMoeda(data.eu_devo.saldo_principal)}</span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="border rounded p-3 h-100">
                <small className="text-muted d-block">Me devem</small>
                <span className="fs-5 fw-semibold text-success">{formatarMoeda(data.me_devem.saldo_principal)}</span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="border rounded p-3 h-100">
                <small className="text-muted d-block">Atrasadas</small>
                <span className={`fs-5 fw-semibold ${data.atrasadas.quantidade > 0 ? "text-warning-emphasis" : ""}`}>
                  {data.atrasadas.quantidade > 0 ? `${data.atrasadas.quantidade} · ${formatarMoeda(data.atrasadas.valor)}` : "Nenhuma"}
                </span>
              </div>
            </div>
          </div>

          {data.proximos_vencimentos.length > 0 && (
            <ul className="list-unstyled mt-3 mb-0">
              {data.proximos_vencimentos.map((v) => (
                <li key={v.installment_id} className="d-flex justify-content-between gap-2 py-1 border-top">
                  <Link to={`/emprestimos/${v.loan_id}`} className="text-decoration-none">
                    <i className={`bi ${v.direction === "TOMADO" ? "bi-arrow-up-right text-danger" : "bi-arrow-down-left text-success"} me-2`}></i>
                    {v.counterparty} · parcela {v.number}
                  </Link>
                  <span className={v.overdue ? "text-danger" : "text-muted"}>
                    {formatarDataBr(v.due_date)} · {formatarMoeda(v.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
