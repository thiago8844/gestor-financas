import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { TimeInterval } from "../../../api/dashboard";

export interface SaldoPonto {
  periodo: string;
  entradas: number;
  saidas: number;
  saldo_periodo: number;
  saldo_acumulado: number;
}

export type SaldoPorContaData = Record<string, SaldoPonto[]>;

export interface SaldoFiltroParams {
  saldosContasAlltime?: boolean;
  saldosContasDataInicial?: string;
  saldosContasDataFinal?: string;
  saldosContasIntervalo?: TimeInterval;
}

// --- Helpers de data (dd/mm/aaaa <-> yyyy-mm-dd) ---

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

// --- Lógica de período ---

function resolverPeriodo(
  periodo: string,
  dataInicialBR?: string,
  dataFinalBR?: string,
): SaldoFiltroParams {
  const hoje = new Date();

  if (periodo === "todo_periodo")
    return { saldosContasAlltime: true, saldosContasIntervalo: "MONTHLY" };

  if (
    periodo === "personalizado" &&
    dataInicialBR &&
    isDataBRValida(dataInicialBR) &&
    dataFinalBR &&
    isDataBRValida(dataFinalBR)
  ) {
    const isoInicio = brParaISO(dataInicialBR);
    const isoFim = brParaISO(dataFinalBR);
    if (isoInicio > isoFim) return {};
    const diffDias =
      (new Date(isoFim).getTime() - new Date(isoInicio).getTime()) /
      (1000 * 60 * 60 * 24);
    const intervalo: TimeInterval =
      diffDias <= 31 ? "DAILY" : diffDias <= 90 ? "WEEKLY" : "MONTHLY";
    return {
      saldosContasDataInicial: isoInicio,
      saldosContasDataFinal: isoFim,
      saldosContasIntervalo: intervalo,
    };
  }

  const mapaPreset: Record<string, { meses: number; intervalo: TimeInterval }> =
    {
      mes_atual: { meses: 0, intervalo: "DAILY" },
      ultimos_3_meses: { meses: 3, intervalo: "WEEKLY" },
      ultimos_6_meses: { meses: 6, intervalo: "WEEKLY" },
      ultimos_12_meses: { meses: 12, intervalo: "MONTHLY" },
    };

  const preset = mapaPreset[periodo] ?? mapaPreset["mes_atual"];

  // Fim: último dia do mês atual
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  // Início: primeiro dia do mês N meses atrás
  const inicio = new Date(
    hoje.getFullYear(),
    hoje.getMonth() - preset.meses,
    1,
  );

  return {
    saldosContasDataInicial: toISO(inicio),
    saldosContasDataFinal: toISO(fim),
    saldosContasIntervalo: preset.intervalo,
  };
}

// --- Cores e Tooltip ---

const CORES = [
  "#0d6efd",
  "#198754",
  "#dc3545",
  "#ffc107",
  "#0dcaf0",
  "#6f42c1",
];

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
}
function TooltipCustom({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  // Converte yyyy-mm-dd → dd/mm/aaaa no título do tooltip
  const labelFormatado = label ? label.split("-").reverse().join("/") : label;
  return (
    <div className="card shadow-sm border-0 p-2" style={{ minWidth: 180 }}>
      <div className="fw-semibold small mb-1">{labelFormatado}</div>
      {payload.map((entry, i) => (
        <div key={i} className="small" style={{ color: entry.color }}>
          {entry.name}: {convertNumberToCurrencyMask(entry.value)}
        </div>
      ))}
    </div>
  );
}

// --- Componente ---

interface Props {
  data: SaldoPorContaData | undefined;
  onFiltroChange: (params: SaldoFiltroParams) => void;
}

export function SaldoPorContaPeriodo({ data, onFiltroChange }: Props) {
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
        onFiltroChange(resolverPeriodo(periodo, dataInicialBR, dataFinalBR));
      }
      return;
    }
    onFiltroChange(resolverPeriodo(periodo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, dataInicialBR, dataFinalBR]);

  const nomeContas = Object.keys(data ?? {});
  const pontosPorData: Record<string, Record<string, number>> = {};

  nomeContas.forEach((nomeConta) => {
    (data?.[nomeConta] ?? []).forEach((ponto) => {
      if (!pontosPorData[ponto.periodo]) pontosPorData[ponto.periodo] = {};
      pontosPorData[ponto.periodo][nomeConta || "Conta"] =
        ponto.saldo_acumulado;
    });
  });

  const chartData = Object.entries(pontosPorData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, valores]) => ({ periodo: p, ...valores }));

  const series = nomeContas.map((n) => n || "Conta");

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-graph-up-arrow me-2 text-primary"></i>
            Saldo por Conta
          </h6>

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
                    value={dataInicialBR}
                    onChange={(e) =>
                      setDataInicial(mascararData(e.target.value))
                    }
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
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
                    value={dataFinalBR}
                    onChange={(e) => setDataFinal(mascararData(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
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

        {chartData.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-bar-chart-line fs-1 opacity-25"></i>
            <p className="mt-2 small">
              Nenhum dado para o período selecionado.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                {series.map((nome, i) => (
                  <linearGradient
                    key={nome}
                    id={`grad-saldo-${i}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={CORES[i % CORES.length]}
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor={CORES[i % CORES.length]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="periodo"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => {
                  // Converte yyyy-mm-dd → dd/mm/aaaa para exibição no eixo X
                  const [y, m, d] = v.split("-");
                  return `${d}/${m}/${y}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("pt-BR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip content={<TooltipCustom />} />
              {series.length > 1 && <Legend />}
              {series.map((nome, i) => (
                <Area
                  key={nome}
                  type="monotone"
                  dataKey={nome}
                  name={nome}
                  stroke={CORES[i % CORES.length]}
                  fill={`url(#grad-saldo-${i})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
