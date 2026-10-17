import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { brl, mesCurto } from "../CompromissosFuturos/formatadores";
import { NATUREZA, NATUREZAS } from "./constantes";
import type { GastoPorMes, NaturezaGasto } from "../../../types/relatorio";

const compacto = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v);

type Props = { meses: GastoPorMes[]; modoImpressao?: boolean };

export function GraficoMesesGastos({ meses, modoImpressao }: Props) {
  const dados = meses.map((m) => ({ ...m, ...m.naturezas, rotulo: mesCurto(m.mes) }));

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <h6 className="fw-bold mb-3">Gasto mês a mês, por tipo</h6>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={compacto} />
            <Tooltip
              formatter={(valor, nome) => [brl(Number(valor)), NATUREZA[nome as NaturezaGasto]?.rotulo ?? String(nome)]}
              labelFormatter={(_, itens) => {
                const m = itens?.[0]?.payload as GastoPorMes | undefined;
                return m ? `${mesCurto(m.mes)} · total ${brl(m.total)} (pago ${brl(m.pago)})` : "";
              }}
            />
            <Legend formatter={(nome) => NATUREZA[nome as NaturezaGasto]?.rotulo ?? nome} />
            {NATUREZAS.map((n) => (
              <Bar key={n} dataKey={n} stackId="gasto" fill={NATUREZA[n].cor} isAnimationActive={!modoImpressao} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="table-responsive mt-3">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr className="text-muted small">
                <th>Mês</th>
                <th className="text-end">Total</th>
                <th className="text-end">Pago</th>
                <th className="text-end">A pagar</th>
                <th className="text-end">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td>{mesCurto(m.mes)}</td>
                  <td className="text-end fw-semibold">{brl(m.total)}</td>
                  <td className="text-end text-success">{brl(m.pago)}</td>
                  <td className="text-end">{brl(m.pendente)}</td>
                  <td className="text-end text-muted">{brl(m.previsto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
