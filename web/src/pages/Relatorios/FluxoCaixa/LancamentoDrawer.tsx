import { Offcanvas } from "react-bootstrap";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { Transacao } from "../../../types/transacao";

type Props = {
  transacao: Transacao | null;
  onClose: () => void;
};

export function LancamentoDrawer({ transacao, onClose }: Props) {
  return (
    <Offcanvas show={!!transacao} onHide={onClose} placement="end">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Detalhes do lançamento</Offcanvas.Title>
      </Offcanvas.Header>

      {transacao && (
        <Offcanvas.Body>
          <h4 className={transacao.type === "EXPENSE" ? "text-danger" : "text-success"}>
            {transacao.type === "EXPENSE" ? "- " : "+ "}
            {convertNumberToCurrencyMask(transacao.amount ?? 0)}
          </h4>

          <p className="fs-5 mb-4">{transacao.description || "Sem descrição"}</p>

          <dl className="row">
            <dt className="col-5 text-muted fw-normal">Categoria</dt>
            <dd className="col-7">
              {transacao.categoria ? (
                <span className="badge text-bg-secondary">{transacao.categoria.name}</span>
              ) : (
                "-"
              )}
            </dd>

            <dt className="col-5 text-muted fw-normal">Conta</dt>
            <dd className="col-7">{transacao.conta?.name ?? "-"}</dd>

            <dt className="col-5 text-muted fw-normal">Data</dt>
            <dd className="col-7">{transacao.date ?? "-"}</dd>

            <dt className="col-5 text-muted fw-normal">Vencimento</dt>
            <dd className="col-7">{transacao.due_date ?? "-"}</dd>

            <dt className="col-5 text-muted fw-normal">Status</dt>
            <dd className="col-7">
              {transacao.status === "PAID" ? (
                <span className="badge text-bg-success">PAGO</span>
              ) : (
                <span className="badge text-bg-secondary">PENDENTE</span>
              )}
            </dd>

            {transacao.is_installment && (
              <>
                <dt className="col-5 text-muted fw-normal">Parcela</dt>
                <dd className="col-7">
                  {transacao.installment_number}/{transacao.installment_total}
                </dd>
              </>
            )}
          </dl>
        </Offcanvas.Body>
      )}
    </Offcanvas>
  );
}
