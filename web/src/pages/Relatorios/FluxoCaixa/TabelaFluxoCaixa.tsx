import { Fragment, useState } from "react";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { AgrupamentoRelatorio, PontoFluxoCaixa } from "../../../types/relatorio";
import type { Transacao } from "../../../types/transacao";

type Props = {
  serie: PontoFluxoCaixa[];
  agrupamento: AgrupamentoRelatorio;
  onAgrupamentoChange: (agrupamento: AgrupamentoRelatorio) => void;
  onSelecionarTransacao: (transacao: Transacao) => void;
};

const LABEL_AGRUPAMENTO: Record<AgrupamentoRelatorio, string> = {
  DAILY: "Dia",
  WEEKLY: "Semana",
  MONTHLY: "Mês",
};

function formatarPeriodo(periodo: string): string {
  return periodo.split("-").reverse().join("/");
}

export function TabelaFluxoCaixa({ serie, agrupamento, onAgrupamentoChange, onSelecionarTransacao }: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const alternar = (periodo: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(periodo)) {
        novo.delete(periodo);
      } else {
        novo.add(periodo);
      }
      return novo;
    });
  };

  return (
    <div>
      <div className="d-flex justify-content-end mb-2">
        <div className="btn-group btn-group-sm" role="group">
          {(Object.keys(LABEL_AGRUPAMENTO) as AgrupamentoRelatorio[]).map((valor) => (
            <button
              key={valor}
              type="button"
              className={`btn btn-outline-secondary ${agrupamento === valor ? "active" : ""}`}
              onClick={() => onAgrupamentoChange(valor)}
            >
              {LABEL_AGRUPAMENTO[valor]}
            </button>
          ))}
        </div>
      </div>

      <div className="table-responsive shadow-sm rounded">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th></th>
              <th>Período</th>
              <th>Saldo inicial</th>
              <th>Entradas</th>
              <th>Saídas</th>
              <th>Resultado</th>
              <th>Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {serie.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-5 text-muted">
                  Nenhum lançamento no período selecionado.
                </td>
              </tr>
            )}

            {serie.map((ponto) => {
              const expandido = expandidos.has(ponto.periodo);
              const saldoInicialLinha = ponto.saldo_acumulado - ponto.saldo_periodo;
              const receitas = ponto.transacoes.filter((t) => t.type === "INCOME");
              const despesas = ponto.transacoes.filter((t) => t.type === "EXPENSE");

              return (
                <Fragment key={ponto.periodo}>
                  <tr role="button" onClick={() => alternar(ponto.periodo)}>
                    <td>
                      <i className={`bi bi-chevron-${expandido ? "down" : "right"}`}></i>
                    </td>
                    <td>{formatarPeriodo(ponto.periodo)}</td>
                    <td>{convertNumberToCurrencyMask(saldoInicialLinha)}</td>
                    <td className="text-success">{convertNumberToCurrencyMask(ponto.entradas)}</td>
                    <td className="text-danger">{convertNumberToCurrencyMask(ponto.saidas)}</td>
                    <td className={ponto.saldo_periodo >= 0 ? "text-success" : "text-danger"}>
                      {ponto.saldo_periodo >= 0 ? "+" : ""}
                      {convertNumberToCurrencyMask(ponto.saldo_periodo)}
                    </td>
                    <td className="fw-semibold">{convertNumberToCurrencyMask(ponto.saldo_acumulado)}</td>
                  </tr>

                  {expandido && (
                    <tr>
                      <td colSpan={7} className="bg-light">
                        <div className="row g-3 py-2">
                          {receitas.length > 0 && (
                            <div className="col-12 col-md-6">
                              <div className="text-uppercase small fw-semibold text-muted mb-2">Receitas</div>
                              {receitas.map((transacao) => (
                                <div
                                  key={transacao.id}
                                  role="button"
                                  className="d-flex justify-content-between py-1 border-bottom"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelecionarTransacao(transacao);
                                  }}
                                >
                                  <span>{transacao.description || "Sem descrição"}</span>
                                  <span className="text-success">
                                    + {convertNumberToCurrencyMask(transacao.amount ?? 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {despesas.length > 0 && (
                            <div className="col-12 col-md-6">
                              <div className="text-uppercase small fw-semibold text-muted mb-2">Despesas</div>
                              {despesas.map((transacao) => (
                                <div
                                  key={transacao.id}
                                  role="button"
                                  className="d-flex justify-content-between py-1 border-bottom"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelecionarTransacao(transacao);
                                  }}
                                >
                                  <span>{transacao.description || "Sem descrição"}</span>
                                  <span className="text-danger">
                                    - {convertNumberToCurrencyMask(transacao.amount ?? 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
