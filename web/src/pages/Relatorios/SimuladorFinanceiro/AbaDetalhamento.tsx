import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { EventoSimulacao, Natureza, RelatorioSimulador } from "../../../types/simulador";
import { BadgeConfianca, BadgeNatureza, Secao } from "./ui";
import { brl, brlSinal, formatarDataBR, formatarDiaMes, LABEL_NATUREZA, nomeMes } from "./utils";

type Props = {
  relatorio: RelatorioSimulador;
  onAbrirCategoria: (chave: string) => void;
};

export function AbaDetalhamento({ relatorio, onAbrirCategoria }: Props) {
  return (
    <div className="d-flex flex-column gap-4">
      <TabelaMensalDetalhada relatorio={relatorio} onAbrirCategoria={onAbrirCategoria} />
      <ListaEventos relatorio={relatorio} />
    </div>
  );
}

// -=-=-=- TABELA MENSAL -=-=-=-

function TabelaMensalDetalhada({ relatorio, onAbrirCategoria }: Props) {
  const [aberto, setAberto] = useState<string | null>(null);
  const meses = relatorio.cenarios.personalizado.meses;
  const base = new Map(relatorio.cenarios.base.meses.map((m) => [m.mes, m]));
  const ativo = relatorio.cenario_ativo;

  return (
    <Secao titulo="Detalhamento mensal" icone="bi-table" rodape="Clique num mês para abrir categorias e lançamentos. Despesas conhecidas/estimadas não incluem faturas (coluna própria).">
      <div className="table-responsive">
        <table className="table table-hover align-middle small mb-0">
          <thead className="table-light">
            <tr>
              <th>Mês</th>
              <th className="text-end">Saldo inicial</th>
              <th className="text-end">Receitas confirmadas</th>
              <th className="text-end">Receitas estimadas</th>
              <th className="text-end">Despesas conhecidas</th>
              <th className="text-end">Despesas estimadas</th>
              <th className="text-end">Faturas</th>
              <th className="text-end">Resultado</th>
              <th className="text-end">Saldo final</th>
              <th className="text-end">Menor saldo</th>
              {ativo && <th className="text-end">vs. automática</th>}
            </tr>
          </thead>
          <tbody>
            {meses.map((m, i) => {
              const b = base.get(m.mes);
              const variacao = b ? m.saldo_final - b.saldo_final : 0;
              return (
                <Fragment key={m.mes}>
                  <tr role="button" onClick={() => setAberto(aberto === m.mes ? null : m.mes)} className={aberto === m.mes ? "table-active" : ""}>
                    <td className="fw-semibold text-nowrap">
                      <i className={`bi ${aberto === m.mes ? "bi-chevron-down" : "bi-chevron-right"} me-1 text-muted`}></i>
                      {nomeMes(m.mes)}
                      {i === 0 && <span className="text-muted fw-normal ms-1">(restante)</span>}
                      {m.dias_negativos > 0 && <i className="bi bi-exclamation-triangle-fill text-danger ms-2" title={`${m.dias_negativos} dia(s) com saldo negativo`}></i>}
                    </td>
                    <td className="text-end text-muted text-nowrap">{brl(m.saldo_inicial)}</td>
                    <td className="text-end text-success text-nowrap">{brl(m.receitas.conhecidas)}</td>
                    <td className="text-end text-success text-nowrap opacity-75">
                      {brl(m.receitas.estimadas)}
                      {m.receitas.hipoteticas > 0 && <div style={{ color: "#6f42c1" }}>+ {brl(m.receitas.hipoteticas)} sim.</div>}
                    </td>
                    <td className="text-end text-danger text-nowrap">{brl(m.despesas.fora_cartao.conhecidas)}</td>
                    <td className="text-end text-danger text-nowrap opacity-75">
                      {brl(m.despesas.fora_cartao.estimadas)}
                      {m.despesas.fora_cartao.hipoteticas > 0 && <div style={{ color: "#6f42c1" }}>+ {brl(m.despesas.fora_cartao.hipoteticas)} sim.</div>}
                    </td>
                    <td className="text-end text-nowrap">{brl(m.faturas.total)}</td>
                    <td className={`text-end text-nowrap ${m.resultado < 0 ? "text-danger" : ""}`}>{brlSinal(m.resultado)}</td>
                    <td className={`text-end fw-semibold text-nowrap ${m.saldo_final < 0 ? "text-danger" : ""}`}>{brl(m.saldo_final)}</td>
                    <td className={`text-end text-nowrap ${m.saldo_minimo < 0 ? "text-danger" : "text-muted"}`}>{brl(m.saldo_minimo)}</td>
                    {ativo && (
                      <td className={`text-end text-nowrap ${variacao > 0 ? "text-success" : variacao < 0 ? "text-danger" : "text-muted"}`}>
                        {Math.abs(variacao) < 0.005 ? "—" : brlSinal(variacao)}
                      </td>
                    )}
                  </tr>
                  {aberto === m.mes && (
                    <tr>
                      <td colSpan={ativo ? 11 : 10} className="bg-light">
                        <DetalheDoMes relatorio={relatorio} mes={m.mes} onAbrirCategoria={onAbrirCategoria} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}

function DetalheDoMes({ relatorio, mes, onAbrirCategoria }: { relatorio: RelatorioSimulador; mes: string; onAbrirCategoria: (chave: string) => void }) {
  const categorias = relatorio.categorias_mes
    .map((c) => ({ ...c, doMes: c.meses.find((m) => m.mes === mes) }))
    .filter((c) => c.doMes && c.doMes.conhecido + c.doMes.estimado + c.doMes.hipotetico > 0)
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.doMes!.conhecido + b.doMes!.estimado - (a.doMes!.conhecido + a.doMes!.estimado));
  const modelos = new Set(relatorio.categorias.map((c) => c.chave));
  const eventos = relatorio.eventos.filter((e) => e.data.startsWith(mes));

  return (
    <div className="row g-3 py-2">
      <div className="col-12 col-xl-5">
        <div className="fw-semibold mb-2">Por categoria</div>
        <table className="table table-sm mb-0 bg-white">
          <thead>
            <tr>
              <th>Categoria</th>
              <th className="text-end">Conhecido</th>
              <th className="text-end">Previsto</th>
              <th className="text-end">Simulado</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.chave}>
                <td>
                  <i className={`bi ${c.tipo === "INCOME" ? "bi-arrow-down-short text-success" : "bi-arrow-up-short text-danger"}`}></i>
                  {modelos.has(c.chave) ? (
                    <button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => onAbrirCategoria(c.chave)}>
                      {c.categoria}
                    </button>
                  ) : (
                    c.categoria
                  )}
                </td>
                <td className="text-end">{brl(c.doMes!.conhecido)}</td>
                <td className="text-end text-primary">{c.doMes!.estimado ? brl(c.doMes!.estimado) : "—"}</td>
                <td className="text-end">{c.doMes!.hipotetico ? brl(c.doMes!.hipotetico) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="col-12 col-xl-7">
        <div className="fw-semibold mb-2">Lançamentos ({eventos.length})</div>
        <TabelaEventos eventos={eventos} compacta />
      </div>
    </div>
  );
}

// -=-=-=- LISTA DE EVENTOS -=-=-=-

const FILTROS_NATUREZA: (Natureza | "TODAS")[] = ["TODAS", "CONHECIDO", "RECORRENCIA", "FATURA", "ESTIMADO", "HIPOTETICO"];

function ListaEventos({ relatorio }: { relatorio: RelatorioSimulador }) {
  const [natureza, setNatureza] = useState<Natureza | "TODAS">("TODAS");
  const [tipo, setTipo] = useState<"TODOS" | "INCOME" | "EXPENSE">("TODOS");
  const [busca, setBusca] = useState("");

  const eventos = useMemo(
    () =>
      relatorio.eventos.filter(
        (e) =>
          (natureza === "TODAS" || e.natureza === natureza) &&
          (tipo === "TODOS" || e.tipo === tipo) &&
          (!busca || `${e.descricao} ${e.categoria ?? ""}`.toLowerCase().includes(busca.toLowerCase()))
      ),
    [relatorio.eventos, natureza, tipo, busca]
  );

  return (
    <Secao titulo="Linha do tempo de eventos" icone="bi-list-ol" rodape="O saldo após cada evento já considera tudo o que aconteceu antes no mesmo dia (entradas primeiro).">
      <div className="d-flex flex-wrap gap-2 mb-3">
        <select className="form-select form-select-sm w-auto" value={natureza} onChange={(e) => setNatureza(e.target.value as Natureza | "TODAS")} aria-label="Origem">
          {FILTROS_NATUREZA.map((n) => (
            <option key={n} value={n}>
              {n === "TODAS" ? "Todas as origens" : LABEL_NATUREZA[n]}
            </option>
          ))}
        </select>
        <select className="form-select form-select-sm w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
          <option value="TODOS">Entradas e saídas</option>
          <option value="INCOME">Só entradas</option>
          <option value="EXPENSE">Só saídas</option>
        </select>
        <input className="form-control form-control-sm w-auto" placeholder="Buscar descrição ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <span className="text-muted small align-self-center">{eventos.length} evento(s)</span>
      </div>
      <TabelaEventos eventos={eventos} />
    </Secao>
  );
}

const LIMITE_INICIAL = 150;

function TabelaEventos({ eventos, compacta }: { eventos: EventoSimulacao[]; compacta?: boolean }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const visiveis = eventos.slice(0, limite);

  if (!eventos.length) return <p className="text-muted small mb-0">Nenhum evento.</p>;

  return (
    <div className="table-responsive" style={compacta ? { maxHeight: 360, overflowY: "auto" } : undefined}>
      <table className="table table-sm align-middle small mb-0 bg-white">
        <thead className="table-light" style={{ position: "sticky", top: 0 }}>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th>Origem</th>
            {!compacta && <th>Categoria</th>}
            <th className="text-end">Valor</th>
            <th className="text-end">Saldo após</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((e) => (
            <Fragment key={e.id}>
              <tr role={e.itens?.length ? "button" : undefined} onClick={() => e.itens?.length && setAberto(aberto === e.id ? null : e.id)}>
                <td className="text-nowrap">
                  {formatarDiaMes(e.data)}
                  {e.atrasado && e.data_original && <div className="text-danger">venceu {formatarDataBR(e.data_original)}</div>}
                </td>
                <td>
                  {e.itens?.length ? <i className={`bi ${aberto === e.id ? "bi-chevron-down" : "bi-chevron-right"} me-1 text-muted`}></i> : null}
                  {e.transacao_id ? (
                    <Link to={`/${e.tipo === "INCOME" ? "receitas" : "despesas"}/editar/${e.transacao_id}`} onClick={(ev) => ev.stopPropagation()}>
                      {e.descricao}
                    </Link>
                  ) : e.recorrencia_id ? (
                    <Link to={`/recorrencias/editar/${e.recorrencia_id}`} onClick={(ev) => ev.stopPropagation()}>
                      {e.descricao}
                    </Link>
                  ) : (
                    e.descricao
                  )}
                  {e.parcela && <span className="text-muted ms-1">({e.parcela})</span>}
                  {e.ajustado && <span className="badge text-bg-light border fw-normal ms-1">ajustado</span>}
                  {e.data_estimada === "NEUTRA" && <span className="text-muted ms-1" title="Sem padrão de dias no histórico: data neutra">· data aproximada</span>}
                </td>
                <td className="text-nowrap">
                  <BadgeNatureza natureza={e.natureza} />
                  {e.confianca && e.natureza === "ESTIMADO" && (
                    <span className="ms-1">
                      <BadgeConfianca nivel={e.confianca} prefixo={false} />
                    </span>
                  )}
                </td>
                {!compacta && <td className="text-muted">{e.categoria ?? "—"}</td>}
                <td className={`text-end text-nowrap ${e.tipo === "INCOME" ? "text-success" : "text-danger"}`}>
                  {e.valor === null ? <span className="text-muted">sem valor</span> : brlSinal(e.tipo === "INCOME" ? e.valor : -e.valor)}
                </td>
                <td className={`text-end text-nowrap ${e.saldo_apos < 0 ? "text-danger fw-semibold" : ""}`}>{brl(e.saldo_apos)}</td>
              </tr>
              {aberto === e.id && e.itens && (
                <tr>
                  <td></td>
                  <td colSpan={compacta ? 4 : 5}>
                    <ul className="list-unstyled mb-0">
                      {e.itens.map((item, i) => (
                        <li key={i} className="d-flex justify-content-between gap-2 py-1 border-bottom">
                          <span>
                            <BadgeNatureza natureza={item.natureza} /> <span className="ms-1">{item.descricao}</span>
                            {item.parcela && <span className="text-muted"> ({item.parcela})</span>}
                            {item.data_compra && <span className="text-muted"> · {formatarDiaMes(item.data_compra)}</span>}
                          </span>
                          <span>{item.valor === null ? "sem valor" : brl(item.valor)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      {eventos.length > limite && (
        <button type="button" className="btn btn-sm btn-link" onClick={() => setLimite((l) => l + LIMITE_INICIAL)}>
          Mostrar mais ({eventos.length - limite} restantes)
        </button>
      )}
    </div>
  );
}
