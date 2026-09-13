import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { PontoFluxoCaixa } from "../../../types/relatorio";

const COR_SALDO = "#0d6efd";
const COR_ENTRADAS = "#198754";
const COR_SAIDAS = "#dc3545";

function formatarEixoX(periodo: string): string {
  const [y, m, d] = periodo.split("-");
  return `${d}/${m}/${y}`;
}

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
}

function TooltipCustom({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="card shadow-sm border-0 p-2" style={{ minWidth: 180 }}>
      <div className="fw-semibold small mb-1">{label ? formatarEixoX(label) : label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="small" style={{ color: entry.color }}>
          {entry.name}: {convertNumberToCurrencyMask(entry.value)}
        </div>
      ))}
    </div>
  );
}

type Props = {
  serie: PontoFluxoCaixa[];
};

export function GraficosFluxoCaixa({ serie }: Props) {
  if (serie.length === 0) {
    return (
      <div className="text-center text-muted py-5">
        <i className="bi bi-bar-chart-line fs-1 opacity-25"></i>
        <p className="mt-2 small">Nenhum dado para o período selecionado.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h6 className="fw-bold mb-3">
            <i className="bi bi-graph-up-arrow me-2 text-primary"></i>
            Evolução do saldo
          </h6>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={serie} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-saldo-fluxo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COR_SALDO} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={COR_SALDO} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} tickFormatter={formatarEixoX} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)}
              />
              <Tooltip content={<TooltipCustom />} />
              <Area
                type="monotone"
                dataKey="saldo_acumulado"
                name="Saldo acumulado"
                stroke={COR_SALDO}
                fill="url(#grad-saldo-fluxo)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h6 className="fw-bold mb-3">
            <i className="bi bi-bar-chart-fill me-2 text-primary"></i>
            Entradas x Saídas por período
          </h6>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={serie} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} tickFormatter={formatarEixoX} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)}
              />
              <Tooltip content={<TooltipCustom />} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill={COR_ENTRADAS} radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill={COR_SAIDAS} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
