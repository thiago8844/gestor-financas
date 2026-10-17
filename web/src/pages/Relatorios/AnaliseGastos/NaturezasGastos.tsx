import { useState } from "react";
import { brl } from "../CompromissosFuturos/formatadores";
import { NATUREZA, NATUREZAS } from "./constantes";
import { SituacaoBarra, Variacao } from "./SituacaoBarra";
import type { GastoPorNatureza, NaturezaGasto, RelatorioAnaliseGastos } from "../../../types/relatorio";

type Props = { relatorio: RelatorioAnaliseGastos; modoImpressao?: boolean };

function Detalhe({ natureza, relatorio }: { natureza: NaturezaGasto; relatorio: RelatorioAnaliseGastos }) {
  if (natureza === "FIXA" || natureza === "FIXA_VARIAVEL") {
    const lista = relatorio.recorrencias.filter((r) => r.natureza === natureza);
    if (lista.length === 0) return <p className="small text-muted mb-0">Nenhuma recorrência desse tipo no período.</p>;

    return (
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr className="text-muted small">
              <th>Recorrência</th>
              <th>Categoria</th>
              <th>Meio</th>
              <th className="text-end">Vezes</th>
              <th className="text-end">{natureza === "FIXA" ? "Valor" : "Média (mín–máx)"}</th>
              <th className="text-end">Pago</th>
              <th className="text-end">Falta</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.recorrencia_id}>
                <td>{r.descricao}</td>
                <td>{r.categoria}</td>
                <td className="text-nowrap small">
                  <i className={`bi ${r.no_cartao ? "bi-credit-card" : "bi-wallet2"} me-1`}></i>
                  {r.meio ?? "-"}
                </td>
                <td className="text-end">{r.ocorrencias}</td>
                <td className="text-end text-nowrap">
                  {natureza === "FIXA" ? brl(r.media) : (
                    <>
                      {brl(r.media)}
                      <div className="text-muted" style={{ fontSize: "0.7rem" }}>{brl(r.minimo)} – {brl(r.maximo)}</div>
                    </>
                  )}
                </td>
                <td className="text-end text-success">{brl(r.pago)}</td>
                <td className="text-end">{brl(r.pendente + r.previsto)}</td>
                <td className="text-end fw-semibold">{brl(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (natureza === "PARCELADA") {
    if (relatorio.parcelamentos.length === 0) return <p className="small text-muted mb-0">Nenhuma parcela no período.</p>;

    return (
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr className="text-muted small">
              <th>Compra</th>
              <th>Categoria</th>
              <th>Meio</th>
              <th className="text-end">Parcelas no período</th>
              <th className="text-end">Pago</th>
              <th className="text-end">Falta</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {relatorio.parcelamentos.map((p, i) => (
              <tr key={`${p.descricao}-${i}`}>
                <td>{p.descricao}</td>
                <td>{p.categoria}</td>
                <td className="text-nowrap small">
                  <i className={`bi ${p.no_cartao ? "bi-credit-card" : "bi-wallet2"} me-1`}></i>
                  {p.meio ?? "-"}
                </td>
                <td className="text-end text-nowrap">
                  {p.parcelas_no_periodo}
                  {p.primeira && p.ultima && <div className="text-muted" style={{ fontSize: "0.7rem" }}>{p.primeira} → {p.ultima}</div>}
                </td>
                <td className="text-end text-success">{brl(p.pago)}</td>
                <td className="text-end">{brl(p.pendente + p.previsto)}</td>
                <td className="text-end fw-semibold">{brl(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Variáveis: onde o gasto avulso se concentra, por categoria.
  const categorias = relatorio.por_categoria
    .filter((c) => c.naturezas.VARIAVEL > 0)
    .sort((a, b) => b.naturezas.VARIAVEL - a.naturezas.VARIAVEL);
  const total = categorias.reduce((s, c) => s + c.naturezas.VARIAVEL, 0);

  return (
    <div>
      {categorias.map((c) => (
        <div key={c.categoria_id ?? 0} className="mb-2">
          <div className="d-flex justify-content-between small">
            <span>{c.categoria}</span>
            <span className="fw-semibold">
              {brl(c.naturezas.VARIAVEL)} <span className="text-muted fw-normal">{total > 0 ? `${((c.naturezas.VARIAVEL / total) * 100).toFixed(0)}%` : ""}</span>
            </span>
          </div>
          <div className="progress" style={{ height: 5 }}>
            <div className="progress-bar" style={{ width: `${total > 0 ? (c.naturezas.VARIAVEL / total) * 100 : 0}%`, background: NATUREZA.VARIAVEL.cor }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlocoNatureza({ dados, relatorio, aberto, alternar, modoImpressao }: { dados: GastoPorNatureza; relatorio: RelatorioAnaliseGastos; aberto: boolean; alternar: () => void; modoImpressao?: boolean }) {
  const info = NATUREZA[dados.natureza];

  return (
    <div className="card shadow-sm border-0 mb-3" style={{ borderLeft: `5px solid ${info.cor}` }}>
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h6 className="fw-bold mb-1">
              <i className={`bi ${info.icone} me-2`} style={{ color: info.cor }}></i>
              {info.rotulo}
            </h6>
            <div className="small text-muted">{info.descricao}</div>
          </div>
          <div className="text-end">
            <div className="fs-5 fw-bold">
              {brl(dados.total)}
              <Variacao valor={dados.variacao_percentual} />
            </div>
            <div className="small text-muted">
              {dados.percentual !== null ? `${dados.percentual.toFixed(0)}% do total · ` : ""}
              {brl(dados.media_mensal)}/mês
            </div>
          </div>
        </div>

        {dados.total > 0 ? (
          <>
            <div className="mt-3"><SituacaoBarra somas={dados} /></div>
            <div className="small text-muted mt-2 d-flex flex-wrap gap-3">
              <span><i className="bi bi-credit-card me-1"></i>{brl(dados.no_cartao)} no cartão</span>
              <span><i className="bi bi-wallet2 me-1"></i>{brl(dados.na_conta)} direto na conta</span>
              <span>{dados.quantidade} lançamentos</span>
              {dados.estimado > 0 && <span><i className="bi bi-magic me-1"></i>{brl(dados.estimado)} estimado</span>}
            </div>

            {!modoImpressao && (
              <button type="button" className="btn btn-sm btn-link px-0 mt-2 text-decoration-none" onClick={alternar}>
                <i className={`bi bi-chevron-${aberto ? "up" : "down"} me-1`}></i>
                {aberto ? "Ocultar detalhes" : "Ver detalhes"}
              </button>
            )}

            {(aberto || modoImpressao) && (
              <div className="mt-2 pt-3 border-top">
                <Detalhe natureza={dados.natureza} relatorio={relatorio} />
              </div>
            )}
          </>
        ) : (
          <p className="small text-muted mt-3 mb-0">Nenhum gasto desse tipo no período.</p>
        )}
      </div>
    </div>
  );
}

export function NaturezasGastos({ relatorio, modoImpressao }: Props) {
  const [abertos, setAbertos] = useState<Set<NaturezaGasto>>(new Set(["FIXA"]));

  return (
    <div>
      {NATUREZAS.map((n) => (
        <BlocoNatureza
          key={n}
          dados={relatorio.por_natureza.find((x) => x.natureza === n)!}
          relatorio={relatorio}
          aberto={abertos.has(n)}
          modoImpressao={modoImpressao}
          alternar={() =>
            setAbertos((atual) => {
              const novo = new Set(atual);
              if (!novo.delete(n)) novo.add(n);
              return novo;
            })
          }
        />
      ))}
    </div>
  );
}
