import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MesSimulacao, RelatorioSimulador } from "../../../../types/simulador";
import { CaixaTooltip, Secao } from "../ui";
import { COR, brl, brlSinal, compacto, nomeMes } from "../utils";

type Passo = { rotulo: string; valor: number; tipo: "saldo" | "entrada" | "saida"; faixa: [number, number] };

/**
 * Saldo inicial → entradas → saídas → saldo final, como barras "flutuantes": cada passo começa
 * onde o anterior terminou. Recharts não tem waterfall nativo; a barra recebe [início, fim].
 */
function montarPassos(saldoInicial: number, meses: MesSimulacao[]): Passo[] {
  const soma = (fn: (m: MesSimulacao) => number) => Math.round(meses.reduce((s, m) => s + fn(m), 0) * 100) / 100;

  const movimentos: Omit<Passo, "faixa">[] = [
    { rotulo: "Receitas confirmadas", valor: soma((m) => m.receitas.conhecidas), tipo: "entrada" },
    { rotulo: "Receitas estimadas", valor: soma((m) => m.receitas.estimadas), tipo: "entrada" },
    { rotulo: "Receitas simuladas", valor: soma((m) => m.receitas.hipoteticas), tipo: "entrada" },
    { rotulo: "Despesas conhecidas", valor: -soma((m) => m.despesas.fora_cartao.conhecidas), tipo: "saida" },
    { rotulo: "Faturas de cartão", valor: -soma((m) => m.faturas.total), tipo: "saida" },
    { rotulo: "Gastos estimados", valor: -soma((m) => m.despesas.fora_cartao.estimadas), tipo: "saida" },
    { rotulo: "Despesas simuladas", valor: -soma((m) => m.despesas.fora_cartao.hipoteticas), tipo: "saida" },
  ];

  const passos: Passo[] = [{ rotulo: "Saldo inicial", valor: saldoInicial, tipo: "saldo", faixa: [0, saldoInicial] }];
  let acumulado = saldoInicial;

  movimentos
    .filter((m) => Math.abs(m.valor) >= 0.01)
    .forEach((m) => {
      const fim = Math.round((acumulado + m.valor) * 100) / 100;
      passos.push({ ...m, faixa: [Math.min(acumulado, fim), Math.max(acumulado, fim)] });
      acumulado = fim;
    });

  passos.push({ rotulo: "Saldo final", valor: acumulado, tipo: "saldo", faixa: [0, acumulado] });
  return passos;
}

export function GraficoCascata({ relatorio }: { relatorio: RelatorioSimulador }) {
  const meses = relatorio.cenarios.personalizado.meses;
  const [mes, setMes] = useState<string>("TODOS");

  const passos = useMemo(() => {
    if (mes === "TODOS") return montarPassos(relatorio.cenarios.personalizado.resumo.saldo_atual, meses);
    const m = meses.find((x) => x.mes === mes)!;
    return montarPassos(m.saldo_inicial, [m]);
  }, [mes, meses, relatorio]);

  const cor = (p: Passo) =>
    p.tipo === "saldo" ? (p.valor < 0 ? COR.despesa : COR.saldo) : p.rotulo.includes("simulad") ? COR.hipotetico : p.tipo === "entrada" ? COR.receita : COR.despesa;

  return (
    <Secao
      titulo="De onde vem a variação do caixa"
      icone="bi-bar-chart-steps"
      acoes={
        <select className="form-select form-select-sm w-auto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
          <option value="TODOS">Período inteiro</option>
          {meses.map((m) => (
            <option key={m.mes} value={m.mes}>
              {nomeMes(m.mes)}
            </option>
          ))}
        </select>
      }
      rodape="Faturas aparecem no vencimento (já incluem as compras estimadas e simuladas no cartão)."
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={passos} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={56} />
          <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
          <Tooltip
            cursor={{ fill: "rgba(13,110,253,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Passo;
              return (
                <CaixaTooltip titulo={p.rotulo}>
                  <div className="small">{p.tipo === "saldo" ? brl(p.valor) : brlSinal(p.valor)}</div>
                  {p.tipo !== "saldo" && <div className="text-muted small">Saldo depois: {brl(p.valor > 0 ? p.faixa[1] : p.faixa[0])}</div>}
                </CaixaTooltip>
              );
            }}
          />
          <Bar dataKey="faixa" radius={[4, 4, 4, 4]} isAnimationActive={false} maxBarSize={48}>
            {passos.map((p) => (
              <Cell key={p.rotulo} fill={cor(p)} fillOpacity={p.rotulo.includes("estimad") ? 0.5 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Secao>
  );
}
