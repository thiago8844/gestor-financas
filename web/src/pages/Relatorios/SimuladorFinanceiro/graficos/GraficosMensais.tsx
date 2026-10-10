import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatoLegenda } from "../legenda";
import type { RelatorioSimulador } from "../../../../types/simulador";
import { Alternador, CaixaTooltip, Marcador, Secao } from "../ui";
import { COR, COR_CENARIO, brl, brlSinal, compacto, mesCurto, nomeMes, pct } from "../utils";

const CLARO_RECEITA = "#7cc49f";
const CLARO_DESPESA = "#ec8b95";

// -=-=-=- GRÁFICO 2: RECEITAS × DESPESAS FUTURAS -=-=-=-

export function GraficoReceitasDespesas({ relatorio }: { relatorio: RelatorioSimulador }) {
  const [visao, setVisao] = useState<"DECOMPOSTO" | "TOTAIS">("DECOMPOSTO");
  const meses = relatorio.cenarios.personalizado.meses;

  const dados = meses.map((m) => ({
    rotulo: mesCurto(m.mes),
    mes: m,
    receitaConhecida: m.receitas.conhecidas,
    receitaEstimada: m.receitas.estimadas,
    receitaSimulada: m.receitas.hipoteticas,
    despesaConhecida: m.despesas.conhecidas,
    despesaEstimada: m.despesas.estimadas,
    despesaSimulada: m.despesas.hipoteticas,
    receitas: m.receitas.total,
    despesas: m.despesas.total,
  }));

  const temSimulado = meses.some((m) => m.receitas.hipoteticas + m.despesas.hipoteticas > 0);
  const raio: [number, number, number, number] = [4, 4, 0, 0];

  return (
    <Secao
      titulo="Receitas × despesas futuras"
      icone="bi-bar-chart"
      acoes={
        <Alternador
          rotulo="Visão"
          valor={visao}
          onChange={setVisao}
          opcoes={[
            { valor: "DECOMPOSTO", label: "Conhecido × previsto" },
            { valor: "TOTAIS", label: "Totais" },
          ]}
        />
      }
      rodape="Tons mais claros são previsões estatísticas; tons cheios, valores já cadastrados (incluindo recorrências). Despesas incluem as faturas de cartão no vencimento."
    >
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={dados} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
          <Tooltip
            cursor={{ fill: "rgba(13,110,253,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof dados)[number];
              const m = d.mes;
              return (
                <CaixaTooltip titulo={nomeMes(m.mes)} largura={250}>
                  <Marcador cor={COR.receita} texto={`Receitas: ${brl(m.receitas.total)}`} />
                  <div className="text-muted small ms-3">
                    {brl(m.receitas.conhecidas)} confirmadas · {brl(m.receitas.estimadas)} estimadas
                    {m.receitas.hipoteticas > 0 && ` · ${brl(m.receitas.hipoteticas)} simuladas`}
                  </div>
                  <Marcador cor={COR.despesa} texto={`Despesas: ${brl(m.despesas.total)}`} />
                  <div className="text-muted small ms-3">
                    {brl(m.despesas.conhecidas)} conhecidas · {brl(m.despesas.estimadas)} estimadas
                    {m.despesas.hipoteticas > 0 && ` · ${brl(m.despesas.hipoteticas)} simuladas`}
                  </div>
                  <div className="small mt-1">Resultado: {brlSinal(m.resultado)}</div>
                </CaixaTooltip>
              );
            }}
          />
          <Legend verticalAlign="top" height={40} formatter={formatoLegenda} iconType="square" iconSize={10} />
          {visao === "TOTAIS" ? (
            <>
              <Bar dataKey="receitas" name="Receitas" fill={COR.receita} radius={raio} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="despesas" name="Despesas" fill={COR.despesa} radius={raio} maxBarSize={28} isAnimationActive={false} />
            </>
          ) : (
            <>
              <Bar dataKey="receitaConhecida" name="Receita confirmada" stackId="r" fill={COR.receita} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="receitaEstimada" name="Receita estimada" stackId="r" fill={CLARO_RECEITA} maxBarSize={28} isAnimationActive={false} />
              {temSimulado && <Bar dataKey="receitaSimulada" name="Receita simulada" stackId="r" fill={COR.hipotetico} fillOpacity={0.55} maxBarSize={28} isAnimationActive={false} />}
              <Bar dataKey="despesaConhecida" name="Despesa conhecida" stackId="d" fill={COR.despesa} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="despesaEstimada" name="Despesa estimada" stackId="d" fill={CLARO_DESPESA} maxBarSize={28} isAnimationActive={false} />
              {temSimulado && <Bar dataKey="despesaSimulada" name="Despesa simulada" stackId="d" fill={COR.hipotetico} maxBarSize={28} isAnimationActive={false} />}
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Secao>
  );
}

// -=-=-=- GRÁFICO 4: HISTÓRICO × FUTURO -=-=-=-

export function GraficoHistoricoFuturo({ relatorio }: { relatorio: RelatorioSimulador }) {
  const [medida, setMedida] = useState<"despesas" | "receitas">("despesas");
  const ativo = relatorio.cenario_ativo;

  const dados = useMemo(() => {
    const passado = relatorio.historico.map((h) => ({
      chave: h.mes,
      rotulo: mesCurto(h.mes),
      realizado: h[medida],
      previsto: undefined as number | undefined,
      simulado: undefined as number | undefined,
    }));
    const base = relatorio.cenarios.base.meses;
    const pers = relatorio.cenarios.personalizado.meses;
    const futuro = base.map((m, i) => ({
      chave: m.mes,
      rotulo: mesCurto(m.mes),
      realizado: undefined as number | undefined,
      previsto: m[medida].total,
      simulado: ativo ? pers[i]?.[medida].total : undefined,
    }));
    return [...passado, ...futuro];
  }, [relatorio, medida, ativo]);

  const primeiroFuturo = relatorio.cenarios.base.meses[0]?.mes;
  const cor = medida === "despesas" ? COR.despesa : COR.receita;

  if (!relatorio.historico.length) {
    return (
      <Secao titulo="Histórico × futuro previsto" icone="bi-clock-history">
        <p className="text-muted small mb-0">Ainda não há meses completos de histórico nas contas selecionadas.</p>
      </Secao>
    );
  }

  return (
    <Secao
      titulo="Histórico × futuro previsto"
      icone="bi-clock-history"
      acoes={
        <Alternador
          rotulo="Medida"
          valor={medida}
          onChange={setMedida}
          opcoes={[
            { valor: "despesas", label: "Despesas" },
            { valor: "receitas", label: "Receitas" },
          ]}
        />
      }
      rodape="À esquerda, o que foi pago em cada mês (regime de caixa, sem transferências nem saldo inicial). À direita da linha, a previsão. O primeiro mês previsto é o mês corrente inteiro (já pago + a pagar)."
    >
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={dados} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} minTickGap={8} />
          <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
          {primeiroFuturo && (
            <ReferenceArea x1={mesCurto(primeiroFuturo)} x2={dados[dados.length - 1].rotulo} fill={COR.saldo} fillOpacity={0.04} />
          )}
          {primeiroFuturo && <ReferenceLine x={mesCurto(primeiroFuturo)} stroke={COR.neutro} strokeDasharray="3 3" label={{ value: "Previsão →", position: "insideTopRight", fontSize: 11, fill: COR.neutro }} />}
          <Tooltip
            cursor={{ fill: "rgba(13,110,253,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof dados)[number];
              return (
                <CaixaTooltip titulo={nomeMes(d.chave)}>
                  {d.realizado !== undefined && <Marcador cor={cor} texto={`Realizado: ${brl(d.realizado)}`} />}
                  {d.previsto !== undefined && <Marcador cor={cor} texto={`Previsão automática: ${brl(d.previsto)}`} />}
                  {d.simulado !== undefined && <Marcador cor={COR_CENARIO.personalizado} texto={`Minha simulação: ${brl(d.simulado)}`} />}
                </CaixaTooltip>
              );
            }}
          />
          <Legend verticalAlign="top" height={40} formatter={formatoLegenda} iconType="square" iconSize={10} />
          <Bar dataKey="realizado" name="Realizado" fill={cor} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="previsto" name="Previsto" fill={cor} fillOpacity={0.45} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          {ativo && (
            <Line dataKey="simulado" name="Minha simulação" stroke={COR_CENARIO.personalizado} strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Secao>
  );
}

// -=-=-=- GRÁFICO 9: CAPACIDADE DE POUPANÇA -=-=-=-

export function GraficoPoupanca({ relatorio }: { relatorio: RelatorioSimulador }) {
  const meses = relatorio.cenarios.personalizado.meses;
  const historico = relatorio.historico;

  const dados = [
    ...historico.map((h) => ({ rotulo: mesCurto(h.mes), chave: h.mes, sobra: Math.round((h.receitas - h.despesas) * 100) / 100, futuro: false })),
    ...meses.map((m) => ({ rotulo: mesCurto(m.mes), chave: m.mes, sobra: m.resultado, futuro: true })),
  ];

  const recHist = historico.reduce((s, h) => s + h.receitas, 0);
  const despHist = historico.reduce((s, h) => s + h.despesas, 0);
  const taxaHistorica = recHist > 0 ? ((recHist - despHist) / recHist) * 100 : null;
  const taxaProjetada = relatorio.cenarios.personalizado.resumo.taxa_poupanca_pct;

  return (
    <Secao
      titulo="Capacidade de poupança"
      icone="bi-piggy-bank"
      rodape="Sobra de cada mês = receitas − despesas. Barras claras são meses previstos."
    >
      <div className="row g-2 mb-3">
        <div className="col-6">
          <div className="border rounded p-2 h-100">
            <div className="text-muted small">Taxa de poupança histórica</div>
            <div className={`fs-5 fw-semibold ${(taxaHistorica ?? 0) < 0 ? "text-danger" : ""}`}>{pct(taxaHistorica)}</div>
          </div>
        </div>
        <div className="col-6">
          <div className="border rounded p-2 h-100">
            <div className="text-muted small">Taxa de poupança projetada</div>
            <div className={`fs-5 fw-semibold ${(taxaProjetada ?? 0) < 0 ? "text-danger" : ""}`}>{pct(taxaProjetada)}</div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={dados} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} minTickGap={8} />
          <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={52} />
          <ReferenceLine y={0} stroke={COR.neutro} />
          <Tooltip
            cursor={{ fill: "rgba(13,110,253,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof dados)[number];
              return (
                <CaixaTooltip titulo={`${nomeMes(d.chave)}${d.futuro ? " (previsto)" : ""}`}>
                  <Marcador cor={d.sobra >= 0 ? COR.receita : COR.despesa} texto={`Sobra: ${brlSinal(d.sobra)}`} />
                </CaixaTooltip>
              );
            }}
          />
          <Bar dataKey="sobra" radius={[4, 4, 4, 4]} maxBarSize={22} isAnimationActive={false}>
            {dados.map((d) => (
              <Cell key={d.chave} fill={d.sobra >= 0 ? COR.receita : COR.despesa} fillOpacity={d.futuro ? 0.5 : 1} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </Secao>
  );
}
