import { Fragment, useMemo, useState } from "react";
import { brl } from "../CompromissosFuturos/formatadores";
import { NATUREZA, NATUREZAS } from "./constantes";
import { SituacaoBarra, Variacao } from "./SituacaoBarra";
import { TabelaLancamentosGastos } from "./TabelaLancamentosGastos";
import type { GastoPorCategoria, LancamentoGasto } from "../../../types/relatorio";

type Props = {
  categorias: GastoPorCategoria[];
  lancamentos: LancamentoGasto[];
  /** PDF: tudo expandido. */
  modoImpressao?: boolean;
};

export function CategoriasGastos({ categorias, lancamentos, modoImpressao }: Props) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const chave = (c: GastoPorCategoria) => String(c.categoria_id ?? 0);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, LancamentoGasto[]>();
    lancamentos
      .filter((l) => l.valor !== null)
      .forEach((l) => mapa.set(String(l.categoria_id ?? 0), [...(mapa.get(String(l.categoria_id ?? 0)) ?? []), l]));
    return mapa;
  }, [lancamentos]);

  const todasAbertas = categorias.length > 0 && categorias.every((c) => abertas.has(chave(c)));

  const alternar = (k: string) =>
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(k)) novo.add(k);
      return novo;
    });

  if (categorias.length === 0) {
    return <div className="card shadow-sm border-0"><div className="card-body text-center text-muted py-5">Nenhum gasto no período.</div></div>;
  }

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white d-flex justify-content-between align-items-center py-3">
        <h6 className="fw-bold mb-0">Gastos por categoria</h6>
        {!modoImpressao && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAbertas(todasAbertas ? new Set() : new Set(categorias.map(chave)))}>
            <i className={`bi ${todasAbertas ? "bi-arrows-collapse" : "bi-arrows-expand"} me-1`}></i>
            {todasAbertas ? "Recolher tudo" : "Expandir tudo"}
          </button>
        )}
      </div>

      <div className="list-group list-group-flush">
        {categorias.map((c) => {
          const k = chave(c);
          const aberta = modoImpressao || abertas.has(k);
          const itens = porCategoria.get(k) ?? [];

          return (
            <Fragment key={k}>
              <div
                className="list-group-item py-3"
                role={modoImpressao ? undefined : "button"}
                onClick={modoImpressao ? undefined : () => alternar(k)}
              >
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <div className="fw-semibold">
                    {!modoImpressao && <i className={`bi bi-chevron-${aberta ? "down" : "right"} text-muted me-2`}></i>}
                    {c.categoria}
                    <span className="text-muted fw-normal small ms-2">{c.quantidade} {c.quantidade === 1 ? "lançamento" : "lançamentos"}</span>
                  </div>
                  <div className="text-end text-nowrap">
                    <span className="fw-semibold">{brl(c.total)}</span>
                    <span className="text-muted small ms-2">{c.percentual !== null ? `${c.percentual.toFixed(0)}%` : ""}</span>
                    <Variacao valor={c.variacao_percentual} />
                  </div>
                </div>

                <div className="mt-2"><SituacaoBarra somas={c} legenda={false} /></div>

                <div className="small text-muted mt-2 d-flex flex-wrap gap-3">
                  <span className="text-success">Pago {brl(c.pago)}</span>
                  {c.pendente > 0 && <span>A pagar {brl(c.pendente)}</span>}
                  {c.previsto > 0 && <span>Previsto {brl(c.previsto)}</span>}
                  {NATUREZAS.filter((n) => c.naturezas[n] > 0).map((n) => (
                    <span key={n}>
                      <i className="bi bi-circle-fill me-1" style={{ color: NATUREZA[n].cor, fontSize: 8 }}></i>
                      {NATUREZA[n].rotulo} {brl(c.naturezas[n])}
                    </span>
                  ))}
                  {c.no_cartao > 0 && <span><i className="bi bi-credit-card me-1"></i>{brl(c.no_cartao)} no cartão</span>}
                </div>
              </div>

              {aberta && (
                <div className="list-group-item bg-body-tertiary p-0">
                  {itens.length === 0 ? (
                    <div className="small text-muted p-3">Lançamentos desta categoria fora da lista (limite de exibição atingido).</div>
                  ) : (
                    <TabelaLancamentosGastos lancamentos={itens} semCategoria />
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
