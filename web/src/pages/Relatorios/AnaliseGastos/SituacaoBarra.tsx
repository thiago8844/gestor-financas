import { brl } from "../CompromissosFuturos/formatadores";
import { COR_PAGO, COR_PENDENTE, COR_PREVISTO } from "./constantes";
import type { SomasGasto } from "../../../types/relatorio";

/** Barra pago / a pagar / previsto de um conjunto de gastos, com legenda opcional. */
export function SituacaoBarra({ somas, legenda = true }: { somas: SomasGasto; legenda?: boolean }) {
  const parte = (v: number) => (somas.total > 0 ? (v / somas.total) * 100 : 0);

  return (
    <div>
      <div className="progress" style={{ height: 8 }} role="img" aria-label="Pago, a pagar e previsto">
        <div className="progress-bar" style={{ width: `${parte(somas.pago)}%`, background: COR_PAGO }} title={`Pago ${brl(somas.pago)}`}></div>
        <div className="progress-bar" style={{ width: `${parte(somas.pendente)}%`, background: COR_PENDENTE }} title={`A pagar ${brl(somas.pendente)}`}></div>
        <div className="progress-bar" style={{ width: `${parte(somas.previsto)}%`, background: COR_PREVISTO }} title={`Previsto ${brl(somas.previsto)}`}></div>
      </div>
      {legenda && (
        <div className="d-flex flex-wrap gap-3 small text-muted mt-1">
          <span><i className="bi bi-circle-fill me-1" style={{ color: COR_PAGO, fontSize: 8 }}></i>Pago {brl(somas.pago)}</span>
          {somas.pendente > 0 && <span><i className="bi bi-circle-fill me-1" style={{ color: COR_PENDENTE, fontSize: 8 }}></i>A pagar {brl(somas.pendente)}</span>}
          {somas.previsto > 0 && <span><i className="bi bi-circle-fill me-1" style={{ color: COR_PREVISTO, fontSize: 8 }}></i>Previsto {brl(somas.previsto)}</span>}
        </div>
      )}
    </div>
  );
}

export function Variacao({ valor }: { valor: number | null }) {
  if (valor === null) return null;
  const sobe = valor > 0;
  return (
    <span className={`small ms-2 ${valor === 0 ? "text-muted" : sobe ? "text-danger" : "text-success"}`} title="Variação em relação ao período anterior">
      <i className={`bi ${valor === 0 ? "bi-dash" : sobe ? "bi-arrow-up-right" : "bi-arrow-down-right"} me-1`}></i>
      {Math.abs(valor).toFixed(1).replace(".", ",")}%
    </span>
  );
}
