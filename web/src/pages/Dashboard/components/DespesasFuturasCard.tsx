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

  const blocos = data
    ? [
        {
          chave: "parcelas",
          titulo: "Parcelas",
          icone: "bi-credit-card-2-front",
          cor: "text-warning",
          dado: data.parcelas,
          unidade: ["parcela", "parcelas"],
        },
        {
          chave: "recorrencias",
          titulo: "Recorrências",
          icone: "bi-arrow-repeat",
          cor: "text-primary",
          dado: data.recorrencias,
          unidade: ["ocorrência", "ocorrências"],
        },
        {
          chave: "outras",
          titulo: "Outras despesas",
          icone: "bi-receipt",
          cor: "text-secondary",
          dado: data.outras,
          unidade: ["lançamento", "lançamentos"],
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
                Despesas futuras
              </h6>
              <small className="text-muted">
                O que já está garantido para pagar
                {data && ` · de hoje até ${formatarDataBr(data.periodo.data_final)}`}
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
              <div className="mb-3">
                <small className="text-muted d-block">Total a pagar</small>
                <span className="fs-3 fw-semibold text-danger">
                  {convertNumberToCurrencyMask(data.total)}
                </span>
              </div>

              <div className="row g-3">
                {blocos.map((b) => (
                  <div className="col-12 col-md-4" key={b.chave}>
                    <div className="border rounded p-3 h-100">
                      <span className="text-muted small d-block mb-1">
                        <i className={`bi ${b.icone} ${b.cor} me-2`}></i>
                        {b.titulo}
                      </span>
                      <span className="fs-5 fw-semibold d-block">
                        {convertNumberToCurrencyMask(b.dado.total)}
                      </span>
                      <small className="text-muted">
                        {b.dado.quantidade}{" "}
                        {b.dado.quantidade === 1 ? b.unidade[0] : b.unidade[1]}
                        {data.total > 0 &&
                          ` · ${((b.dado.total / data.total) * 100).toFixed(0)}% do total`}
                      </small>
                    </div>
                  </div>
                ))}
              </div>

              {data.meses.length > 0 && (
                <div className="table-responsive mt-3">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="text-muted small">
                        <th>Mês</th>
                        <th className="text-end">Parcelas</th>
                        <th className="text-end">Recorrências</th>
                        <th className="text-end">Outras</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.meses.map((m) => (
                        <tr key={m.mes}>
                          <td>{formatarMes(m.mes)}</td>
                          <td className="text-end">{convertNumberToCurrencyMask(m.parcelas)}</td>
                          <td className="text-end">{convertNumberToCurrencyMask(m.recorrencias)}</td>
                          <td className="text-end">{convertNumberToCurrencyMask(m.outras)}</td>
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
