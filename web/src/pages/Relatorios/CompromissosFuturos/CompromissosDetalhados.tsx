import { Fragment, useMemo, useState } from "react";
import {
  brl,
  brlComSinal,
  diaDaSemana,
  formatarDataBR,
  formatarDiaMes,
  ICONE_ORIGEM,
  LABEL_CONFIANCA,
  LABEL_ORIGEM,
  nomeMes,
  rotuloOrigem,
} from "./formatadores";
import type { EventoCompromisso, MesProjecao, OrigemCompromisso } from "../../../types/relatorio";

type TipoFiltro = "TODOS" | "EXPENSE" | "INCOME";

type Props = {
  eventos: EventoCompromisso[];
  meses: MesProjecao[];
  /** PDF: tudo expandido, sem filtros nem controles. */
  modoImpressao?: boolean;
};

function Selos({
  evento,
}: {
  evento: Pick<EventoCompromisso, "estimado" | "atrasado" | "sem_valor" | "confianca" | "desvio" | "data_original">;
}) {
  return (
    <>
      {evento.atrasado && (
        <span className="badge text-bg-danger-subtle text-danger-emphasis border border-danger-subtle ms-2">
          Vencido em {formatarDiaMes(evento.data_original)}
        </span>
      )}
      {evento.sem_valor && (
        <span
          className="badge text-bg-light border ms-2"
          title="Recorrência de valor variável sem valor definido — fora dos totais"
        >
          Sem valor
        </span>
      )}
      {evento.estimado && (
        <span
          className="badge text-bg-info-subtle text-info-emphasis border border-info-subtle ms-2"
          title={`${evento.confianca ? LABEL_CONFIANCA[evento.confianca] : "Estimado"}${
            evento.desvio ? ` · variação típica de ± ${brl(evento.desvio)}` : ""
          }`}
        >
          <i className="bi bi-magic me-1"></i>
          Estimado
        </span>
      )}
    </>
  );
}

function ItensDaFatura({ evento }: { evento: EventoCompromisso }) {
  return (
    <tr className="table-light">
      <td></td>
      <td colSpan={5} className="py-3">
        <div className="small text-muted mb-2">
          Fechamento em {formatarDataBR(evento.fatura?.fechamento ?? evento.data)} · vencimento em{" "}
          {formatarDataBR(evento.fatura?.vencimento ?? evento.data)}
          {evento.fatura?.id === null && " · fatura ainda sem compras lançadas"}
        </div>

        <table className="table table-sm mb-0 bg-white">
          <thead>
            <tr className="text-muted small">
              <th>Compra</th>
              <th>Data da compra</th>
              <th>Categoria</th>
              <th className="text-end">Valor</th>
            </tr>
          </thead>
          <tbody>
            {evento.itens.map((item, i) => (
              <tr key={`${item.transacao_id ?? "proj"}-${i}`}>
                <td>
                  {item.descricao}
                  {item.parcela && <span className="text-muted ms-2">{item.parcela}</span>}
                  {item.recorrente && (
                    <i className="bi bi-arrow-repeat text-muted ms-2" title="Recorrente"></i>
                  )}
                  <Selos
                    evento={{
                      estimado: item.estimado,
                      atrasado: false,
                      sem_valor: item.valor === null,
                      confianca: item.confianca,
                      desvio: item.desvio,
                      data_original: "",
                    }}
                  />
                </td>
                <td className="text-nowrap">{item.data_compra ? formatarDataBR(item.data_compra) : "-"}</td>
                <td>{item.categoria ?? "-"}</td>
                <td className="text-end text-nowrap">
                  {item.valor === null ? "-" : `${item.estimado ? "≈ " : ""}${brl(item.valor)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-muted small mt-2">
          <i className="bi bi-info-circle me-1"></i>
          Só entram compras já registradas e recorrências no cartão — novas compras ainda podem aumentar a fatura.
        </div>
      </td>
    </tr>
  );
}

export function CompromissosDetalhados({ eventos, meses, modoImpressao }: Props) {
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [origem, setOrigem] = useState<OrigemCompromisso | "TODAS">("TODAS");
  const [busca, setBusca] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [mesesFechados, setMesesFechados] = useState<Set<string>>(new Set());

  const filtrando = tipo !== "TODOS" || origem !== "TODAS" || busca.trim() !== "";

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return eventos.filter((e) => {
      if (tipo !== "TODOS" && e.tipo !== tipo) return false;
      if (origem !== "TODAS" && e.origem !== origem) return false;
      if (!termo) return true;

      return (
        e.descricao.toLowerCase().includes(termo) ||
        (e.categoria ?? "").toLowerCase().includes(termo) ||
        e.itens.some((item) => item.descricao.toLowerCase().includes(termo))
      );
    });
  }, [eventos, tipo, origem, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, EventoCompromisso[]>();
    filtrados.forEach((e) => {
      const chave = e.data.slice(0, 7);
      mapa.set(chave, [...(mapa.get(chave) ?? []), e]);
    });
    return [...mapa.entries()];
  }, [filtrados]);

  const resumoPorMes = useMemo(() => new Map(meses.map((m) => [m.mes, m])), [meses]);

  const alternar = (conjunto: Set<string>, chave: string) => {
    const novo = new Set(conjunto);
    if (!novo.delete(chave)) novo.add(chave);
    return novo;
  };

  return (
    <div>
      {!modoImpressao && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-4">
                <label className="form-label small">Mostrar</label>
                <div className="btn-group w-100" role="group">
                  {(
                    [
                      ["TODOS", "Tudo"],
                      ["EXPENSE", "Saídas"],
                      ["INCOME", "Entradas"],
                    ] as [TipoFiltro, string][]
                  ).map(([valor, label]) => (
                    <button
                      key={valor}
                      type="button"
                      className={`btn btn-sm ${tipo === valor ? "btn-primary" : "btn-outline-primary"}`}
                      aria-pressed={tipo === valor}
                      onClick={() => setTipo(valor)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-6 col-md-3">
                <label className="form-label small">Origem</label>
                <select
                  className="form-select form-select-sm"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value as OrigemCompromisso | "TODAS")}
                >
                  <option value="TODAS">Todas</option>
                  {(Object.keys(LABEL_ORIGEM) as OrigemCompromisso[]).map((o) => (
                    <option key={o} value={o}>
                      {LABEL_ORIGEM[o]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-6 col-md-5">
                <label className="form-label small">Buscar</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="search"
                    className="form-control"
                    placeholder="Descrição ou categoria"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="card shadow-sm border-0">
          <div className="card-body text-center text-muted py-5">
            <i className="bi bi-calendar-check fs-1 opacity-25"></i>
            <p className="mt-2 mb-0">
              {filtrando ? "Nenhum compromisso encontrado com esses filtros." : "Nenhum compromisso no período."}
            </p>
          </div>
        </div>
      ) : (
        grupos.map(([chaveMes, lista]) => {
          const resumoMes = resumoPorMes.get(chaveMes);
          const entradas = lista.filter((e) => e.tipo === "INCOME").reduce((s, e) => s + (e.valor ?? 0), 0);
          const saidas = lista.filter((e) => e.tipo === "EXPENSE").reduce((s, e) => s + (e.valor ?? 0), 0);
          const fechado = !modoImpressao && mesesFechados.has(chaveMes);

          return (
            <div className="card shadow-sm border-0 mb-4" key={chaveMes}>
              <div
                className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-3"
                role={modoImpressao ? undefined : "button"}
                onClick={modoImpressao ? undefined : () => setMesesFechados((s) => alternar(s, chaveMes))}
              >
                <h6 className="fw-bold mb-0">
                  {!modoImpressao && <i className={`bi bi-chevron-${fechado ? "right" : "down"} me-2 d-print-none`}></i>}
                  {nomeMes(chaveMes)}
                  <span className="text-muted fw-normal small ms-2">
                    {lista.length} {lista.length === 1 ? "item" : "itens"}
                  </span>
                </h6>

                <div className="d-flex flex-wrap gap-3 small">
                  <span className="text-success">Entradas {brl(entradas)}</span>
                  <span className="text-danger">Saídas {brl(saidas)}</span>
                  {!filtrando && resumoMes && (
                    <span className={`fw-semibold ${resumoMes.saldo_final < 0 ? "text-danger" : ""}`}>
                      Saldo final {brl(resumoMes.saldo_final)}
                    </span>
                  )}
                </div>
              </div>

              {!fechado && (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th style={{ width: 90 }}>Data</th>
                        <th>Descrição</th>
                        <th>Conta</th>
                        <th className="text-end">Valor</th>
                        <th className="text-end">Saldo após</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((evento) => {
                        const temItens = evento.origem === "FATURA" && evento.itens.length > 0;
                        const aberto = temItens && (modoImpressao || expandidos.has(evento.id));

                        return (
                          <Fragment key={evento.id}>
                            <tr
                              role={temItens && !modoImpressao ? "button" : undefined}
                              onClick={temItens && !modoImpressao ? () => setExpandidos((s) => alternar(s, evento.id)) : undefined}
                            >
                              <td>
                                {temItens && !modoImpressao && (
                                  <i className={`bi bi-chevron-${aberto ? "down" : "right"} text-muted`}></i>
                                )}
                              </td>
                              <td className="text-nowrap">
                                <div className="fw-semibold">{formatarDiaMes(evento.data)}</div>
                                <div className="text-muted small">{evento.atrasado ? "hoje" : diaDaSemana(evento.data)}</div>
                              </td>
                              <td>
                                <div>
                                  <i className={`bi ${ICONE_ORIGEM[evento.origem]} text-muted me-2`}></i>
                                  {evento.descricao}
                                  <Selos evento={evento} />
                                </div>
                                <div className="text-muted small">
                                  {rotuloOrigem(evento)}
                                  {evento.categoria && <> · {evento.categoria}</>}
                                  {temItens && (
                                    <>
                                      {" "}
                                      · {evento.itens.length} {evento.itens.length === 1 ? "compra" : "compras"}
                                    </>
                                  )}
                                  {evento.itens_sem_valor > 0 && evento.origem === "FATURA" && (
                                    <> · {evento.itens_sem_valor} sem valor</>
                                  )}
                                </div>
                              </td>
                              <td className="text-nowrap">{evento.conta ?? "-"}</td>
                              <td
                                className={`text-end fw-semibold text-nowrap ${
                                  evento.tipo === "INCOME" ? "text-success" : "text-danger"
                                }`}
                              >
                                {evento.valor === null ? (
                                  <span className="text-muted fw-normal">-</span>
                                ) : (
                                  <>
                                    {evento.estimado && <span className="text-muted fw-normal">≈ </span>}
                                    {brlComSinal(evento.valor, evento.tipo)}
                                  </>
                                )}
                              </td>
                              <td className={`text-end text-nowrap small ${evento.saldo_apos < 0 ? "text-danger fw-semibold" : "text-muted"}`}>
                                {evento.saldo_apos < 0 && <i className="bi bi-exclamation-triangle-fill me-1"></i>}
                                {brl(evento.saldo_apos)}
                              </td>
                            </tr>

                            {aberto && <ItensDaFatura evento={evento} />}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      <p className="text-muted small mb-0">
        <i className="bi bi-info-circle me-1"></i>
        A fatura do cartão é um único pagamento no vencimento: as compras e parcelas dela aparecem só como
        detalhe, sem serem somadas de novo. O saldo após cada item considera todas as contas selecionadas.
      </p>
    </div>
  );
}
