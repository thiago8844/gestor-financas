import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { mensagemErroApi } from "../../utils";
import { getConciliacoes, getPainelFechamento } from "../../api/conciliacao";
import type { ContaNoPainel, FaturaConciliacao } from "../../types/conciliacao";
import { AuditoriaFaturaModal, BadgeAuditoria } from "../Cartoes/components/AuditoriaFaturaModal";
import { LancarNaFaturaModal } from "../Cartoes/components/LancarNaFaturaModal";
import { EnviarExtratoModal } from "./components/EnviarExtratoModal";
import { dataBr, mesAno, moeda, somarMes } from "./conciliacaoUtils";

function SituacaoConta({ conta }: { conta: ContaNoPainel }) {
  const c = conta.conciliacao;

  if (conta.situacao === "FINALIZADA") {
    return conta.vinculos_quebrados > 0 ? (
      <span className="text-warning">
        <i className="bi bi-exclamation-triangle me-1"></i>
        Finalizada, mas {conta.vinculos_quebrados} lançamento(s) mudaram depois
      </span>
    ) : (
      <span className="text-success">
        <i className="bi bi-check-circle-fill me-1"></i>
        Conciliada{c?.finalized_at && ` em ${new Date(c.finalized_at.replace(" ", "T")).toLocaleDateString("pt-BR")}`}
        {c?.contagens && ` · ${c.contagens.linhas} linhas`}
      </span>
    );
  }

  if (conta.situacao === "ABERTA" && c?.contagens) {
    const { pendentes, adiadas, conciliadas, linhas, ignoradas } = c.contagens;
    const partes = [
      pendentes > 0 && `${pendentes} sem correspondência`,
      adiadas > 0 && `${adiadas} adiada(s)`,
    ].filter(Boolean);

    return (
      <span className="text-warning-emphasis">
        <i className="bi bi-hourglass-split me-1"></i>
        Em andamento · {conciliadas + ignoradas}/{linhas} resolvidas{partes.length > 0 && ` · ${partes.join(", ")}`}
      </span>
    );
  }

  return (
    <span className="text-muted">
      <i className="bi bi-circle me-1"></i>
      Sem extrato{conta.ultima_finalizada && ` · última conciliada: ${mesAno(conta.ultima_finalizada)}`}
    </span>
  );
}

function SituacaoFatura({ fatura }: { fatura: FaturaConciliacao }) {
  if (!fatura.paga) {
    return <span className="text-danger small">Pendente {moeda(fatura.pendente)}</span>;
  }

  return (
    <span className="small text-success">
      Paga {moeda(fatura.pago)}
      {fatura.levado_para_proxima > 0 && <span className="text-info"> · {moeda(fatura.levado_para_proxima)} p/ próxima</span>}
    </span>
  );
}

/**
 * Fechamento do mês: o checklist do que falta auditar — cada conta (conciliação com o extrato) e
 * cada fatura que venceu no mês (auditoria manual contra a fatura do banco).
 */
export function PainelFechamento() {
  const [params, setParams] = useSearchParams();
  const mesParam = params.get("mes") ?? undefined;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["conciliacao-painel", mesParam ?? "padrao"],
    queryFn: () => getPainelFechamento(mesParam),
  });

  const { data: historico } = useQuery({ queryKey: ["conciliacoes"], queryFn: () => getConciliacoes() });

  const [envio, setEnvio] = useState<{ contaId?: number } | null>(null);
  const [auditar, setAuditar] = useState<FaturaConciliacao | null>(null);
  const [lancar, setLancar] = useState<{ fatura: FaturaConciliacao; tipo: "INCOME" | "EXPENSE"; valor: number } | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const painel = data?.data;
  const mes = painel?.mes ?? mesParam ?? "";

  const irPara = (novo: string) => setParams({ mes: novo });

  const contasEsperadas = painel?.contas.filter((c) => c.esperada) ?? [];
  const contasOpcionais = painel?.contas.filter((c) => !c.esperada) ?? [];
  const pct = painel && painel.progresso.total > 0 ? Math.round((painel.progresso.concluidos / painel.progresso.total) * 100) : 0;
  const abertas = (historico?.data ?? []).filter((c) => c.status === "ABERTA" && c.reference_month !== mes);

  const linhaConta = (conta: ContaNoPainel) => (
    <div key={conta.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
      <div>
        <div className="fw-semibold">
          <i className="bi bi-bank me-2 text-muted"></i>
          {conta.name}
          {conta.instituicao && <span className="text-muted small ms-2">{conta.instituicao}</span>}
        </div>
        <div className="small mt-1">
          <SituacaoConta conta={conta} />
        </div>
      </div>
      <div className="d-flex gap-2">
        {conta.conciliacao ? (
          <Link to={`/conciliacao/${conta.conciliacao.id}`} className={`btn btn-sm ${conta.situacao === "ABERTA" ? "btn-primary" : "btn-outline-secondary"}`}>
            {conta.situacao === "ABERTA" ? (
              <>
                <i className="bi bi-play-fill me-1"></i>Continuar
              </>
            ) : (
              "Ver"
            )}
          </Link>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEnvio({ contaId: conta.id })}>
            <i className="bi bi-file-earmark-arrow-up me-1"></i>Enviar extrato
          </button>
        )}
      </div>
    </div>
  );

  return (
    <PageLayout loading={isLoading}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-4 mb-3">
        <div>
          <h2 className="mb-1">Fechamento do mês</h2>
          <div className="text-muted small">Confira o que o banco mostra contra o que está no app, conta por conta e fatura por fatura.</div>
        </div>
        <button type="button" className="btn btn-success" onClick={() => setEnvio({})}>
          <i className="bi bi-file-earmark-arrow-up me-1"></i>Enviar extrato
        </button>
      </div>

      {isError && <div className="alert alert-danger">{mensagemErroApi(error, "Não foi possível carregar o fechamento.")}</div>}

      {painel && (
        <>
          {/* Mês + progresso */}
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" aria-label="Mês anterior" onClick={() => irPara(somarMes(mes, -1))}>
                    <i className="bi bi-chevron-left"></i>
                  </button>
                  <span className="fs-5 fw-semibold" style={{ minWidth: 170, textAlign: "center" }}>
                    {mesAno(mes)}
                  </span>
                  <button type="button" className="btn btn-sm btn-outline-secondary" aria-label="Próximo mês" onClick={() => irPara(somarMes(mes, 1))}>
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
                <div className="flex-grow-1" style={{ maxWidth: 420 }}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-muted">Concluído</span>
                    <strong>
                      {painel.progresso.concluidos} de {painel.progresso.total}
                    </strong>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div className={`progress-bar ${pct === 100 ? "bg-success" : ""}`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {abertas.length > 0 && (
            <div className="alert alert-warning py-2 small">
              <i className="bi bi-hourglass-split me-1"></i>
              Você tem conciliações em andamento de outros meses:{" "}
              {abertas.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link to={`/conciliacao/${c.id}`}>
                    {c.conta?.name} {mesAno(c.reference_month)}
                  </Link>
                </span>
              ))}
              .
            </div>
          )}

          {/* Contas */}
          <h6 className="text-uppercase text-muted small fw-bold mb-2">Contas · extrato do banco</h6>
          {contasEsperadas.length === 0 ? (
            <div className="text-muted small mb-4">Nenhuma conta bancária ativa.</div>
          ) : (
            <div className="list-group shadow-sm mb-4">{contasEsperadas.map(linhaConta)}</div>
          )}

          {/* Faturas */}
          <h6 className="text-uppercase text-muted small fw-bold mb-2">Faturas que vencem em {mesAno(mes)} · auditoria</h6>
          {painel.faturas.length === 0 ? (
            <div className="text-muted small mb-4">Nenhuma fatura com lançamentos vence neste mês.</div>
          ) : (
            <div className="list-group shadow-sm mb-2">
              {painel.faturas.map((f) => (
                <div key={f.id} className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
                  <div>
                    <div className="fw-semibold">
                      <i className="bi bi-credit-card me-2 text-muted"></i>
                      {f.cartao} · {mesAno(f.reference_month)}
                      <span className="fw-normal text-muted small ms-2">vence {dataBr(f.due_date)}</span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 align-items-center mt-1">
                      <span className="small">Total {moeda(f.total)}</span>
                      <SituacaoFatura fatura={f} />
                      <BadgeAuditoria auditoria={f.auditoria} />
                      {f.pagamento_conciliado && (
                        <span className="badge text-bg-light border text-success">
                          <i className="bi bi-link-45deg me-1"></i>Pagamento conferido no extrato
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" className={`btn btn-sm ${f.auditoria?.status === "CONFERE" ? "btn-outline-secondary" : "btn-outline-primary"}`} onClick={() => setAuditar(f)}>
                    <i className="bi bi-shield-check me-1"></i>
                    {f.auditoria ? "Auditar de novo" : "Auditar"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="small text-muted mb-4">
            Auditoria da fatura: exporte a fatura do app (PDF/Excel na tela de Cartões) e a do banco, compare do seu jeito e
            registre aqui o total que o banco cobrou.
          </div>

          {contasOpcionais.length > 0 && (
            <>
              <h6 className="text-uppercase text-muted small fw-bold mb-2">Outras contas (opcional)</h6>
              <div className="list-group shadow-sm mb-4 opacity-75">{contasOpcionais.map(linhaConta)}</div>
            </>
          )}

          {/* Histórico */}
          <button type="button" className="btn btn-sm btn-light border w-100 mb-3" onClick={() => setMostrarHistorico((v) => !v)}>
            <i className={`bi ${mostrarHistorico ? "bi-chevron-up" : "bi-clock-history"} me-2`}></i>
            {mostrarHistorico ? "Ocultar" : "Ver"} histórico de conciliações
          </button>

          {mostrarHistorico && (
            <div className="table-responsive border rounded mb-4">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Mês</th>
                    <th>Conta</th>
                    <th>Situação</th>
                    <th className="text-end">Linhas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(historico?.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-3">
                        Nenhuma conciliação ainda.
                      </td>
                    </tr>
                  )}
                  {(historico?.data ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="text-nowrap">{mesAno(c.reference_month)}</td>
                      <td>{c.conta?.name}</td>
                      <td>
                        {c.status === "FINALIZADA" ? (
                          <span className="badge text-bg-success">Finalizada</span>
                        ) : (
                          <span className="badge text-bg-warning">Em andamento</span>
                        )}
                        {c.note && <span className="small text-muted ms-2">“{c.note}”</span>}
                      </td>
                      <td className="text-end">
                        {c.contagens && `${c.contagens.conciliadas + c.contagens.ignoradas}/${c.contagens.linhas}`}
                      </td>
                      <td className="text-end">
                        <Link to={`/conciliacao/${c.id}`} className="btn btn-sm btn-link">
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {envio && <EnviarExtratoModal contaId={envio.contaId} mes={mes || undefined} onClose={() => setEnvio(null)} />}

      {auditar && (
        <AuditoriaFaturaModal
          fatura={auditar}
          cartaoNome={auditar.cartao ?? "Cartão"}
          onClose={() => setAuditar(null)}
          onLancarDiferenca={(tipo, valor) => setLancar({ fatura: auditar, tipo, valor })}
        />
      )}

      {lancar && (
        <LancarNaFaturaModal
          fatura={lancar.fatura}
          tipoInicial={lancar.tipo}
          valorInicial={lancar.valor}
          descricaoInicial="Ajuste da auditoria da fatura"
          onClose={() => setLancar(null)}
        />
      )}
    </PageLayout>
  );
}
