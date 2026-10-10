import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, formatarDataBR, formatarDiaMes, mesCurto, nomeMes } from "./formatadores";
import type { MesProjecao, PontoSaldoDiario, ResumoCompromissosFuturos, TipoProjecao } from "../../../types/relatorio";

// Verde = sobra no mês, vermelho = faltou dinheiro no mês, azul = saldo acumulado.
const COR_POSITIVO = "#198754";
const COR_NEGATIVO = "#dc3545";
const COR_SALDO = "#0d6efd";

const compacto = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(v);

const TITULO_MENSAL: Record<TipoProjecao, string> = {
  AMBOS: "Quanto sobra por mês",
  DESPESAS: "Quanto fica se pagar as despesas",
  RECEITAS: "Quanto entra por mês",
};

const ROTULO_RESULTADO: Record<TipoProjecao, string> = {
  AMBOS: "Sobra no mês",
  DESPESAS: "Gasto no mês",
  RECEITAS: "Entrada no mês",
};

type Props = {
  tipos: TipoProjecao;
  meses: MesProjecao[];
  serieDiaria: PontoSaldoDiario[];
  resumo: ResumoCompromissosFuturos;
  dataInicial: string;
  /** Há valores estimados: mostra a faixa de incerteza em volta do saldo. */
  mostrarFaixa: boolean;
  modoImpressao?: boolean;
};

type Visao = "MENSAL" | "DIARIA";

function Marcador({ cor, texto }: { cor: string; texto: string }) {
  return (
    <div className="d-flex align-items-center gap-2 small">
      <span className="rounded-circle d-inline-block" style={{ width: 8, height: 8, background: cor }} />
      <span>{texto}</span>
    </div>
  );
}

type PontoMensal = {
  rotulo: string;
  chave: string;
  inicial: boolean;
  saldo: number;
  resultado: number | null;
  faixa: [number, number];
  mes: MesProjecao | null;
};

function TooltipMensal({
  active,
  payload,
  tipos,
}: {
  active?: boolean;
  payload?: { payload: PontoMensal }[];
  tipos: TipoProjecao;
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;

  if (ponto.inicial || !ponto.mes) {
    return (
      <div className="card shadow-sm border-0 p-2" style={{ minWidth: 200 }}>
        <div className="fw-semibold small mb-1">Hoje</div>
        <Marcador cor={COR_SALDO} texto={`Saldo atual: ${brl(ponto.saldo)}`} />
      </div>
    );
  }

  const mes = ponto.mes;
  const resultado = mes.resultado;

  return (
    <div className="card shadow-sm border-0 p-2" style={{ minWidth: 240 }}>
      <div className="fw-semibold small mb-1">{nomeMes(mes.mes)}</div>
      <Marcador
        cor={resultado >= 0 ? COR_POSITIVO : COR_NEGATIVO}
        texto={`${ROTULO_RESULTADO[tipos]}: ${resultado >= 0 ? "+ " : "− "}${brl(Math.abs(resultado))}`}
      />
      {tipos !== "DESPESAS" && <Marcador cor={COR_POSITIVO} texto={`Entradas: ${brl(mes.entradas)}`} />}
      {tipos !== "RECEITAS" && <Marcador cor={COR_NEGATIVO} texto={`Saídas: ${brl(mes.saidas)}`} />}
      <Marcador cor={COR_SALDO} texto={`Saldo ao final: ${brl(mes.saldo_final)}`} />
      <div className="text-muted small mt-1">
        Menor saldo no mês: {brl(mes.saldo_minimo)}
        {mes.incerteza > 0 && <div>Margem de incerteza: ± {brl(mes.incerteza)}</div>}
      </div>
    </div>
  );
}

export function GraficoEvolucaoSaldo({
  tipos,
  meses,
  serieDiaria,
  resumo,
  dataInicial,
  mostrarFaixa,
  modoImpressao,
}: Props) {
  const [visao, setVisao] = useState<Visao>("MENSAL");

  const dadosMensais = useMemo<PontoMensal[]>(() => {
    const inicio: PontoMensal = {
      rotulo: "Hoje",
      chave: "hoje",
      inicial: true,
      saldo: resumo.saldo_atual,
      resultado: null,
      faixa: [resumo.saldo_atual, resumo.saldo_atual],
      mes: null,
    };

    const porMes = meses.map<PontoMensal>((mes) => ({
      rotulo: mesCurto(mes.mes),
      chave: mes.mes,
      inicial: false,
      saldo: mes.saldo_final,
      resultado: mes.resultado,
      faixa: [mes.saldo_final - mes.incerteza, mes.saldo_final + mes.incerteza],
      mes,
    }));

    return [inicio, ...porMes];
  }, [meses, resumo.saldo_atual]);

  const dadosDiarios = useMemo(
    () =>
      serieDiaria.map((ponto) => ({
        ...ponto,
        ts: new Date(`${ponto.data}T12:00:00`).getTime(),
      })),
    [serieDiaria]
  );

  const temDados = meses.length > 0;
  const animar = !modoImpressao;
  const menor = resumo.menor_saldo;
  const dataInicialTs = new Date(`${dataInicial}T12:00:00`).getTime();

  return (
    <div className="card shadow-sm border-0 h-100">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-graph-up-arrow me-2 text-primary"></i>
            {visao === "MENSAL" || modoImpressao ? TITULO_MENSAL[tipos] : "Saldo dia a dia"}
          </h6>

          {!modoImpressao && (
            <div className="btn-group btn-group-sm" role="group" aria-label="Visão do gráfico">
              <button
                type="button"
                className={`btn ${visao === "MENSAL" ? "btn-primary" : "btn-outline-primary"}`}
                aria-pressed={visao === "MENSAL"}
                onClick={() => setVisao("MENSAL")}
              >
                Por mês
              </button>
              <button
                type="button"
                className={`btn ${visao === "DIARIA" ? "btn-primary" : "btn-outline-primary"}`}
                aria-pressed={visao === "DIARIA"}
                onClick={() => setVisao("DIARIA")}
              >
                Dia a dia
              </button>
            </div>
          )}
        </div>

        {!temDados ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-bar-chart-line fs-1 opacity-25"></i>
            <p className="mt-2 small">Nenhum compromisso no período selecionado.</p>
          </div>
        ) : visao === "MENSAL" || modoImpressao ? (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={dadosMensais} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={compacto} width={52} />
              <Tooltip content={<TooltipMensal tipos={tipos} />} cursor={{ fill: "rgba(13,110,253,0.05)" }} />
              <Legend verticalAlign="top" height={32} iconType="circle" iconSize={8} />
              <ReferenceLine y={0} stroke="#6c757d" strokeWidth={1.5} />
              {mostrarFaixa && (
                <Area
                  dataKey="faixa"
                  name="Margem de incerteza"
                  stroke="none"
                  fill={COR_SALDO}
                  fillOpacity={0.12}
                  isAnimationActive={animar}
                  legendType="square"
                />
              )}
              <Bar
                dataKey="resultado"
                name={ROTULO_RESULTADO[tipos]}
                fill={COR_POSITIVO}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                isAnimationActive={animar}
              >
                {dadosMensais.map((ponto) => (
                  <Cell
                    key={ponto.chave}
                    fill={(ponto.resultado ?? 0) >= 0 ? COR_POSITIVO : COR_NEGATIVO}
                  />
                ))}
              </Bar>
              <Line
                dataKey="saldo"
                name="Saldo ao final do mês"
                stroke={COR_SALDO}
                strokeWidth={2}
                dot={{ r: 4, fill: COR_SALDO, stroke: "#fff", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                isAnimationActive={animar}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={dadosDiarios} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={[dataInicialTs, "dataMax"]}
                tick={{ fontSize: 11 }}
                tickFormatter={(ts: number) => formatarDiaMes(new Date(ts).toISOString().slice(0, 10))}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={compacto} width={52} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const ponto = payload[0].payload as { data: string; saldo: number };
                  return (
                    <div className="card shadow-sm border-0 p-2" style={{ minWidth: 190 }}>
                      <div className="fw-semibold small mb-1">{formatarDataBR(ponto.data)}</div>
                      <Marcador cor={COR_SALDO} texto={`Saldo: ${brl(ponto.saldo)}`} />
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="#6c757d" strokeWidth={1.5} />
              <Area
                dataKey="saldo"
                type="stepAfter"
                stroke={COR_SALDO}
                strokeWidth={2}
                fill={COR_SALDO}
                fillOpacity={0.08}
                baseValue={0}
                dot={false}
                isAnimationActive={animar}
              />
              <ReferenceDot
                x={new Date(`${menor.data}T12:00:00`).getTime()}
                y={menor.valor}
                r={5}
                fill={menor.valor < 0 ? COR_NEGATIVO : COR_SALDO}
                stroke="#fff"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {temDados && (
          <p className="text-muted small mt-2 mb-0">
            {visao === "DIARIA" && !modoImpressao
              ? `O ponto destacado é o menor saldo previsto: ${brl(menor.valor)} em ${formatarDataBR(menor.data)}. `
              : ""}
            {tipos === "AMBOS" &&
              "Barras: quanto sobra (ou falta) em cada mês. Linha: saldo acumulado ao fim do mês. "}
            Considera só o que já está cadastrado (incluindo recorrências futuras); gastos novos, como compras
            ainda não feitas no cartão, não entram na projeção.
          </p>
        )}
      </div>
    </div>
  );
}
