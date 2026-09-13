import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { LinhaCategoriaResultado, PontoMensalResultado } from "../../../types/relatorio";

const COR_RECEITAS = "#198754";
const COR_DESPESAS = "#dc3545";
const CORES = ["#0d6efd", "#198754", "#dc3545", "#ffc107", "#0dcaf0", "#6f42c1", "#fd7e14", "#20c997"];

function formatarMes(periodo: string): string {
  const [y, m] = periodo.split("-");
  return `${m}/${y}`;
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
      <div className="fw-semibold small mb-1">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="small" style={{ color: entry.color }}>
          {entry.name}: {convertNumberToCurrencyMask(entry.value)}
        </div>
      ))}
    </div>
  );
}

type Props = {
  serieMensal: PontoMensalResultado[];
  despesasPorCategoria: LinhaCategoriaResultado[];
};

export function GraficosResultadoFinanceiro({ serieMensal, despesasPorCategoria }: Props) {
  const dadosMensais = serieMensal.map((ponto) => ({ ...ponto, periodo: formatarMes(ponto.periodo) }));

  const dadosDespesas = despesasPorCategoria
    .map((linha) => ({ categoria: linha.categoria, total: linha.total, percentual: linha.percentual }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h6 className="fw-bold mb-3">
            <i className="bi bi-bar-chart-fill me-2 text-primary"></i>
            Receitas x Despesas por mês
          </h6>

          {dadosMensais.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-bar-chart-line fs-1 opacity-25"></i>
              <p className="mt-2 small">Nenhum dado para o período selecionado.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosMensais} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)}
                />
                <Tooltip content={<TooltipCustom />} />
                <Legend />
                <Bar dataKey="receitas" name="Receita" fill={COR_RECEITAS} radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesa" fill={COR_DESPESAS} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h6 className="fw-bold mb-3">
            <i className="bi bi-bar-chart-steps me-2 text-primary"></i>
            Distribuição das despesas
          </h6>

          {dadosDespesas.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-bar-chart-line fs-1 opacity-25"></i>
              <p className="mt-2 small">Nenhuma despesa no período selecionado.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, dadosDespesas.length * 44)}>
              <BarChart
                data={dadosDespesas}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v)}
                />
                <YAxis type="category" dataKey="categoria" tick={{ fontSize: 12 }} width={110} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as { categoria: string; total: number; percentual: number | null };
                    return (
                      <div className="card shadow-sm border-0 p-2" style={{ minWidth: 180 }}>
                        <div className="fw-semibold small mb-1">{item.categoria}</div>
                        <div className="small">
                          {convertNumberToCurrencyMask(item.total)}
                          {item.percentual !== null ? ` · ${item.percentual}%` : ""}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {dadosDespesas.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
