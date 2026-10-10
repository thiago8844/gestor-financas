import { Offcanvas } from "react-bootstrap";
import { Bar, CartesianGrid, Cell, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoriaSimulador, CenarioConfig } from "../../../types/simulador";
import type { AcoesCenario } from "./useCenario";
import { BadgeConfianca, CaixaTooltip, Marcador } from "./ui";
import {
  COR,
  LABEL_PADRAO_MES,
  LABEL_TENDENCIA,
  ajusteDaCategoria,
  brl,
  compacto,
  formatarDataBR,
  idAjusteCategoria,
  mesCurto,
  nomeMes,
  pct,
} from "./utils";
import { SliderPercentual } from "./simulacoes/ControlesCenario";

type Props = {
  categoria: CategoriaSimulador | null;
  cenario: CenarioConfig;
  acoes: AcoesCenario;
  onFechar: () => void;
};

/**
 * Explicação auditável de uma previsão: de onde veio o número, com que método, quanto já está
 * cadastrado e quanto é adicional — e o atalho para ajustar.
 */
export function PainelCategoria({ categoria: c, cenario, acoes, onFechar }: Props) {
  if (!c) return null;

  const e = c.estatisticas;
  const despesa = c.tipo === "EXPENSE";
  const corTipo = despesa ? COR.despesa : COR.receita;
  const ajuste = ajusteDaCategoria(cenario, c.chave);
  const proximo = c.projecao.find((p) => p.automatico > 0 || p.conhecido > 0) ?? c.projecao[0];
  const historico = c.historico.map((h) => ({ ...h, rotulo: mesCurto(h.mes) }));

  return (
    <Offcanvas show onHide={onFechar} placement="end" style={{ width: 520, maxWidth: "100vw" }}>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h5">
          {c.categoria}
          <div className="small text-muted fw-normal">{despesa ? "Despesa" : "Receita"} · como a previsão foi calculada</div>
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="small">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <BadgeConfianca nivel={c.status === "PROJETADA" ? c.confianca : c.status} />
          {c.metodo_rotulo && <span className="badge text-bg-light border fw-normal">{c.metodo_rotulo}</span>}
          {!c.projetada && c.status === "PROJETADA" && <span className="badge text-bg-secondary fw-normal">Estimativa desligada nos filtros</span>}
        </div>

        {c.motivo && (
          <div className="alert alert-secondary py-2">
            <i className="bi bi-info-circle me-1"></i>
            {c.motivo}
          </div>
        )}

        <h6 className="fw-bold mt-3">Histórico mensal</h6>
        {historico.length === 0 ? (
          <p className="text-muted">Sem meses completos de histórico.</p>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={historico} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COR.grade} vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} minTickGap={4} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 10 }} width={44} />
              {c.estimativa_mensal !== null && <ReferenceLine y={c.estimativa_mensal} stroke={COR.saldo} strokeDasharray="4 4" />}
              <Tooltip
                cursor={{ fill: "rgba(13,110,253,0.05)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const h = payload[0].payload as (typeof historico)[number];
                  return (
                    <CaixaTooltip titulo={nomeMes(h.mes)}>
                      <Marcador cor={corTipo} texto={`Rotina: ${brl(h.valor)}`} />
                      {h.atipico && <div className="text-warning-emphasis small">Mês atípico: descartado do valor típico</div>}
                      {h.extraordinario > 0 && <div className="small">+ {brl(h.extraordinario)} extraordinário (fora da previsão)</div>}
                    </CaixaTooltip>
                  );
                }}
              />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {historico.map((h) => (
                  <Cell key={h.mes} fill={corTipo} fillOpacity={h.atipico ? 0.35 : 0.85} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {c.estimativa_mensal !== null && <div className="text-muted">A linha tracejada é a previsão mensal automática. Barras claras são meses atípicos.</div>}

        {e && (
          <table className="table table-sm mt-3 mb-0">
            <tbody>
              <tr>
                <td className="text-muted">Período analisado</td>
                <td className="text-end">
                  {e.meses} meses ({e.meses_com_valor} com lançamentos · {pct(e.frequencia * 100, 0)})
                </td>
              </tr>
              <tr>
                <td className="text-muted">Média mensal histórica</td>
                <td className="text-end">{brl(e.media)}</td>
              </tr>
              <tr>
                <td className="text-muted">Mediana mensal</td>
                <td className="text-end">{brl(e.mediana)}</td>
              </tr>
              {e.valor_tipico !== null && (
                <tr>
                  <td className="text-muted">Valor típico nos meses com gasto</td>
                  <td className="text-end">{brl(e.valor_tipico)}</td>
                </tr>
              )}
              <tr>
                <td className="text-muted">Menor / maior mês</td>
                <td className="text-end">
                  {brl(e.minimo)} / {brl(e.maximo)}
                </td>
              </tr>
              {e.coeficiente_variacao !== null && (
                <tr>
                  <td className="text-muted">Variação entre meses (CV)</td>
                  <td className="text-end">{pct(e.coeficiente_variacao * 100, 0)}</td>
                </tr>
              )}
              {e.tendencia && (
                <tr>
                  <td className="text-muted">Tendência recente</td>
                  <td className="text-end">
                    {LABEL_TENDENCIA[e.tendencia.classificacao]} ({e.tendencia.variacao_mensal_pct > 0 ? "+" : ""}
                    {pct(e.tendencia.variacao_mensal_pct)} ao mês)
                  </td>
                </tr>
              )}
              {c.perfil && (
                <tr>
                  <td className="text-muted">Quando acontece</td>
                  <td className="text-end">{LABEL_PADRAO_MES[c.perfil.padrao]}</td>
                </tr>
              )}
              {c.canais.length > 0 && (
                <tr>
                  <td className="text-muted">Meio de pagamento habitual</td>
                  <td className="text-end">{c.canais.map((k) => `${k.nome} ${pct(k.participacao * 100, 0)}`).join(" · ")}</td>
                </tr>
              )}
              {c.estimativa_mensal !== null && (
                <tr>
                  <td className="text-muted fw-semibold">Previsão mensal</td>
                  <td className="text-end fw-semibold">
                    {brl(c.estimativa_mensal)} {c.desvio ? <span className="text-muted fw-normal">± {brl(c.desvio)}</span> : null}
                  </td>
                </tr>
              )}
              {c.validacao && (
                <tr>
                  <td className="text-muted">Teste no passado</td>
                  <td className="text-end">
                    erro médio de {brl(c.validacao.mae)} nos últimos {c.validacao.meses} meses
                    {c.validacao.wape !== null && ` (${pct(c.validacao.wape * 100, 0)})`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {c.validacao && Object.keys(c.validacao.metodos).length > 1 && (
          <details className="mt-2">
            <summary className="text-muted">Comparação dos métodos testados</summary>
            <p className="text-muted mb-1 mt-1">
              Cada método previu cada um dos últimos {c.validacao.meses} meses usando só os meses anteriores. O padrão só é trocado por outro que erre ao menos 10% menos.
            </p>
            <ul className="mb-0">
              {Object.entries(c.validacao.metodos)
                .sort((a, b) => a[1] - b[1])
                .map(([metodo, erro]) => (
                  <li key={metodo} className={metodo === c.metodo ? "fw-semibold" : ""}>
                    {metodo.replace(/_/g, " ")}: erro médio {brl(erro)}
                    {metodo === c.metodo && " ← escolhido"}
                  </li>
                ))}
            </ul>
          </details>
        )}

        {c.extraordinarios.length > 0 && (
          <div className="alert alert-light border mt-3 mb-0 py-2">
            <div className="fw-semibold mb-1">
              <i className="bi bi-stars me-1"></i>Valores extraordinários fora da previsão
            </div>
            <div className="text-muted mb-1">
              Valores isolados muito acima do padrão (herança, venda de um bem, compra de um carro...). Não se espera que se repitam
              {despesa ? "" : " — a simulação não conta com esse dinheiro de novo"}.
            </div>
            <ul className="mb-0">
              {c.extraordinarios.map((x, i) => (
                <li key={i}>
                  {x.descricao}: {brl(x.valor)} em {formatarDataBR(x.data)}
                  {x.futuro && " (já cadastrado: entra no caixa normalmente)"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.projecao.length > 0 && (
          <>
            <h6 className="fw-bold mt-4">Mês a mês (pela data da compra)</h6>
            <table className="table table-sm mb-1">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="text-end">Previsto</th>
                  <th className="text-end">Já cadastrado</th>
                  <th className="text-end">Adicional</th>
                  {ajuste && <th className="text-end text-primary">Simulação</th>}
                </tr>
              </thead>
              <tbody>
                {c.projecao.map((p) => (
                  <tr key={p.mes}>
                    <td>{mesCurto(p.mes)}</td>
                    <td className="text-end">{brl(p.automatico)}</td>
                    <td className="text-end">{brl(p.conhecido)}</td>
                    <td className="text-end fw-semibold">{brl(p.adicional_base)}</td>
                    {ajuste && <td className="text-end text-primary">{brl(p.adicional_cenario)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {proximo && (
              <p className="text-muted">
                Adicional = previsto − já cadastrado (nunca soma os dois). No mês atual, também se limita ao que o padrão de dias diz que ainda falta
                acontecer. No cartão, cada compra prevista cai na fatura do ciclo correspondente.
              </p>
            )}
          </>
        )}

        <h6 className="fw-bold mt-4">Ajustar nesta simulação</h6>
        {c.projetada ? (
          <SliderPercentual
            valor={ajuste?.modo === "PERCENTUAL" ? ajuste.valor : 0}
            onChange={(v) =>
              acoes.definirAjuste(
                idAjusteCategoria(c.chave),
                v === 0 ? null : { id: idAjusteCategoria(c.chave), alvo: "CATEGORIA", tipo: c.tipo, categoria_id: c.categoria_id, modo: "PERCENTUAL", valor: v, rotulo: `${c.categoria} ${v > 0 ? "+" : ""}${v}%` }
              )
            }
          />
        ) : null}
        <div className="input-group input-group-sm mt-2">
          <span className="input-group-text">Definir R$</span>
          <input
            type="number"
            min={0}
            className="form-control"
            placeholder={c.projetada ? "valor exato por mês" : "previsão manual por mês"}
            value={ajuste?.modo === "DEFINIR" ? ajuste.valor : ""}
            onChange={(ev) =>
              acoes.definirAjuste(
                idAjusteCategoria(c.chave),
                ev.target.value === ""
                  ? null
                  : { id: idAjusteCategoria(c.chave), alvo: "CATEGORIA", tipo: c.tipo, categoria_id: c.categoria_id, modo: "DEFINIR", valor: Math.max(0, Number(ev.target.value)), rotulo: `${c.categoria}: ${brl(Number(ev.target.value))}/mês` }
              )
            }
          />
          <span className="input-group-text">/mês</span>
        </div>
        {ajuste && (
          <button type="button" className="btn btn-sm btn-link px-0 mt-1" onClick={() => acoes.removerAjuste(idAjusteCategoria(c.chave))}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>Voltar à estimativa automática
          </button>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}
