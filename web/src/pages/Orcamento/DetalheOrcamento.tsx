import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { getOrcamento } from "../../api/orcamentos";
import { convertNumberToCurrencyMask } from "../../utils";

export function DetalheOrcamento() {
  const { id } = useParams<{ id: string }>();
  const [dataReferencia, setDataReferencia] = useState<string | undefined>(undefined);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["orcamento", id, "detalhe", dataReferencia],
    queryFn: () =>
      getOrcamento(Number(id), dataReferencia ? { data_referencia: dataReferencia } : undefined),
    enabled: !!id,
  });

  if (isError) {
    return (
      <PageLayout title="Orçamento" backTo="/orcamentos">
        <div className="alert alert-danger">Erro ao carregar orçamento.</div>
      </PageLayout>
    );
  }

  const orcamento = data?.data;
  const resumo = data?.resumo;

  return (
    <PageLayout loading={isLoading} title={orcamento?.name || "Orçamento"} backTo="/orcamentos">
      {orcamento && resumo && (
        <div className="container-fluid">
          <div className="container mt-2">
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                {orcamento.description && <p className="text-muted mb-1">{orcamento.description}</p>}
                <span
                  className={`badge ${orcamento.type === "ONE_TIME" ? "text-bg-primary" : "text-bg-info"}`}
                >
                  {orcamento.type === "ONE_TIME" ? "Pontual" : "Recorrente"}
                </span>
              </div>
              <Link to={`/orcamentos/editar/${orcamento.id}`} className="btn btn-secondary">
                <i className="bi bi-pencil me-2"></i>
                Editar
              </Link>
            </div>

            {resumo.periodo && (
              <div className="d-flex align-items-center justify-content-center gap-3 mb-4">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={!resumo.periodo_anterior}
                  onClick={() => setDataReferencia(resumo.periodo_anterior?.inicio)}
                >
                  <i className="bi bi-chevron-left"></i> Período anterior
                </button>
                <span className="fw-semibold">
                  {resumo.periodo.inicio} até {resumo.periodo.fim}
                </span>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={!resumo.periodo_seguinte}
                  onClick={() => setDataReferencia(resumo.periodo_seguinte?.inicio)}
                >
                  Próximo período <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            )}

            {resumo.alerta_atingido && (
              <div
                className={`alert ${(resumo.percentual_utilizado ?? 0) >= 100 ? "alert-danger" : "alert-warning"}`}
              >
                <i className="bi bi-exclamation-triangle me-2"></i>
                {(resumo.percentual_utilizado ?? 0) >= 100
                  ? "Este orçamento estourou o limite."
                  : `Este orçamento já atingiu ${resumo.percentual_utilizado}% do limite configurado.`}
              </div>
            )}

            <div className="row g-3 mb-4">
              {resumo.limite !== null ? (
                <>
                  <div className="col-md-3">
                    <div className="card text-center h-100">
                      <div className="card-body">
                        <div className="text-muted small">Limite</div>
                        <div className="fs-5 fw-semibold">
                          R$ {convertNumberToCurrencyMask(resumo.limite)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card text-center h-100">
                      <div className="card-body">
                        <div className="text-muted small">Gasto</div>
                        <div className="fs-5 fw-semibold">
                          R$ {convertNumberToCurrencyMask(resumo.gasto)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card text-center h-100">
                      <div className="card-body">
                        <div className="text-muted small">Disponível</div>
                        <div
                          className={`fs-5 fw-semibold ${(resumo.disponivel ?? 0) < 0 ? "text-danger" : ""}`}
                        >
                          R$ {convertNumberToCurrencyMask(resumo.disponivel ?? 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card text-center h-100">
                      <div className="card-body">
                        <div className="text-muted small">Utilizado</div>
                        <div className="fs-5 fw-semibold">{resumo.percentual_utilizado}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="progress" style={{ height: "10px" }}>
                      <div
                        className={`progress-bar ${
                          (resumo.percentual_utilizado ?? 0) >= 100
                            ? "bg-danger"
                            : resumo.alerta_atingido
                              ? "bg-warning"
                              : "bg-success"
                        }`}
                        style={{ width: `${Math.min(resumo.percentual_utilizado ?? 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-md-4">
                  <div className="card text-center h-100">
                    <div className="card-body">
                      <div className="text-muted small">Total gasto</div>
                      <div className="fs-5 fw-semibold">
                        R$ {convertNumberToCurrencyMask(resumo.gasto)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="row g-4">
              <div className="col-lg-5">
                <h5>Gasto por categoria</h5>
                {resumo.gasto_por_categoria.length === 0 && (
                  <p className="text-muted">Nenhum gasto no período.</p>
                )}
                {resumo.gasto_por_categoria.map((item) => {
                  const percentualCategoria = resumo.gasto > 0 ? (item.total / resumo.gasto) * 100 : 0;
                  return (
                    <div key={item.categoria} className="mb-2">
                      <div className="d-flex justify-content-between small">
                        <span>{item.categoria}</span>
                        <span>R$ {convertNumberToCurrencyMask(item.total)}</span>
                      </div>
                      <div className="progress" style={{ height: "6px" }}>
                        <div
                          className="progress-bar bg-primary"
                          style={{ width: `${percentualCategoria}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="col-lg-7">
                <h5>Transações do período</h5>
                {resumo.transacoes.length === 0 && (
                  <p className="text-muted">Nenhuma transação no período.</p>
                )}
                {resumo.transacoes.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Descrição</th>
                          <th>Categoria</th>
                          <th>Data</th>
                          <th className="text-end">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumo.transacoes.map((transacao) => (
                          <tr key={transacao.id}>
                            <td>
                              {transacao.description}
                              {transacao.installment_total && transacao.installment_total > 1 && (
                                <span className="badge text-bg-secondary ms-1">
                                  {transacao.installment_number}/{transacao.installment_total}
                                </span>
                              )}
                            </td>
                            <td>{transacao.categoria?.name || "-"}</td>
                            <td>{transacao.date || transacao.due_date || "-"}</td>
                            <td className="text-end">
                              R$ {convertNumberToCurrencyMask(transacao.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {resumo.periodos_pontuais && resumo.periodos_pontuais.length > 0 && (
              <div className="mt-4">
                <h5>Intervalos deste orçamento</h5>
                <ul className="mb-0">
                  {resumo.periodos_pontuais.map((periodo) => (
                    <li key={periodo.id}>
                      {periodo.inicio} até {periodo.fim}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
