import { Link } from "react-router-dom";
import { SituacaoBadge } from "./SituacaoBadge";
import { formatarDataBr, formatarMoeda, resumoContrato, rotuloDirecao, rotuloModalidade } from "../../../utils/emprestimo";
import type { Emprestimo, ParcelaEmprestimo } from "../../../types/emprestimo";

type Props = {
  emprestimo: Emprestimo;
  onBaixar: (emprestimo: Emprestimo, parcela: ParcelaEmprestimo) => void;
};

export function CardEmprestimo({ emprestimo, onBaixar }: Props) {
  const tomado = emprestimo.direction === "TOMADO";
  const proxima = emprestimo.next_installment;
  const ativo = emprestimo.status === "ATIVO";
  const total = emprestimo.installments_total ?? 0;
  const pagas = emprestimo.installments_paid ?? 0;
  const progresso = total > 0 && !emprestimo.open_term ? Math.round((pagas / total) * 100) : null;

  return (
    <div className={`card shadow-sm border-0 h-100 ${ativo ? "" : "opacity-75"}`}>
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <span className={`badge text-bg-${tomado ? "danger" : "success"} me-2`}>
              <i className={`bi ${tomado ? "bi-arrow-up-right" : "bi-arrow-down-left"} me-1`}></i>
              {rotuloDirecao(emprestimo.direction)}
            </span>
            {emprestimo.status !== "ATIVO" && (
              <span className="badge text-bg-secondary">{emprestimo.status === "QUITADO" ? "Quitado" : "Cancelado"}</span>
            )}
            <h5 className="mt-2 mb-0 text-truncate">
              <Link to={`/emprestimos/${emprestimo.id}`} className="text-decoration-none stretched-link-text">
                {emprestimo.counterparty}
              </Link>
            </h5>
            {emprestimo.description && <small className="text-muted d-block text-truncate">{emprestimo.description}</small>}
          </div>
          <div className="text-end flex-shrink-0">
            <small className="text-muted d-block">{tomado ? "Falta pagar" : "Falta receber"}</small>
            <span className="fw-semibold">{formatarMoeda(emprestimo.principal_balance)}</span>
          </div>
        </div>

        <small className="text-muted d-block">{resumoContrato(emprestimo)}</small>
        <small className="text-muted d-block mb-3">{rotuloModalidade(emprestimo.modality)}</small>

        {progresso !== null && (
          <div className="mb-3">
            <div className="progress" style={{ height: 6 }} role="progressbar" aria-label="Parcelas quitadas" aria-valuenow={progresso} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar bg-success" style={{ width: `${progresso}%` }}></div>
            </div>
            <small className="text-muted">{pagas} de {total} parcelas {tomado ? "pagas" : "recebidas"}</small>
          </div>
        )}

        <div className="mt-auto">
          {proxima && ativo ? (
            <div className="border rounded p-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <small className="text-muted d-block">
                  Próxima: parcela {proxima.number} · {formatarDataBr(proxima.due_date)}
                </small>
                <span className="fw-semibold me-2">{formatarMoeda(proxima.remaining_amount)}</span>
                <SituacaoBadge parcela={proxima} direcao={emprestimo.direction} />
              </div>
              <button type="button" className="btn btn-sm btn-success" onClick={() => onBaixar(emprestimo, proxima)}>
                <i className="bi bi-check2-circle me-1"></i>
                {tomado ? "Marcar como paga" : "Marcar como recebida"}
              </button>
            </div>
          ) : (
            <small className="text-muted">{ativo ? "Sem parcelas em aberto." : "Contrato encerrado."}</small>
          )}
        </div>
      </div>
    </div>
  );
}
