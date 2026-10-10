import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoriaMes, CategoriaSimulador, RelatorioSimulador, TipoLancamento } from "../../../../types/simulador";
import { Alternador, BadgeConfianca, CaixaTooltip, Marcador, Secao, Vazio } from "../ui";
import { COR, COR_OUTRAS, brl, compacto, mesCurto, nomeMes, pct } from "../utils";

const MAX_FATIAS = 7;
const CHAVE_OUTRAS = "__outras";

type Fatia = { chave: string; nome: string; total: number; conhecido: number; estimado: number; hipotetico: number; cor: string };

function agrupar(categorias: CategoriaMes[], cores: Record<string, string>): Fatia[] {
  const fatias = categorias
    .map((c) => ({
      chave: c.chave,
      nome: c.categoria,
      total: c.total,
      conhecido: c.meses.reduce((s, m) => s + m.conhecido, 0),
      estimado: c.meses.reduce((s, m) => s + m.estimado, 0),
      hipotetico: c.meses.reduce((s, m) => s + m.hipotetico, 0),
      cor: cores[c.chave] ?? COR_OUTRAS,
    }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);

  // Só categorias com cor própria ficam separadas; o resto vira "Outras" (nunca uma 9ª cor gerada).
  const proprias = fatias.filter((f) => f.cor !== COR_OUTRAS).slice(0, MAX_FATIAS);
  const resto = fatias.filter((f) => !proprias.includes(f));
  if (resto.length) {
    proprias.push({
      chave: CHAVE_OUTRAS,
      nome: `Outras (${resto.length})`,
      total: resto.reduce((s, f) => s + f.total, 0),
      conhecido: resto.reduce((s, f) => s + f.conhecido, 0),
      estimado: resto.reduce((s, f) => s + f.estimado, 0),
      hipotetico: resto.reduce((s, f) => s + f.hipotetico, 0),
      cor: COR_OUTRAS,
    });
  }
  return proprias;
}

// -=-=-=- GRÁFICO 3: COMPOSIÇÃO DAS DESPESAS -=-=-=-

export function GraficoComposicaoCategorias({
  relatorio,
  cores,
  onAbrirCategoria,
}: {
  relatorio: RelatorioSimulador;
  cores: Record<string, string>;
  onAbrirCategoria: (chave: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("EXPENSE");
  const fatias = useMemo(() => agrupar(relatorio.categorias_mes.filter((c) => c.tipo === tipo), cores), [relatorio, tipo, cores]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const total = fatias.reduce((s, f) => s + f.total, 0);
  const atual = fatias.find((f) => f.chave === selecionada) ?? fatias[0];
  const modelo: CategoriaSimulador | undefined = relatorio.categorias.find((c) => c.chave === atual?.chave);

  return (
    <Secao
      titulo={tipo === "EXPENSE" ? "Composição das despesas futuras" : "Composição das receitas futuras"}
      icone="bi-pie-chart"
      acoes={
        <Alternador
          rotulo="Tipo"
          valor={tipo}
          onChange={(t) => {
            setTipo(t);
            setSelecionada(null);
          }}
          opcoes={[
            { valor: "EXPENSE", label: "Despesas" },
            { valor: "INCOME", label: "Receitas" },
          ]}
        />
      }
      rodape="Pela data em que o dinheiro sai: compras no cartão contam no vencimento da fatura. Clique numa categoria para ver o detalhe."
    >
      {!fatias.length ? (
        <Vazio icone="bi-pie-chart" texto="Nada previsto para o período." />
      ) : (
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="total"
                  nameKey="nome"
                  innerRadius="58%"
                  outerRadius="92%"
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                  onClick={(_, i) => setSelecionada(fatias[i].chave)}
                  cursor="pointer"
                >
                  {fatias.map((f) => (
                    <Cell key={f.chave} fill={f.cor} opacity={atual && atual.chave !== f.chave ? 0.45 : 1} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const f = payload[0].payload as Fatia;
                    return (
                      <CaixaTooltip titulo={f.nome}>
                        <div className="small">
                          {brl(f.total)} · {pct((f.total / total) * 100)}
                        </div>
                      </CaixaTooltip>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="col-12 col-md-7">
            <ul className="list-unstyled small mb-3">
              {fatias.map((f) => (
                <li key={f.chave}>
                  <button
                    type="button"
                    className={`btn btn-sm w-100 d-flex justify-content-between align-items-center text-start py-1 ${atual?.chave === f.chave ? "btn-light border" : "btn-link text-body text-decoration-none"}`}
                    onClick={() => setSelecionada(f.chave)}
                  >
                    <Marcador cor={f.cor} texto={f.nome} />
                    <span className="text-nowrap">
                      {brl(f.total)} <span className="text-muted">· {pct((f.total / total) * 100, 0)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {atual && (
              <div className="border rounded p-2 small">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <strong>{atual.nome}</strong>
                  {modelo && <BadgeConfianca nivel={modelo.status === "PROJETADA" ? modelo.confianca : modelo.status} />}
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <span>Cadastrado: {brl(atual.conhecido)}</span>
                  <span>Previsto a mais: {brl(atual.estimado)}</span>
                  {atual.hipotetico > 0 && <span>Simulado: {brl(atual.hipotetico)}</span>}
                </div>
                {modelo?.metodo_rotulo && <div className="text-muted mt-1">Método: {modelo.metodo_rotulo}</div>}
                {modelo && (
                  <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={() => onAbrirCategoria(modelo.chave)}>
                    <i className="bi bi-search me-1"></i>Como foi calculado / ajustar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Secao>
  );
}

// -=-=-=- GRÁFICO 5: EVOLUÇÃO DAS CATEGORIAS -=-=-=-

export function GraficoEvolucaoCategorias({ relatorio, cores }: { relatorio: RelatorioSimulador; cores: Record<string, string> }) {
  const [tipo, setTipo] = useState<TipoLancamento>("EXPENSE");
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const categorias = relatorio.categorias_mes.filter((c) => c.tipo === tipo);
  const fatias = useMemo(() => agrupar(categorias, cores), [categorias, cores]);
  const proprias = new Set(fatias.map((f) => f.chave));

  const dados = useMemo(
    () =>
      relatorio.periodo.meses.map((mes) => {
        const linha: Record<string, number | string> = { mes, rotulo: mesCurto(mes) };
        categorias.forEach((c) => {
          const m = c.meses.find((x) => x.mes === mes);
          const valor = m ? m.conhecido + m.estimado + m.hipotetico : 0;
          const chave = proprias.has(c.chave) ? c.chave : CHAVE_OUTRAS;
          linha[chave] = Math.round(((linha[chave] as number | undefined ?? 0) + valor) * 100) / 100;
        });
        return linha;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relatorio, tipo, fatias]
  );

  const visiveis = fatias.filter((f) => !ocultas.has(f.chave));
  const alternar = (chave: string) =>
    setOcultas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  return (
    <Secao
      titulo="Evolução por categoria"
      icone="bi-bar-chart-line"
      acoes={
        <Alternador
          rotulo="Tipo"
          valor={tipo}
          onChange={(t) => {
            setTipo(t);
            setOcultas(new Set());
          }}
          opcoes={[
            { valor: "EXPENSE", label: "Despesas" },
            { valor: "INCOME", label: "Receitas" },
          ]}
        />
      }
      rodape="Conhecido + previsto + simulado de cada categoria, mês a mês. Clique numa categoria para mostrar ou ocultar."
    >
      <div className="d-flex flex-wrap gap-2 mb-3">
        {fatias.map((f) => (
          <button
            key={f.chave}
            type="button"
            className={`btn btn-sm border ${ocultas.has(f.chave) ? "btn-outline-light text-muted" : "btn-light"}`}
            aria-pressed={!ocultas.has(f.chave)}
            onClick={() => alternar(f.chave)}
          >
            <span className="d-inline-block rounded me-2 align-middle" style={{ width: 10, height: 10, background: f.cor, opacity: ocultas.has(f.chave) ? 0.3 : 1 }} />
            {f.nome}
          </button>
        ))}
      </div>
      {!fatias.length ? (
        <Vazio texto="Nada previsto para o período." />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
            <Tooltip
              cursor={{ fill: "rgba(13,110,253,0.05)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const linha = payload[0].payload as Record<string, number | string>;
                return (
                  <CaixaTooltip titulo={nomeMes(linha.mes as string)} largura={230}>
                    {[...visiveis].reverse().map((f) => (
                      <Marcador key={f.chave} cor={f.cor} texto={`${f.nome}: ${brl((linha[f.chave] as number) ?? 0)}`} />
                    ))}
                  </CaixaTooltip>
                );
              }}
            />
            {visiveis.map((f, i) => (
              <Bar
                key={f.chave}
                dataKey={f.chave}
                name={f.nome}
                stackId="c"
                fill={f.cor}
                stroke="#fff"
                strokeWidth={1}
                radius={i === visiveis.length - 1 ? [4, 4, 0, 0] : undefined}
                maxBarSize={36}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Secao>
  );
}
