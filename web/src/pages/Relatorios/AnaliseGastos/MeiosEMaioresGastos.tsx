import { brl, formatarDataBR } from "../CompromissosFuturos/formatadores";
import { SituacaoBarra } from "./SituacaoBarra";
import type { GastoPorMeio, LancamentoGasto } from "../../../types/relatorio";

export function MeiosEMaioresGastos({ meios, maiores }: { meios: GastoPorMeio[]; maiores: LancamentoGasto[] }) {
  return (
    <div className="row g-3">
      <div className="col-12 col-xl-6">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-body">
            <h6 className="fw-bold mb-3">Por meio de pagamento</h6>
            {meios.length === 0 ? (
              <p className="small text-muted mb-0">Sem gastos no período.</p>
            ) : (
              meios.map((m) => (
                <div key={`${m.tipo}-${m.nome}`} className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>
                      <i className={`bi ${m.tipo === "CARTAO" ? "bi-credit-card" : "bi-wallet2"} me-2`}></i>
                      {m.nome}
                    </span>
                    <span className="fw-semibold">
                      {brl(m.total)} <span className="text-muted small fw-normal">{m.percentual !== null ? `${m.percentual.toFixed(0)}%` : ""}</span>
                    </span>
                  </div>
                  <SituacaoBarra somas={m} legenda={false} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-6">
        <div className="card shadow-sm border-0 h-100">
          <div className="card-body">
            <h6 className="fw-bold mb-3">Maiores gastos</h6>
            {maiores.length === 0 ? (
              <p className="small text-muted mb-0">Sem gastos no período.</p>
            ) : (
              <ol className="list-unstyled mb-0">
                {maiores.map((l, i) => (
                  <li key={`${l.id ?? "p"}-${i}`} className="d-flex justify-content-between gap-2 py-1 border-bottom">
                    <span>
                      <span className="text-muted me-2">{i + 1}.</span>
                      {l.descricao}
                      {l.parcela && <span className="text-muted ms-1">{l.parcela}</span>}
                      <div className="small text-muted ms-4">{l.categoria} · {formatarDataBR(l.data)}</div>
                    </span>
                    <span className="fw-semibold text-nowrap">{l.valor !== null ? brl(l.valor) : "-"}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
