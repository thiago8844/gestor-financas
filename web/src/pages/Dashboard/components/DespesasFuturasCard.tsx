import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getDespesasFuturasDashboard } from "../../../api/dashboard";
import { convertNumberToCurrencyMask } from "../../../utils";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Último dia do mês daqui a `n` meses (0 = mês atual).
const fimDoMes = (n: number) => {
  const hoje = new Date();
  return toISO(new Date(hoje.getFullYear(), hoje.getMonth() + n + 1, 0));
};

const PRESETS: Record<string, { label: string; meses: number }> = {
  mes_atual: { label: "Até o fim do mês", meses: 0 },
  proximos_3_meses: { label: "Próximos 3 meses", meses: 2 },
  proximos_6_meses: { label: "Próximos 6 meses", meses: 5 },
  proximos_12_meses: { label: "Próximos 12 meses", meses: 11 },
};

function formatarMes(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]}/${ano}`;
}

function formatarDataBr(dataStr: string) {
  const [ano, mes, dia] = dataStr.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

export function DespesasFuturasCard() {
  const [periodo, setPeriodo] = useState("proximos_3_meses");
  const [dataPersonalizada, setDataPersonalizada] = useState("");

  const hojeISO = toISO(new Date());
  const dataFinal =
    periodo === "personalizado"
      ? dataPersonalizada
      : fimDoMes(PRESETS[periodo].meses);

  const dataValida = dataFinal !== "" && dataFinal >= hojeISO;

  const { data, isFetching } = useQuery({
    queryKey: ["dashboard-despesas-futuras", dataFinal],
    queryFn: () => getDespesasFuturasDashboard(dataFinal),
    enabled: dataValida,
    placeholderData: (anterior) => anterior,
  });

  const origens = data
    ? [
        {
          chave: "cartao",
          titulo: "Cartão de crédito",
          icone: "bi-credit-card",
          dado: data.origens.cartao,
          nota: "Contado na fatura, pelo vencimento — não pela data da compra.",
        },
        {
          chave: "conta",
          titulo: "Contas (fora do cartão)",
          icone: "bi-wallet2",
          dado: data.origens.conta,
          nota: "Pago pela data do pagamento; a pagar pelo vencimento.",
        },
      ]
    : [];

  return (
    <div className="container py-2">
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
            <div>
              <h6 className="fw-bold mb-1">
                <i className="bi bi-calendar-check me-2 text-danger"></i>
                Despesas do período
              </h6>
              <small className="text-muted">
                O que já foi pago e o que falta pagar
                {data && ` · de ${formatarDataBr(data.periodo.data_inicial)} até ${formatarDataBr(data.periodo.data_final)}`}
              </small>
            </div>

            <div className="d-flex flex-wrap align-items-start gap-2">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="form-select form-select-sm"
                style={{ minWidth: 170 }}
              >
                {Object.entries(PRESETS).map(([chave, { label }]) => (
                  <option key={chave} value={chave}>
                    {label}
                  </option>
                ))}
                <option value="personalizado">Escolher data</option>
              </select>

              {periodo === "personalizado" && (
                <input
                  type="date"
                  className={`form-control form-control-sm ${dataPersonalizada && !dataValida ? "is-invalid" : ""}`}
                  style={{ width: 150 }}
                  min={hojeISO}
                  value={dataPersonalizada}
                  onChange={(e) => setDataPersonalizada(e.target.value)}
                />
              )}
            </div>
          </div>

          {!dataValida ? (
            <p className="text-muted small mb-0">
              Escolha uma data de hoje em diante para ver as despesas futuras.
            </p>
          ) : !data ? (
            <p className="text-muted small mb-0">Carregando...</p>
          ) : (
            <div style={{ opacity: isFetching ? 0.6 : 1 }}>
              {/* Resumo: já pago x a pagar */}
              <div className="row g-3 mb-2">
                <div className="col-12 col-md-4">
                  <div className="border rounded p-3 h-100">
                    <small className="text-muted d-block">
                      <i className="bi bi-check-circle text-success me-2"></i>
                      Já pago
                    </small>
                    <span className="fs-4 fw-semibold text-success">
                      {convertNumberToCurrencyMask(data.pago)}
                    </span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="border rounded p-3 h-100">
                    <small className="text-muted d-block">
                      <i className="bi bi-hourglass-split text-danger me-2"></i>
                      Falta pagar
                    </small>
                    <span className="fs-4 fw-semibold text-danger">
                      {convertNumberToCurrencyMask(data.a_pagar)}
                    </span>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <div className="border rounded p-3 h-100 bg-body-tertiary">
                    <small className="text-muted d-block">
                      <i className="bi bi-sigma me-2"></i>
                      Total do período
                    </small>
                    <span className="fs-4 fw-semibold">
                      {convertNumberToCurrencyMask(data.total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="progress mb-3" style={{ height: 8 }} title="Quanto do total já foi pago">
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${data.total > 0 ? (data.pago / data.total) * 100 : 0}%` }}
                ></div>
              </div>

              {/* De onde vem: cartão x contas, com o recorte de recorrências explícito */}
              <div className="row g-3 mb-3">
                {origens.map((o) => (
                  <div className="col-12 col-md-6" key={o.chave}>
                    <div className="border rounded p-3 h-100">
                      <span className="fw-semibold d-block mb-2">
                        <i className={`bi ${o.icone} me-2 text-secondary`}></i>
                        {o.titulo}
                      </span>
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Pago</span>
                        <span className="text-success">{convertNumberToCurrencyMask(o.dado.pago)}</span>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">A pagar</span>
                        <span className="text-danger">{convertNumberToCurrencyMask(o.dado.a_pagar)}</span>
                      </div>
                      {o.dado.recorrentes_pago + o.dado.recorrentes_a_pagar > 0 && (
                        <small className="text-muted d-block mt-2">
                          <i className="bi bi-arrow-repeat me-1"></i>
                          Inclui recorrências: {convertNumberToCurrencyMask(o.dado.recorrentes_pago)} pagas ·{" "}
                          {convertNumberToCurrencyMask(o.dado.recorrentes_a_pagar)} a pagar
                        </small>
                      )}
                      <small className="text-muted d-block mt-1">{o.nota}</small>
                    </div>
                  </div>
                ))}
              </div>

              {data.faturas.length > 0 && (
                <div className="mb-3">
                  <small className="text-muted d-block mb-1">Faturas do cartão no período</small>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="text-muted small">
                          <th>Fatura</th>
                          <th>Vence</th>
                          <th className="text-end">Pago</th>
                          <th className="text-end">A pagar</th>
                          <th className="text-end">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.faturas.map((f) => (
                          <tr key={`${f.cartao}-${f.vencimento}`}>
                            <td>
                              {f.cartao}
                              {f.projetada && (
                                <span className="badge text-bg-light border ms-2" title="Ainda não há compras nessa fatura: só recorrências previstas">
                                  prévia
                                </span>
                              )}
                              {f.recorrentes > 0 && (
                                <small className="text-muted d-block">
                                  <i className="bi bi-arrow-repeat me-1"></i>
                                  inclui {convertNumberToCurrencyMask(f.recorrentes)} de recorrências
                                </small>
                              )}
                            </td>
                            <td className="text-nowrap">{formatarDataBr(f.vencimento)}</td>
                            <td className="text-end text-success">{convertNumberToCurrencyMask(f.pago)}</td>
                            <td className="text-end text-danger">{convertNumberToCurrencyMask(f.a_pagar)}</td>
                            <td className="text-end fw-semibold">{convertNumberToCurrencyMask(f.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.meses.length > 0 && (
                <div className="table-responsive">
                  <small className="text-muted d-block mb-1">Mês a mês</small>
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="text-muted small">
                        <th>Mês</th>
                        <th className="text-end">Pago</th>
                        <th className="text-end">A pagar</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.meses.map((m) => (
                        <tr key={m.mes}>
                          <td>{formatarMes(m.mes)}</td>
                          <td className="text-end text-success">{convertNumberToCurrencyMask(m.pago)}</td>
                          <td className="text-end text-danger">{convertNumberToCurrencyMask(m.a_pagar)}</td>
                          <td className="text-end fw-semibold">{convertNumberToCurrencyMask(m.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.sem_valor > 0 && (
                <small className="text-muted d-block mt-2">
                  <i className="bi bi-info-circle me-1"></i>
                  {data.sem_valor}{" "}
                  {data.sem_valor === 1 ? "item" : "itens"} sem valor definido
                  não entram no total.
                </small>
              )}

              <Link to="/relatorios/compromissos-futuros" className="small d-inline-block mt-3">
                Ver projeção completa
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
