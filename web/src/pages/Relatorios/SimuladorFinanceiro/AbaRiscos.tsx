import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatoLegenda } from "./legenda";
import type { AjusteCenario, RelatorioSimulador, SaldoNegativoRisco } from "../../../types/simulador";
import { BadgeNatureza, CaixaTooltip, Marcador, Secao } from "./ui";
import {
  COR,
  brl,
  brlSinal,
  compacto,
  diaDaSemana,
  expandirDiario,
  formatarDataBR,
  formatarDataExtensa,
  mesCurto,
  nomeMes,
  pct,
} from "./utils";

type Props = {
  relatorio: RelatorioSimulador;
  onAplicarAjuste: (ajuste: AjusteCenario) => void;
};

export function AbaRiscos({ relatorio, onAplicarAjuste }: Props) {
  const { riscos } = relatorio;

  return (
    <div className="row g-4">
      <div className="col-12 col-xl-6">
        <SaldoNegativo relatorio={relatorio} />
      </div>
      <div className="col-12 col-xl-6">
        <ReceitasIncertas relatorio={relatorio} />
      </div>
      <div className="col-12">
        <CalendarioRisco relatorio={relatorio} />
      </div>
      <div className="col-12 col-xl-7">
        <Comprometimento relatorio={relatorio} />
      </div>
      <div className="col-12 col-xl-5">
        <MesesAtipicos relatorio={relatorio} />
      </div>
      <div className="col-12 col-xl-7">
        <Sensibilidade relatorio={relatorio} onAplicarAjuste={onAplicarAjuste} />
      </div>
      <div className="col-12 col-xl-5">
        <Secao
          titulo="Categorias que mais oscilam"
          icone="bi-activity"
          ajuda="Categorias com coeficiente de variação de 50% ou mais (o gasto mensal costuma se afastar bastante da média) e peso relevante na previsão. São as que mais podem fazer o resultado real diferir do previsto."
        >
          {riscos.categorias_volateis.length === 0 ? (
            <p className="text-muted small mb-0">
              <i className="bi bi-check-circle text-success me-1"></i>Nenhuma categoria relevante com oscilação alta no histórico.
            </p>
          ) : (
            <ul className="list-unstyled small mb-0">
              {riscos.categorias_volateis.map((c) => (
                <li key={c.chave} className="d-flex justify-content-between py-2 border-bottom">
                  <span>
                    <strong>{c.categoria}</strong>
                    <div className="text-muted">
                      Previsão {brl(c.estimativa)}/mês · costuma variar ± {brl(c.desvio)} · já chegou a {brl(c.maximo)}
                    </div>
                  </span>
                  <span className="text-nowrap text-warning-emphasis">CV {pct(c.coeficiente_variacao * 100, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  );
}

// -=-=-=- SALDO NEGATIVO -=-=-=-

function BlocoNegativo({ titulo, risco }: { titulo: string; risco: SaldoNegativoRisco | null }) {
  if (!risco) {
    return (
      <div className="mb-3">
        <div className="fw-semibold small">{titulo}</div>
        <div className="small text-success">
          <i className="bi bi-check-circle-fill me-1"></i>O saldo total não fica negativo no período.
        </div>
      </div>
    );
  }
  return (
    <div className="mb-3">
      <div className="fw-semibold small">{titulo}</div>
      <div className="small text-danger">
        <i className="bi bi-exclamation-octagon-fill me-1"></i>
        Fica negativo em <strong>{formatarDataExtensa(risco.primeira_data)}</strong> e chega a <strong>{brl(risco.menor_saldo)}</strong> em{" "}
        {formatarDataBR(risco.data_menor_saldo)}.{" "}
        {risco.volta_ao_positivo_em ? `Volta ao positivo em ${formatarDataBR(risco.volta_ao_positivo_em)} (${risco.dias} dias).` : `Não volta ao positivo até o fim do período (${risco.dias} dias).`}
      </div>
      {risco.contribuintes.length > 0 && (
        <div className="small mt-2">
          <div className="text-muted">Maiores saídas até lá:</div>
          <ul className="list-unstyled mb-0">
            {risco.contribuintes.map((c, i) => (
              <li key={i} className="d-flex justify-content-between gap-2">
                <span>
                  <BadgeNatureza natureza={c.natureza} /> <span className="ms-1">{c.descricao}</span>
                  <span className="text-muted"> · {formatarDataBR(c.data)}</span>
                </span>
                <span className="text-nowrap">{brl(c.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SaldoNegativo({ relatorio }: { relatorio: RelatorioSimulador }) {
  const { saldo_negativo } = relatorio.riscos;
  return (
    <Secao titulo="Saldo negativo" icone="bi-exclamation-triangle">
      <BlocoNegativo titulo={relatorio.cenario_ativo ? "Minha simulação" : "Previsão automática"} risco={saldo_negativo.personalizado} />
      {relatorio.cenario_ativo && <BlocoNegativo titulo="Previsão automática" risco={saldo_negativo.base} />}
      {saldo_negativo.contas.length > 0 && (
        <div className="small border-top pt-2">
          <div className="fw-semibold mb-1">Contas que ficam negativas</div>
          <p className="text-muted mb-1">Dinheiro em outra conta não paga o débito desta — vale transferir antes.</p>
          {saldo_negativo.contas.map((c) => (
            <div key={c.conta_id}>
              <i className="bi bi-bank me-1"></i>
              {c.conta}: a partir de {formatarDataBR(c.data)}, chegando a {brl(c.menor_saldo)}
            </div>
          ))}
        </div>
      )}
    </Secao>
  );
}

// -=-=-=- RECEITAS INCERTAS -=-=-=-

function ReceitasIncertas({ relatorio }: { relatorio: RelatorioSimulador }) {
  const r = relatorio.riscos.receitas_incertas;
  return (
    <Secao
      titulo="Dependência de receitas incertas"
      icone="bi-question-diamond"
      ajuda="Compara a simulação com a mesma simulação sem nenhuma receita estimada (só as confirmadas e as recorrentes cadastradas)."
    >
      {r.estimadas <= 0 ? (
        <p className="small text-muted mb-0">
          <i className="bi bi-check-circle text-success me-1"></i>Todas as receitas consideradas estão confirmadas ou são recorrentes cadastradas.
        </p>
      ) : (
        <>
          <p className="small mb-2">
            <strong>{brl(r.estimadas)}</strong> ({pct(r.percentual)}) das receitas do período são estimativas pelo histórico.
          </p>
          <div className="d-flex flex-wrap gap-4 small mb-2">
            <div>
              <div className="text-muted">Saldo final sem elas</div>
              <div className={`fw-semibold ${r.saldo_final_sem_elas < 0 ? "text-danger" : ""}`}>{brl(r.saldo_final_sem_elas)}</div>
            </div>
            <div>
              <div className="text-muted">Menor saldo sem elas</div>
              <div className={`fw-semibold ${r.menor_saldo_sem_elas < 0 ? "text-danger" : ""}`}>{brl(r.menor_saldo_sem_elas)}</div>
            </div>
          </div>
          {r.alerta ? (
            <div className="alert alert-warning small py-2 mb-0">
              <i className="bi bi-exclamation-triangle-fill me-1"></i>
              O saldo só se mantém positivo se essas receitas incertas se confirmarem.
            </div>
          ) : (
            <div className="small text-success">
              <i className="bi bi-check-circle-fill me-1"></i>Mesmo sem elas o saldo não fica negativo.
            </div>
          )}
        </>
      )}
    </Secao>
  );
}

// -=-=-=- GRÁFICO 8: CALENDÁRIO DE RISCO -=-=-=-

type Zona = "NEGATIVO" | "ZERO" | "REDUZIDO" | "CONFORTAVEL";

const ZONAS: Record<Zona, { rotulo: string; fundo: string; texto: string; icone: string }> = {
  CONFORTAVEL: { rotulo: "Confortável", fundo: "#d1e7dd", texto: "#0a3622", icone: "bi-check-circle" },
  REDUZIDO: { rotulo: "Reduzido", fundo: "#fff3cd", texto: "#664d03", icone: "bi-dash-circle" },
  ZERO: { rotulo: "Próximo de zero", fundo: "#ffd8b8", texto: "#6a2c00", icone: "bi-exclamation-circle" },
  NEGATIVO: { rotulo: "Negativo", fundo: "#f1aeb5", texto: "#58151c", icone: "bi-x-octagon" },
};

function CalendarioRisco({ relatorio }: { relatorio: RelatorioSimulador }) {
  const meses = relatorio.periodo.meses;
  const cenario = relatorio.cenarios.personalizado;
  const despesaMedia = cenario.meses.length ? cenario.meses.reduce((s, m) => s + m.despesas.total, 0) / cenario.meses.length : 0;

  // Critério padrão explícito: "reduzido" = menos de meio mês de despesas; "próximo de zero" = menos de 10%.
  const [limiteReduzido, setLimiteReduzido] = useState(() => Math.round(despesaMedia * 0.5));
  const [limiteZero, setLimiteZero] = useState(() => Math.round(despesaMedia * 0.1));
  const [indiceMes, setIndiceMes] = useState(0);
  const [dia, setDia] = useState<string | null>(null);

  const diario = useMemo(
    () => new Map(expandirDiario(cenario.serie_diaria, relatorio.periodo.data_inicial, relatorio.periodo.data_final).map((p) => [p.data, p.saldo])),
    [cenario, relatorio.periodo]
  );

  const mes = meses[Math.min(indiceMes, meses.length - 1)];
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const deslocamento = new Date(ano, m - 1, 1).getDay();

  const zona = (saldo: number): Zona =>
    saldo < 0 ? "NEGATIVO" : saldo < limiteZero ? "ZERO" : saldo < limiteReduzido ? "REDUZIDO" : "CONFORTAVEL";

  const contagem: Record<Zona, number> = { NEGATIVO: 0, ZERO: 0, REDUZIDO: 0, CONFORTAVEL: 0 };
  diario.forEach((saldo, data) => {
    if (data.startsWith(mes)) contagem[zona(saldo)]++;
  });

  const eventosDoDia = dia ? relatorio.eventos.filter((e) => e.data === dia) : [];

  return (
    <Secao
      titulo="Calendário de risco"
      icone="bi-calendar3"
      acoes={
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={indiceMes === 0} onClick={() => setIndiceMes((i) => i - 1)} aria-label="Mês anterior">
            <i className="bi bi-chevron-left"></i>
          </button>
          <span className="fw-semibold small text-nowrap" style={{ minWidth: 140, textAlign: "center" }}>
            {nomeMes(mes)}
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={indiceMes >= meses.length - 1} onClick={() => setIndiceMes((i) => i + 1)} aria-label="Próximo mês">
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      }
    >
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="d-grid text-center small" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
              <div key={d} className="text-muted">
                {d}
              </div>
            ))}
            {Array.from({ length: deslocamento }).map((_, i) => (
              <div key={`v${i}`} />
            ))}
            {Array.from({ length: diasNoMes }).map((_, i) => {
              const iso = `${mes}-${String(i + 1).padStart(2, "0")}`;
              const saldo = diario.get(iso);
              if (saldo === undefined) {
                return (
                  <div key={iso} className="rounded p-1 text-muted bg-light" style={{ minHeight: 52, opacity: 0.5 }}>
                    {i + 1}
                  </div>
                );
              }
              const z = ZONAS[zona(saldo)];
              const temEventos = relatorio.eventos.some((e) => e.data === iso);
              return (
                <button
                  key={iso}
                  type="button"
                  className={`btn btn-sm rounded p-1 border-0 ${dia === iso ? "shadow" : ""}`}
                  style={{ minHeight: 52, background: z.fundo, color: z.texto, outline: dia === iso ? "2px solid #0d6efd" : undefined }}
                  title={`${formatarDataBR(iso)} · ${z.rotulo}: ${brl(saldo)}`}
                  onClick={() => setDia(iso)}
                >
                  <div className="fw-semibold">
                    {i + 1}
                    {temEventos && <span className="ms-1">•</span>}
                  </div>
                  <div style={{ fontSize: 10 }}>{compacto(saldo)}</div>
                </button>
              );
            })}
          </div>
          <div className="d-flex flex-wrap gap-3 mt-3 small">
            {(Object.keys(ZONAS) as Zona[]).map((z) => (
              <span key={z} className="d-flex align-items-center gap-1">
                <span className="rounded d-inline-block" style={{ width: 12, height: 12, background: ZONAS[z].fundo }} />
                <i className={`bi ${ZONAS[z].icone}`}></i>
                {ZONAS[z].rotulo} ({contagem[z]})
              </span>
            ))}
          </div>
        </div>

        <div className="col-12 col-lg-5">
          <div className="border rounded p-2 mb-3 small">
            <div className="fw-semibold mb-2">Critérios (saldo ao fim do dia)</div>
            <label className="d-flex justify-content-between align-items-center gap-2 mb-2">
              <span>Reduzido abaixo de</span>
              <input type="number" min={0} className="form-control form-control-sm w-50" value={limiteReduzido} onChange={(e) => setLimiteReduzido(Number(e.target.value) || 0)} />
            </label>
            <label className="d-flex justify-content-between align-items-center gap-2 mb-1">
              <span>Próximo de zero abaixo de</span>
              <input type="number" min={0} className="form-control form-control-sm w-50" value={limiteZero} onChange={(e) => setLimiteZero(Number(e.target.value) || 0)} />
            </label>
            <div className="text-muted">Padrão: metade e 10% da despesa média mensal prevista ({brl(despesaMedia)}).</div>
          </div>

          {dia ? (
            <div className="small">
              <div className="fw-semibold mb-1">
                {formatarDataBR(dia)} ({diaDaSemana(dia)}) · saldo ao fim do dia: {brl(diario.get(dia) ?? 0)}
              </div>
              {eventosDoDia.length === 0 ? (
                <div className="text-muted">Nenhuma movimentação prevista neste dia.</div>
              ) : (
                <ul className="list-unstyled mb-0">
                  {eventosDoDia.map((e) => (
                    <li key={e.id} className="d-flex justify-content-between gap-2 py-1 border-bottom">
                      <span>
                        <BadgeNatureza natureza={e.natureza} /> <span className="ms-1">{e.descricao}</span>
                      </span>
                      <span className={`text-nowrap ${e.tipo === "INCOME" ? "text-success" : "text-danger"}`}>
                        {e.valor === null ? "sem valor" : brlSinal(e.tipo === "INCOME" ? e.valor : -e.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="text-muted small">Clique num dia para ver o que entra e sai.</div>
          )}
        </div>
      </div>
    </Secao>
  );
}

// -=-=-=- COMPROMETIMENTO -=-=-=-

function Comprometimento({ relatorio }: { relatorio: RelatorioSimulador }) {
  const dados = relatorio.riscos.comprometimento.map((c) => ({
    ...c,
    rotulo: mesCurto(c.mes),
    confirmado: c.confirmado_pct ?? 0,
    adicional: Math.max(0, (c.total_pct ?? 0) - (c.confirmado_pct ?? 0)),
  }));
  const alertas = relatorio.riscos.comprometimento.filter((c) => c.nivel !== "OK");

  return (
    <Secao
      titulo="Comprometimento da renda"
      icone="bi-speedometer2"
      ajuda="Despesas do mês ÷ receitas do mês. A parte escura considera só despesas conhecidas (cadastradas e recorrências); a clara soma as estimativas. Meses a partir de 85% são sinalizados."
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={44} />
          <ReferenceLine y={100} stroke={COR.despesa} strokeDasharray="4 4" />
          <Tooltip
            cursor={{ fill: "rgba(13,110,253,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof dados)[number];
              return (
                <CaixaTooltip titulo={nomeMes(d.mes)}>
                  <Marcador cor="#b02a37" texto={`Confirmado: ${pct(d.confirmado_pct)}`} />
                  <Marcador cor="#ec8b95" texto={`Total com estimativas: ${pct(d.total_pct)}`} />
                  <div className="text-muted small">
                    {brl(d.despesas)} de despesas para {brl(d.receitas)} de receitas
                  </div>
                </CaixaTooltip>
              );
            }}
          />
          <Legend verticalAlign="top" height={40} formatter={formatoLegenda} iconType="square" iconSize={10} />
          <Bar dataKey="confirmado" name="Confirmado" stackId="c" fill="#b02a37" maxBarSize={32} isAnimationActive={false} />
          <Bar dataKey="adicional" name="Com estimativas" stackId="c" fill="#ec8b95" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {alertas.length > 0 && (
        <ul className="small mb-0 mt-2 ps-3">
          {alertas.map((a) => (
            <li key={a.mes} className={a.nivel === "ALTO" ? "text-warning-emphasis" : "text-danger"}>
              {nomeMes(a.mes)}:{" "}
              {a.nivel === "SEM_RECEITA"
                ? "há despesas sem nenhuma receita prevista no mês."
                : a.nivel === "EXCEDE"
                  ? `despesas superam as receitas (${pct(a.total_pct)}).`
                  : `${pct(a.total_pct)} da renda comprometida.`}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

// -=-=-=- MESES ATÍPICOS -=-=-=-

function MesesAtipicos({ relatorio }: { relatorio: RelatorioSimulador }) {
  const meses = relatorio.riscos.meses_atipicos;
  return (
    <Secao titulo="Meses atípicos" icone="bi-calendar-event" ajuda="Meses previstos com despesas ao menos 25% acima da mediana dos meses do período (anuidades, IPVA, concentração de faturas...).">
      {meses.length === 0 ? (
        <p className="small text-muted mb-0">
          <i className="bi bi-check-circle text-success me-1"></i>Nenhum mês com despesas fora do padrão do período.
        </p>
      ) : (
        meses.map((m) => (
          <div key={m.mes} className="small mb-3">
            <div className="fw-semibold">
              {nomeMes(m.mes)} · {brl(m.despesas)} <span className="text-danger">(+{brl(m.excesso)} acima do usual)</span>
            </div>
            <ul className="list-unstyled text-muted mb-0">
              {m.principais.map((p, i) => (
                <li key={i}>
                  {p.descricao} — {brl(p.valor)} em {formatarDataBR(p.data)}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Secao>
  );
}

// -=-=-=- GRÁFICO 10: SENSIBILIDADE -=-=-=-

function Sensibilidade({ relatorio, onAplicarAjuste }: Props) {
  const itens = relatorio.sensibilidade;
  const dados = itens.map((s) => ({ ...s, impacto: s.impacto_saldo_final }));

  return (
    <Secao
      titulo="Sensibilidade da projeção"
      icone="bi-sliders"
      ajuda="Cada barra é uma simulação completa da previsão automática com uma única variação — com datas, faturas e reconciliação — e mostra o efeito no saldo final. Só aparecem variáveis que existem nos seus dados."
    >
      {itens.length === 0 ? (
        <p className="small text-muted mb-0">Sem estimativas suficientes para medir sensibilidade — a projeção usa só compromissos cadastrados.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(160, itens.length * 34)}>
            <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} horizontal={false} />
              <XAxis type="number" tickFormatter={compacto} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="rotulo" width={210} tick={{ fontSize: 11 }} />
              <ReferenceLine x={0} stroke={COR.neutro} />
              <Tooltip
                cursor={{ fill: "rgba(13,110,253,0.05)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof dados)[number];
                  return (
                    <CaixaTooltip titulo={d.rotulo}>
                      <div className="small">Saldo final: {brlSinal(d.impacto_saldo_final)}</div>
                      <div className="small text-muted">Menor saldo: {brlSinal(d.impacto_menor_saldo)}</div>
                    </CaixaTooltip>
                  );
                }}
              />
              <Bar dataKey="impacto" radius={4} maxBarSize={20} isAnimationActive={false}>
                {dados.map((d) => (
                  <Cell key={d.id} fill={d.impacto >= 0 ? COR.receita : COR.despesa} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="d-flex flex-wrap gap-2 mt-2">
            {itens.map((s) => (
              <button key={s.id} type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAplicarAjuste({ ...s.ajuste, id: `sens:${s.id}` })}>
                <i className="bi bi-plus-lg me-1"></i>
                {s.rotulo}
              </button>
            ))}
          </div>
          <div className="text-muted small mt-2">Clique para aplicar a variação na sua simulação.</div>
        </>
      )}
    </Secao>
  );
}
