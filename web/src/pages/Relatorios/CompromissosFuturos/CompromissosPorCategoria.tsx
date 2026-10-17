import { Fragment, useMemo, useState } from "react";
import { brl, formatarDataBR, mesCurto } from "./formatadores";
import type { EventoCompromisso, TipoProjecao } from "../../../types/relatorio";

type Tipo = "EXPENSE" | "INCOME";

type Lancamento = {
  chave: string;
  tipo: Tipo;
  categoria: string;
  descricao: string;
  valor: number;
  estimado: boolean;
  /** Quando o dinheiro sai: vencimento da fatura ou da conta. */
  vencimento: string;
  dataCompra: string | null;
  parcela: string | null;
  recorrente: boolean;
  /** "Cartão X" para compras de fatura; null para o que cai direto na conta. */
  cartao: string | null;
};

type Props = {
  eventos: EventoCompromisso[];
  tipos: TipoProjecao;
  /** PDF: tudo expandido, sem controles. */
  modoImpressao?: boolean;
};

const SEM_CATEGORIA = "Sem categoria";
const PALETA = ["#0d6efd", "#6f42c1", "#d63384", "#fd7e14", "#198754", "#0dcaf0", "#ffc107", "#6c757d", "#dc3545", "#20c997"];

/**
 * Abre as faturas em compras: é isso que dá a categoria de verdade dos compromissos no cartão.
 * Cada compra aparece uma vez só (a fatura em si não é somada), então o total bate com o do relatório.
 */
function achatar(eventos: EventoCompromisso[]) {
  const lancamentos: Lancamento[] = [];
  let semValor = 0;

  for (const evento of eventos) {
    if (evento.origem === "FATURA") {
      evento.itens.forEach((item, i) => {
        if (item.valor === null) {
          semValor++;
          return;
        }
        lancamentos.push({
          chave: `${evento.id}:${item.transacao_id ?? "p"}:${i}`,
          tipo: "EXPENSE",
          categoria: item.categoria ?? SEM_CATEGORIA,
          descricao: item.descricao,
          valor: item.valor,
          estimado: item.estimado,
          vencimento: evento.data,
          dataCompra: item.data_compra,
          parcela: item.parcela,
          recorrente: item.recorrente,
          cartao: evento.fatura?.cartao ?? evento.descricao,
        });
      });
      continue;
    }

    if (evento.valor === null) {
      semValor++;
      continue;
    }

    lancamentos.push({
      chave: evento.id,
      tipo: evento.tipo,
      categoria: evento.categoria ?? SEM_CATEGORIA,
      descricao: evento.descricao,
      valor: evento.valor,
      estimado: evento.estimado,
      vencimento: evento.data,
      dataCompra: null,
      parcela: evento.parcela,
      recorrente: evento.origem === "RECORRENTE",
      cartao: null,
    });
  }

  return { lancamentos, semValor };
}

export function CompromissosPorCategoria({ eventos, tipos, modoImpressao }: Props) {
  const [tipo, setTipo] = useState<Tipo>(tipos === "RECEITAS" ? "INCOME" : "EXPENSE");
  const [mes, setMes] = useState("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  const { lancamentos, semValor } = useMemo(() => achatar(eventos), [eventos]);

  const tipoAtivo: Tipo = tipos === "DESPESAS" ? "EXPENSE" : tipos === "RECEITAS" ? "INCOME" : tipo;

  const meses = useMemo(
    () => [...new Set(lancamentos.filter((l) => l.tipo === tipoAtivo).map((l) => l.vencimento.slice(0, 7)))].sort(),
    [lancamentos, tipoAtivo]
  );
  const mesAtivo = meses.includes(mes) ? mes : "";

  const categorias = useMemo(() => {
    const mapa = new Map<string, Lancamento[]>();
    lancamentos
      .filter((l) => l.tipo === tipoAtivo && (!mesAtivo || l.vencimento.startsWith(mesAtivo)))
      .forEach((l) => mapa.set(l.categoria, [...(mapa.get(l.categoria) ?? []), l]));

    return [...mapa.entries()]
      .map(([nome, itens]) => ({
        nome,
        itens: itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor),
        total: itens.reduce((s, l) => s + l.valor, 0),
        noCartao: itens.filter((l) => l.cartao).reduce((s, l) => s + l.valor, 0),
        estimado: itens.filter((l) => l.estimado).reduce((s, l) => s + l.valor, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [lancamentos, tipoAtivo, mesAtivo]);

  const total = categorias.reduce((s, c) => s + c.total, 0);
  const totalCartao = categorias.reduce((s, c) => s + c.noCartao, 0);
  const todasAbertas = categorias.length > 0 && categorias.every((c) => abertas.has(c.nome));

  const alternar = (nome: string) =>
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(nome)) novo.add(nome);
      return novo;
    });

  const corValor = tipoAtivo === "INCOME" ? "text-success" : "text-danger";

  return (
    <div>
      {!modoImpressao && (
        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              {tipos === "AMBOS" && (
                <div className="col-12 col-md-4">
                  <label className="form-label small">Mostrar</label>
                  <div className="btn-group w-100" role="group">
                    {(
                      [
                        ["EXPENSE", "Saídas"],
                        ["INCOME", "Entradas"],
                      ] as [Tipo, string][]
                    ).map(([valor, label]) => (
                      <button
                        key={valor}
                        type="button"
                        className={`btn btn-sm ${tipoAtivo === valor ? "btn-primary" : "btn-outline-primary"}`}
                        aria-pressed={tipoAtivo === valor}
                        onClick={() => setTipo(valor)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="col-7 col-md-4">
                <label className="form-label small">Mês de vencimento</label>
                <select className="form-select form-select-sm" value={mesAtivo} onChange={(e) => setMes(e.target.value)}>
                  <option value="">Todo o período</option>
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {mesCurto(m)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-5 col-md-4 text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setAbertas(todasAbertas ? new Set() : new Set(categorias.map((c) => c.nome)))}
                  disabled={categorias.length === 0}
                >
                  <i className={`bi ${todasAbertas ? "bi-arrows-collapse" : "bi-arrows-expand"} me-1`}></i>
                  {todasAbertas ? "Recolher tudo" : "Expandir tudo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {categorias.length === 0 ? (
        <div className="card shadow-sm border-0">
          <div className="card-body text-center text-muted py-5">
            <i className="bi bi-tags fs-1 opacity-25"></i>
            <p className="mt-2 mb-0">Nenhum compromisso com valor nesse período.</p>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white d-flex flex-wrap justify-content-between gap-2 py-3">
            <h6 className="fw-bold mb-0">
              {tipoAtivo === "INCOME" ? "Entradas" : "Saídas"} por categoria
              <span className="text-muted fw-normal small ms-2">
                {categorias.length} {categorias.length === 1 ? "categoria" : "categorias"}
              </span>
            </h6>
            <div className="small">
              <span className={`fw-semibold ${corValor}`}>{brl(total)}</span>
              {totalCartao > 0 && (
                <span className="text-muted ms-3">
                  <i className="bi bi-credit-card me-1"></i>
                  {brl(totalCartao)} no cartão
                </span>
              )}
            </div>
          </div>

          <div className="list-group list-group-flush">
            {categorias.map((categoria, indice) => {
              const aberta = modoImpressao || abertas.has(categoria.nome);
              const percentual = total > 0 ? (categoria.total / total) * 100 : 0;
              const cor = categoria.nome === SEM_CATEGORIA ? "#adb5bd" : PALETA[indice % PALETA.length];

              return (
                <Fragment key={categoria.nome}>
                  <div
                    className="list-group-item py-3"
                    role={modoImpressao ? undefined : "button"}
                    onClick={modoImpressao ? undefined : () => alternar(categoria.nome)}
                  >
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="fw-semibold">
                        {!modoImpressao && <i className={`bi bi-chevron-${aberta ? "down" : "right"} text-muted me-2`}></i>}
                        <span
                          className="d-inline-block rounded-circle me-2"
                          style={{ width: 10, height: 10, background: cor }}
                        ></span>
                        {categoria.nome}
                        <span className="text-muted fw-normal small ms-2">
                          {categoria.itens.length} {categoria.itens.length === 1 ? "item" : "itens"}
                        </span>
                      </div>
                      <div className="text-end text-nowrap">
                        <span className={`fw-semibold ${corValor}`}>{brl(categoria.total)}</span>
                        <span className="text-muted small ms-2">{percentual.toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="progress mt-2" style={{ height: 6 }}>
                      <div className="progress-bar" style={{ width: `${percentual}%`, background: cor }}></div>
                    </div>

                    {(categoria.noCartao > 0 || categoria.estimado > 0) && (
                      <div className="small text-muted mt-2 d-flex flex-wrap gap-3">
                        {categoria.noCartao > 0 && (
                          <span>
                            <i className="bi bi-credit-card me-1"></i>
                            {brl(categoria.noCartao)} no cartão
                          </span>
                        )}
                        {categoria.noCartao < categoria.total && (
                          <span>
                            <i className="bi bi-wallet2 me-1"></i>
                            {brl(categoria.total - categoria.noCartao)} direto na conta
                          </span>
                        )}
                        {categoria.estimado > 0 && (
                          <span>
                            <i className="bi bi-magic me-1"></i>
                            {brl(categoria.estimado)} estimado
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {aberta && (
                    <div className="list-group-item bg-body-tertiary p-0">
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0 bg-white">
                          <thead>
                            <tr className="text-muted small">
                              <th>Descrição</th>
                              <th>Origem</th>
                              <th>Vence</th>
                              <th>Compra</th>
                              <th className="text-end">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoria.itens.map((l) => (
                              <tr key={l.chave}>
                                <td>
                                  {l.descricao}
                                  {l.parcela && <span className="text-muted ms-2">{l.parcela}</span>}
                                  {l.recorrente && <i className="bi bi-arrow-repeat text-muted ms-2" title="Recorrente"></i>}
                                  {l.estimado && (
                                    <span className="badge text-bg-info-subtle text-info-emphasis border border-info-subtle ms-2">
                                      Estimado
                                    </span>
                                  )}
                                </td>
                                <td className="text-nowrap small">
                                  {l.cartao ? (
                                    <>
                                      <i className="bi bi-credit-card me-1"></i>
                                      {l.cartao}
                                    </>
                                  ) : (
                                    <>
                                      <i className="bi bi-wallet2 me-1"></i>Conta
                                    </>
                                  )}
                                </td>
                                <td className="text-nowrap">{formatarDataBR(l.vencimento)}</td>
                                <td className="text-nowrap">{l.dataCompra ? formatarDataBR(l.dataCompra) : "-"}</td>
                                <td className="text-end text-nowrap">
                                  {l.estimado && <span className="text-muted">≈ </span>}
                                  {brl(l.valor)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-muted small mt-3 mb-0">
        <i className="bi bi-info-circle me-1"></i>
        As faturas do cartão são abertas em compras e parcelas, cada uma na sua categoria — o total é o mesmo do
        resumo, sem contar nada duas vezes.
        {semValor > 0 && <> {semValor} {semValor === 1 ? "item" : "itens"} sem valor definido ficam de fora.</>}
      </p>
    </div>
  );
}
