import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatoLegenda } from "../legenda";
import type { EventoSimulacao, RelatorioSimulador } from "../../../../types/simulador";
import { BadgeNatureza, CaixaTooltip, Marcador, Secao, Vazio } from "../ui";
import { COR, brl, compacto, formatarDataBR, formatarDiaMes, mesCurto, nomeMes } from "../utils";

const COR_CONHECIDO = "#0d6efd";
const COR_ESTIMADO = "#8db8f9";

export function AbaCartoes({ relatorio }: { relatorio: RelatorioSimulador }) {
  const faturas = useMemo(() => relatorio.eventos.filter((e) => e.natureza === "FATURA" && e.fatura), [relatorio]);
  const cartoes = useMemo(() => {
    const mapa = new Map<number, string>();
    faturas.forEach((f) => mapa.set(f.fatura!.cartao_id, f.fatura!.cartao));
    return [...mapa.entries()];
  }, [faturas]);
  const [cartaoId, setCartaoId] = useState<number | "TODOS">("TODOS");
  const [aberta, setAberta] = useState<string | null>(null);

  const filtradas = faturas.filter((f) => cartaoId === "TODOS" || f.fatura!.cartao_id === cartaoId);

  const dados = useMemo(() => {
    const porMes = new Map<string, { mes: string; rotulo: string; conhecido: number; estimado: number; hipotetico: number }>();
    relatorio.periodo.meses.forEach((m) => porMes.set(m, { mes: m, rotulo: mesCurto(m), conhecido: 0, estimado: 0, hipotetico: 0 }));
    filtradas.forEach((f) => {
      const linha = porMes.get(f.data.slice(0, 7));
      if (!linha || !f.composicao) return;
      linha.conhecido += f.composicao.conhecido;
      linha.estimado += f.composicao.estimado;
      linha.hipotetico += f.composicao.hipotetico;
    });
    return [...porMes.values()];
  }, [filtradas, relatorio.periodo.meses]);

  if (!faturas.length) {
    return <Vazio icone="bi-credit-card" texto="Nenhuma fatura de cartão prevista no período para os filtros selecionados." />;
  }

  const temSimulado = dados.some((d) => d.hipotetico > 0);

  return (
    <div className="row g-4">
      <div className="col-12">
        <Secao
          titulo="Evolução das faturas"
          icone="bi-credit-card-2-front"
          acoes={
            <select
              className="form-select form-select-sm w-auto"
              value={cartaoId}
              onChange={(e) => setCartaoId(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}
              aria-label="Cartão"
            >
              <option value="TODOS">Todos os cartões</option>
              {cartoes.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          }
          rodape="Cada fatura vence no mês em que aparece. Compras estimadas entram no ciclo pela data prevista da compra e pela regra de fechamento do cartão; faturas já fechadas não recebem compras novas."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 11 }} width={56} />
              <Tooltip
                cursor={{ fill: "rgba(13,110,253,0.05)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as (typeof dados)[number];
                  return (
                    <CaixaTooltip titulo={`Faturas que vencem em ${nomeMes(d.mes)}`} largura={250}>
                      <Marcador cor={COR_CONHECIDO} texto={`Compras e parcelas conhecidas: ${brl(d.conhecido)}`} />
                      <Marcador cor={COR_ESTIMADO} texto={`Compras futuras estimadas: ${brl(d.estimado)}`} />
                      {d.hipotetico > 0 && <Marcador cor={COR.hipotetico} texto={`Simuladas: ${brl(d.hipotetico)}`} />}
                      <div className="small fw-semibold mt-1">Total previsto: {brl(d.conhecido + d.estimado + d.hipotetico)}</div>
                    </CaixaTooltip>
                  );
                }}
              />
              <Legend verticalAlign="top" height={40} formatter={formatoLegenda} iconType="square" iconSize={10} />
              <Bar dataKey="conhecido" name="Conhecido" stackId="f" fill={COR_CONHECIDO} maxBarSize={36} isAnimationActive={false} />
              <Bar dataKey="estimado" name="Estimado" stackId="f" fill={COR_ESTIMADO} maxBarSize={36} isAnimationActive={false} radius={temSimulado ? undefined : [4, 4, 0, 0]} />
              {temSimulado && <Bar dataKey="hipotetico" name="Simulado" stackId="f" fill={COR.hipotetico} maxBarSize={36} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
            </BarChart>
          </ResponsiveContainer>
        </Secao>
      </div>

      <div className="col-12">
        <Secao titulo="Faturas previstas" icone="bi-receipt">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Cartão</th>
                  <th>Vencimento</th>
                  <th>Fechamento</th>
                  <th className="text-end">Conhecido</th>
                  <th className="text-end">Estimado</th>
                  <th className="text-end">Simulado</th>
                  <th className="text-end">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => (
                  <Fragment key={f.id}>
                    <tr role="button" onClick={() => setAberta(aberta === f.id ? null : f.id)}>
                      <td className="fw-semibold">{f.fatura!.cartao}</td>
                      <td className="text-nowrap">
                        {formatarDataBR(f.fatura!.vencimento)}
                        {f.atrasado && <span className="badge text-bg-danger ms-2">Vencida</span>}
                        {!f.fatura!.id && <span className="badge text-bg-light border ms-2" title="Ainda não existe no sistema">Futura</span>}
                      </td>
                      <td className="text-nowrap text-muted">{formatarDataBR(f.fatura!.fechamento)}</td>
                      <td className="text-end">{brl(f.composicao!.conhecido)}</td>
                      <td className="text-end text-primary">{f.composicao!.estimado ? brl(f.composicao!.estimado) : "—"}</td>
                      <td className="text-end" style={{ color: COR.hipotetico }}>{f.composicao!.hipotetico ? brl(f.composicao!.hipotetico) : "—"}</td>
                      <td className="text-end fw-semibold">{brl(f.valor ?? 0)}</td>
                      <td className="text-end">
                        <i className={`bi ${aberta === f.id ? "bi-chevron-up" : "bi-chevron-down"}`}></i>
                      </td>
                    </tr>
                    {aberta === f.id && (
                      <tr>
                        <td colSpan={8} className="bg-light">
                          <ItensFatura fatura={f} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Secao>
      </div>
    </div>
  );
}

function ItensFatura({ fatura }: { fatura: EventoSimulacao }) {
  return (
    <ul className="list-unstyled mb-0">
      {(fatura.itens ?? []).map((item, i) => (
        <li key={i} className="d-flex flex-wrap justify-content-between gap-2 py-1 border-bottom">
          <span>
            <BadgeNatureza natureza={item.natureza} />
            <span className="ms-2">{item.descricao}</span>
            {item.parcela && <span className="text-muted ms-1">({item.parcela})</span>}
            {item.categoria && <span className="text-muted ms-2">· {item.categoria}</span>}
            {item.data_compra && <span className="text-muted ms-2">· compra {item.natureza === "ESTIMADO" ? "prevista para" : "em"} {formatarDiaMes(item.data_compra)}</span>}
          </span>
          <span className="fw-semibold">{item.valor === null ? <span className="text-muted">sem valor</span> : brl(item.valor)}</span>
        </li>
      ))}
    </ul>
  );
}
