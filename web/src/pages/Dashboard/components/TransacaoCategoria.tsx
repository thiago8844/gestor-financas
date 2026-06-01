import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { convertNumberToCurrencyMask } from "../../../utils";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CategoriaPonto {
  categoria: string;
  total: number;
}

// Params que este componente envia para o pai atualizar a query
export interface CategoriaFiltroParams {
  despesasCategoriaAlltime?: boolean;
  despesasCategoriaDataInicial?: string;
  despesasCategoriaDataFinal?: string;
  receitasCategoriaAlltime?: boolean;
  receitasCategoriaDataInicial?: string;
  receitasCategoriaDataFinal?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toISO = (d: Date) => d.toISOString().slice(0, 10);

const brParaISO = (br: string): string => {
  const [d, m, y] = br.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

const isDataBRValida = (br: string): boolean => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return false;
  const [d, m, y] = br.split("/").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
};

const mascararData = (valor: string): string => {
  const digits = valor.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

function resolverPeriodo(
  periodo: string,
  dataInicialBR?: string,
  dataFinalBR?: string,
): { alltime: boolean; inicio?: string; fim?: string } {
  const hoje = new Date();

  if (periodo === "todo_periodo")
    return { alltime: true, inicio: undefined, fim: undefined };

  if (
    periodo === "personalizado" &&
    dataInicialBR &&
    isDataBRValida(dataInicialBR) &&
    dataFinalBR &&
    isDataBRValida(dataFinalBR)
  ) {
    const isoInicio = brParaISO(dataInicialBR);
    const isoFim = brParaISO(dataFinalBR);
    if (isoInicio > isoFim) return { alltime: false };
    return { alltime: false, inicio: isoInicio, fim: isoFim };
  }

  if (periodo === "personalizado") return { alltime: false };

  const meses: Record<string, number> = {
    mes_atual: 0,
    ultimos_3_meses: 3,
    ultimos_6_meses: 6,
    ultimos_12_meses: 12,
  };
  const n = meses[periodo] ?? 0;
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - n, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); // último dia do mês atual

  return { alltime: false, inicio: toISO(inicio), fim: toISO(fim) };
}

// Paleta de cores para as fatias
const CORES = [
  "#0d6efd",
  "#198754",
  "#dc3545",
  "#ffc107",
  "#0dcaf0",
  "#6f42c1",
  "#fd7e14",
  "#20c997",
  "#e83e8c",
  "#6c757d",
];

// Tooltip customizado que exibe R$ e porcentagem
import type { PieLabelRenderProps } from "recharts";
interface TooltipEntry {
  name: string;
  value: number;
  payload: { percent?: number };
}
function TooltipCustom({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="card shadow-sm border-0 p-2" style={{ minWidth: 180 }}>
      <div className="fw-semibold small mb-1">{item.name}</div>
      <div className="small text-muted">
        {convertNumberToCurrencyMask(item.value)}
        {" · "}
        {item.payload?.percent !== undefined
          ? `${(item.payload.percent * 100).toFixed(1)}%`
          : ""}
      </div>
    </div>
  );
}

// Label dentro de cada fatia (só mostra quando a fatia é grande o suficiente)
function LabelCustom({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  if (!percent || percent < 0.05) return null; // oculta rótulos menores que 5%
  const RADIAN = Math.PI / 180;
  const r =
    Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.5;
  const x = Number(cx) + r * Math.cos(-Number(midAngle) * RADIAN);
  const y = Number(cy) + r * Math.sin(-Number(midAngle) * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(Number(percent) * 100).toFixed(0)}%`}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface Props {
  despesas: CategoriaPonto[] | undefined;
  receitas: CategoriaPonto[] | undefined;
  onFiltroChange: (params: CategoriaFiltroParams) => void;
}

export function TransacaoCategoria({
  despesas,
  receitas,
  onFiltroChange,
}: Props) {
  // Toggle entre DESPESA e RECEITA
  const [tipo, setTipo] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  const [periodo, setPeriodo] = useState("mes_atual");
  const [dataInicialBR, setDataInicial] = useState("");
  const [dataFinalBR, setDataFinal] = useState("");

  const erroInicial =
    periodo === "personalizado" &&
    dataInicialBR.length === 10 &&
    !isDataBRValida(dataInicialBR)
      ? "Data inválida"
      : periodo === "personalizado" &&
          dataInicialBR.length === 10 &&
          dataFinalBR.length === 10 &&
          brParaISO(dataInicialBR) > brParaISO(dataFinalBR)
        ? "Deve ser menor que a data final"
        : undefined;

  const erroFinal =
    periodo === "personalizado" &&
    dataFinalBR.length === 10 &&
    !isDataBRValida(dataFinalBR)
      ? "Data inválida"
      : undefined;

  useEffect(() => {
    if (periodo === "personalizado") {
      if (
        dataInicialBR.length === 10 &&
        isDataBRValida(dataInicialBR) &&
        dataFinalBR.length === 10 &&
        isDataBRValida(dataFinalBR) &&
        brParaISO(dataInicialBR) <= brParaISO(dataFinalBR)
      ) {
        const { alltime, inicio, fim } = resolverPeriodo(
          periodo,
          dataInicialBR,
          dataFinalBR,
        );
        onFiltroChange({
          despesasCategoriaAlltime: alltime,
          despesasCategoriaDataInicial: inicio,
          despesasCategoriaDataFinal: fim,
          receitasCategoriaAlltime: alltime,
          receitasCategoriaDataInicial: inicio,
          receitasCategoriaDataFinal: fim,
        });
      }
      return;
    }
    const { alltime, inicio, fim } = resolverPeriodo(periodo);
    onFiltroChange({
      despesasCategoriaAlltime: alltime,
      despesasCategoriaDataInicial: inicio,
      despesasCategoriaDataFinal: fim,
      receitasCategoriaAlltime: alltime,
      receitasCategoriaDataInicial: inicio,
      receitasCategoriaDataFinal: fim,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, dataInicialBR, dataFinalBR]);

  const chartData = (tipo === "EXPENSE" ? despesas : receitas) ?? [];

  // Total do período para exibir no centro
  const total = chartData.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        {/* Cabeçalho */}
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
          <h6 className="fw-bold mb-0">
            <i
              className={`bi ${tipo === "EXPENSE" ? "bi-pie-chart-fill text-danger" : "bi-pie-chart-fill text-success"} me-2`}
            ></i>
            {tipo === "EXPENSE" ? "Despesas" : "Receitas"} por Categoria
          </h6>

          <div className="d-flex flex-wrap align-items-start gap-2">
            {/* Toggle Despesa / Receita */}
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${tipo === "EXPENSE" ? "btn-danger" : "btn-outline-danger"}`}
                onClick={() => setTipo("EXPENSE")}
              >
                <i className="bi bi-arrow-up-circle me-1"></i>
                Despesas
              </button>
              <button
                type="button"
                className={`btn ${tipo === "INCOME" ? "btn-success" : "btn-outline-success"}`}
                onClick={() => setTipo("INCOME")}
              >
                <i className="bi bi-arrow-down-circle me-1"></i>
                Receitas
              </button>
            </div>

            {/* Filtro de período */}
            <div className="d-flex flex-wrap align-items-start gap-2">
              <select
                value={periodo}
                onChange={(e) => {
                  setPeriodo(e.target.value);
                  setDataInicial("");
                  setDataFinal("");
                }}
                className="form-select form-select-sm"
                style={{ minWidth: 160 }}
              >
                <option value="mes_atual">Mês atual</option>
                <option value="ultimos_3_meses">Últimos 3 meses</option>
                <option value="ultimos_6_meses">Últimos 6 meses</option>
                <option value="ultimos_12_meses">Últimos 12 meses</option>
                <option value="todo_periodo">Todo o período</option>
                <option value="personalizado">Personalizado</option>
              </select>

              {periodo === "personalizado" && (
                <div className="d-flex gap-2 align-items-start">
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={dataInicialBR}
                      onChange={(e) =>
                        setDataInicial(mascararData(e.target.value))
                      }
                      className={`form-control form-control-sm ${erroInicial ? "is-invalid" : ""}`}
                      style={{ width: 120 }}
                    />
                    {erroInicial && (
                      <div className="invalid-feedback">{erroInicial}</div>
                    )}
                  </div>
                  <span className="pt-1 text-muted small">até</span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={dataFinalBR}
                      onChange={(e) =>
                        setDataFinal(mascararData(e.target.value))
                      }
                      className={`form-control form-control-sm ${erroFinal ? "is-invalid" : ""}`}
                      style={{ width: 120 }}
                    />
                    {erroFinal && (
                      <div className="invalid-feedback">{erroFinal}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico */}
        {chartData.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-pie-chart fs-1 opacity-25"></i>
            <p className="mt-2 small">
              Nenhum dado para o período selecionado.
            </p>
          </div>
        ) : (
          <div className="row align-items-center g-0">
            {/* Pizza */}
            <div className="col-12 col-md-7">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="total"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={55} // rosca (donut)
                    paddingAngle={2}
                    labelLine={false}
                    label={LabelCustom}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipCustom />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda lateral com valores */}
            <div className="col-12 col-md-5">
              <div className="fw-semibold small text-muted mb-2">
                Total: {convertNumberToCurrencyMask(total)}
              </div>
              <ul
                className="list-unstyled mb-0"
                style={{ maxHeight: 240, overflowY: "auto" }}
              >
                {chartData.map((item, i) => (
                  <li
                    key={i}
                    className="d-flex justify-content-between align-items-center mb-1 small"
                  >
                    <span className="d-flex align-items-center gap-2">
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: CORES[i % CORES.length],
                          flexShrink: 0,
                        }}
                      />
                      {item.categoria}
                    </span>
                    <span className="fw-semibold ms-2 text-nowrap">
                      {convertNumberToCurrencyMask(item.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
