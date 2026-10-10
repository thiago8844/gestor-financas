import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NomeCenario, RelatorioSimulador } from "../../../../types/simulador";
import { Alternador, CaixaTooltip, Marcador, Secao } from "../ui";
import {
  COR,
  COR_CENARIO,
  LABEL_CENARIO,
  agruparSerie,
  brl,
  brlSinal,
  compacto,
  expandirDiario,
  formatarDataBR,
  formatarDiaMes,
  isoLocal,
  mesCurto,
  tsDe,
  type Granularidade,
} from "../utils";

type Linha = {
  ts: number;
  data: string;
  historico?: number;
  base?: number;
  otimista?: number;
  pessimista?: number;
  personalizado?: number;
  faixa?: [number, number];
  agora?: boolean;
};

const ORDEM: NomeCenario[] = ["personalizado", "base", "otimista", "pessimista"];

function granularidadePadrao(dias: number): Granularidade {
  if (dias <= 62) return "DIARIA";
  if (dias <= 200) return "SEMANAL";
  return "MENSAL";
}

export function GraficoSaldoFuturo({ relatorio, compacto: modoCompacto = false }: { relatorio: RelatorioSimulador; compacto?: boolean }) {
  const { data_inicial: inicio, data_final: fim } = relatorio.periodo;
  const dias = Math.round((tsDe(fim) - tsDe(inicio)) / 86400000) + 1;
  const [granularidade, setGranularidade] = useState<Granularidade>(() => granularidadePadrao(dias));
  const [visiveis, setVisiveis] = useState<Record<NomeCenario, boolean>>({
    base: true,
    personalizado: true,
    otimista: false,
    pessimista: false,
  });
  const [mostrarFaixa, setMostrarFaixa] = useState(true);
  const [mostrarHistorico, setMostrarHistorico] = useState(true);

  const ativo = relatorio.cenario_ativo;
  const linhasAtivas = ORDEM.filter((n) => visiveis[n] && (n !== "personalizado" || ativo || modoCompacto));

  const dados = useMemo(() => {
    const porData = new Map<string, Linha>();
    const pegar = (data: string) => {
      if (!porData.has(data)) porData.set(data, { ts: tsDe(data), data });
      return porData.get(data)!;
    };

    (Object.keys(relatorio.cenarios) as NomeCenario[]).forEach((nome) => {
      const serie = agruparSerie(expandirDiario(relatorio.cenarios[nome].serie_diaria, inicio, fim), granularidade);
      serie.forEach((p) => {
        pegar(p.data)[nome] = p.saldo;
      });
    });

    // "Agora": o saldo atual, antes dos lançamentos de hoje — a série diária guarda o saldo ao FIM
    // de cada dia, e a linha precisa começar exatamente no saldo que está na conta.
    const agora: Linha = { ts: tsDe(inicio) - 12 * 3600 * 1000, data: inicio, agora: true };
    (Object.keys(relatorio.cenarios) as NomeCenario[]).forEach((nome) => {
      agora[nome] = relatorio.cenarios[nome].resumo.saldo_atual;
    });
    porData.set("__agora", agora);

    porData.forEach((linha) => {
      if (linha.otimista !== undefined && linha.pessimista !== undefined) {
        linha.faixa = [Math.min(linha.otimista, linha.pessimista), Math.max(linha.otimista, linha.pessimista)];
      }
    });

    // Saldo histórico ao fim de cada mês, ligando no saldo de hoje.
    relatorio.historico.forEach((h) => {
      const [a, m] = h.mes.split("-").map(Number);
      pegar(isoLocal(new Date(a, m, 0))).historico = h.saldo_final;
    });
    if (relatorio.historico.length) agora.historico = relatorio.cenarios.base.resumo.saldo_atual;

    return [...porData.values()].sort((a, b) => a.ts - b.ts);
  }, [relatorio, granularidade, inicio, fim]);

  const movimentosDeHoje = useMemo(() => relatorio.eventos.filter((e) => e.data === inicio && e.valor !== null), [relatorio.eventos, inicio]);
  const resumoPrincipal = relatorio.cenarios[ativo ? "personalizado" : "base"].resumo;
  const menor = resumoPrincipal.menor_saldo;
  const temHistorico = relatorio.historico.length > 0 && mostrarHistorico && !modoCompacto;
  const dadosVisiveis = temHistorico ? dados : dados.filter((d) => d.ts >= tsDe(inicio) - 12 * 3600 * 1000);
  const faixaVisivel = mostrarFaixa && relatorio.cenarios.otimista.resumo.saldo_final !== relatorio.cenarios.pessimista.resumo.saldo_final;

  const tick = (ts: number) => {
    const iso = isoLocal(new Date(ts));
    return granularidade === "MENSAL" || dias > 200 ? mesCurto(iso.slice(0, 7)) : formatarDiaMes(iso);
  };

  const chip = (nome: NomeCenario) => {
    if (nome === "personalizado" && !ativo && !modoCompacto) return null;
    return (
      <button
        key={nome}
        type="button"
        className={`btn btn-sm ${visiveis[nome] ? "btn-light border" : "btn-outline-light text-muted border"}`}
        aria-pressed={visiveis[nome]}
        onClick={() => setVisiveis((v) => ({ ...v, [nome]: !v[nome] }))}
      >
        <span
          className="d-inline-block me-2 align-middle"
          style={{ width: 14, borderTop: `2px ${nome === "base" && ativo ? "dashed" : "solid"} ${COR_CENARIO[nome]}`, opacity: visiveis[nome] ? 1 : 0.35 }}
        />
        {LABEL_CENARIO[nome]}
      </button>
    );
  };

  const grafico = (
    <ResponsiveContainer width="100%" height={modoCompacto ? 220 : 380}>
      <ComposedChart data={dadosVisiveis} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
        <XAxis dataKey="ts" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={tick} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const l = payload[0].payload as Linha;
            const passado = l.ts < tsDe(inicio) && !l.agora;
            return (
              <CaixaTooltip titulo={l.agora ? "Agora (saldo atual)" : `${passado ? "Fim de " : ""}${formatarDataBR(l.data)}${passado ? " (realizado)" : " (fim do dia)"}`}>
                {l.historico !== undefined && passado && <Marcador cor={COR.neutro} texto={`Saldo realizado: ${brl(l.historico)}`} />}
                {linhasAtivas.map((n) =>
                  l[n] !== undefined ? <Marcador key={n} cor={COR_CENARIO[n]} texto={`${LABEL_CENARIO[n]}: ${brl(l[n]!)}`} /> : null
                )}
                {faixaVisivel && l.faixa && (
                  <div className="text-muted small mt-1">
                    Faixa: {brl(l.faixa[0])} a {brl(l.faixa[1])}
                  </div>
                )}
                {/* O primeiro degrau do gráfico: o que entra e sai hoje (inclusive o que estava vencido). */}
                {l.data === inicio && !l.agora && movimentosDeHoje.length > 0 && (
                  <div className="small mt-2 pt-1 border-top">
                    <div className="text-muted">Entra e sai hoje:</div>
                    {movimentosDeHoje.slice(0, 5).map((e) => (
                      <div key={e.id} className="d-flex justify-content-between gap-3">
                        <span>
                          {e.descricao}
                          {e.atrasado && <span className="text-danger"> (vencido)</span>}
                        </span>
                        <span className={e.tipo === "INCOME" ? "text-success" : "text-danger"}>{brlSinal(e.tipo === "INCOME" ? e.valor! : -e.valor!)}</span>
                      </div>
                    ))}
                    {movimentosDeHoje.length > 5 && <div className="text-muted">+ {movimentosDeHoje.length - 5} outros</div>}
                  </div>
                )}
              </CaixaTooltip>
            );
          }}
        />
        <ReferenceLine y={0} stroke={COR.despesa} strokeOpacity={0.5} strokeDasharray="4 4" />
        {temHistorico && <ReferenceLine x={tsDe(inicio) - 12 * 3600 * 1000} stroke={COR.neutro} strokeDasharray="2 4" label={{ value: "Hoje", position: "insideTopLeft", fontSize: 11, fill: COR.neutro }} />}
        {faixaVisivel && (
          <Area dataKey="faixa" stroke="none" fill={COR.saldo} fillOpacity={0.1} isAnimationActive={false} connectNulls />
        )}
        {temHistorico && (
          <Line dataKey="historico" stroke={COR.neutro} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
        )}
        {linhasAtivas.map((n) => (
          <Line
            key={n}
            dataKey={n}
            type={granularidade === "DIARIA" ? "stepAfter" : "monotone"}
            stroke={COR_CENARIO[n]}
            strokeWidth={n === "personalizado" || (n === "base" && !ativo) ? 2.5 : 1.5}
            strokeDasharray={n === "base" && ativo ? "6 4" : undefined}
            dot={false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls
          />
        ))}
        <ReferenceDot
          x={tsDe(menor.data)}
          y={menor.valor}
          r={6}
          fill={menor.valor < 0 ? COR.despesa : COR_CENARIO[ativo ? "personalizado" : "base"]}
          stroke="#fff"
          strokeWidth={2}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  if (modoCompacto) return grafico;

  return (
    <Secao
      titulo="Evolução do saldo futuro"
      icone="bi-graph-up-arrow"
      ajuda="Parte exatamente do saldo atual e aplica, dia a dia, tudo o que entra e sai. A faixa sombreada vai do cenário pessimista ao otimista: cada mês, as estimativas ficam um desvio típico (medido no seu histórico) acima ou abaixo do esperado. Não é um intervalo de 95%."
      acoes={
        <Alternador
          rotulo="Granularidade"
          valor={granularidade}
          onChange={setGranularidade}
          opcoes={[
            { valor: "DIARIA", label: "Dia" },
            { valor: "SEMANAL", label: "Semana" },
            { valor: "MENSAL", label: "Mês" },
          ]}
        />
      }
      rodape={
        <>
          O ponto destacado é o menor saldo previsto: <strong>{brl(menor.valor)}</strong> em {formatarDataBR(menor.data)}.
          {menor.valor < 0 && " Abaixo da linha tracejada vermelha, o saldo fica negativo."}
        </>
      }
    >
      <div className="d-flex flex-wrap gap-2 mb-3">
        {ORDEM.map(chip)}
        <button
          type="button"
          className={`btn btn-sm ${mostrarFaixa ? "btn-light border" : "btn-outline-light text-muted border"}`}
          aria-pressed={mostrarFaixa}
          onClick={() => setMostrarFaixa((v) => !v)}
        >
          <span className="d-inline-block me-2 align-middle rounded" style={{ width: 14, height: 10, background: COR.saldo, opacity: 0.2 }} />
          Faixa otimista–pessimista
        </button>
        {relatorio.historico.length > 0 && (
          <button
            type="button"
            className={`btn btn-sm ${mostrarHistorico ? "btn-light border" : "btn-outline-light text-muted border"}`}
            aria-pressed={mostrarHistorico}
            onClick={() => setMostrarHistorico((v) => !v)}
          >
            <span className="d-inline-block me-2 align-middle" style={{ width: 14, borderTop: `2px solid ${COR.neutro}` }} />
            Saldo realizado
          </button>
        )}
      </div>
      {grafico}
    </Secao>
  );
}
