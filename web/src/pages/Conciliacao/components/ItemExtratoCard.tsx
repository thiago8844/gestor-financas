import { Dropdown } from "react-bootstrap";
import { BadgeAuditoria } from "../../Cartoes/components/AuditoriaFaturaModal";
import type { FaturaConciliacao, ItemConciliacao } from "../../../types/conciliacao";
import { STATUS_ITEM_BADGE, STATUS_ITEM_LABEL, dataBr, mesAno, moeda, pareceFatura, pareceTransferencia, valorExtrato } from "../conciliacaoUtils";

type Props = {
  item: ItemConciliacao;
  faturas: FaturaConciliacao[];
  editavel: boolean;
  ocupado: boolean;
  onAceitarSugestao: () => void;
  onLancar: () => void;
  onVincular: () => void;
  onPagamentoFatura: (faturaId?: number) => void;
  onTransferencia: () => void;
  onAdiar: () => void;
  onIgnorar: () => void;
  onDesfazer: () => void;
};

/** Fatura cujo pendente (ou um pagamento ainda não conferido) tem exatamente o valor da linha. */
function faturaQueBate(item: ItemConciliacao, faturas: FaturaConciliacao[]) {
  if (item.type !== "EXPENSE") return null;

  return (
    faturas.find((f) =>
      !f.paga
        ? Math.abs(f.pendente - item.amount) < 0.005
        : f.pagamentos.some((p) => !p.conciliado && Math.abs(p.valor - item.amount) < 0.005)
    ) ?? null
  );
}

export function ItemExtratoCard({ item, faturas, editavel, ocupado, onAceitarSugestao, onLancar, onVincular, onPagamentoFatura, onTransferencia, onAdiar, onIgnorar, onDesfazer }: Props) {
  const valor = valorExtrato(item.type, item.amount);
  const aberto = item.source === "EXTRATO" && (item.status === "PENDENTE" || item.status === "ADIADO");
  const sugestaoFatura = aberto && !item.sugestao ? faturaQueBate(item, faturas) : null;
  const podeSerFatura = item.type === "EXPENSE" && faturas.length > 0;
  const destaqueFatura = podeSerFatura && (sugestaoFatura !== null || pareceFatura(item.description));
  const transferenciaProvavel = pareceTransferencia(item.description);
  const deFatura = item.lancamentos.some((l) => l.invoice_id !== null) || item.fatura !== null;
  const faturaDoItem = item.fatura ? faturas.find((f) => f.id === item.fatura?.id) : undefined;

  const borda =
    item.vinculo_quebrado ? "var(--bs-danger)"
    : item.status === "CONCILIADO" ? "var(--bs-success)"
    : item.status === "IGNORADO" ? "var(--bs-secondary)"
    : item.status === "ADIADO" ? "var(--bs-info)"
    : "var(--bs-warning)";

  return (
    <div className="card shadow-sm" style={{ borderLeft: `4px solid ${borda}` }}>
      <div className="card-body py-2 px-3">
        {/* Linha do extrato */}
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div className="d-flex gap-3 align-items-start" style={{ minWidth: 0 }}>
            <div className="text-muted small text-nowrap pt-1" style={{ width: 78 }}>
              {dataBr(item.transaction_date)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="fw-semibold text-break">
                {item.source === "APP" && <i className="bi bi-phone me-1 text-muted" title="Lançamento só do app"></i>}
                {item.description}
              </div>
              <div className="d-flex flex-wrap gap-1 align-items-center small mt-1">
                {item.vinculo_quebrado ? (
                  <span className="badge text-bg-danger">
                    <i className="bi bi-exclamation-octagon me-1"></i>Lançamento mudou depois de conferido
                  </span>
                ) : (
                  <span className={`badge ${STATUS_ITEM_BADGE[item.status]}`}>
                    {item.source === "APP" ? "Só no app · confirmado" : STATUS_ITEM_LABEL[item.status]}
                    {item.status === "CONCILIADO" && item.matched_by === "AUTO" && " · automático"}
                  </span>
                )}
                {item.note && <span className="text-muted fst-italic text-break">“{item.note}”</span>}
              </div>
            </div>
          </div>
          <div className={`fw-bold text-nowrap ${valor.classe}`}>{valor.texto}</div>
        </div>

        {/* O que casou no app */}
        {item.status === "CONCILIADO" && item.lancamentos.length > 0 && (
          <div className="small text-muted mt-2 ps-md-5 ms-md-4">
            <i className="bi bi-link-45deg me-1"></i>
            {deFatura && item.fatura ? (
              <>
                Pagamento da fatura <strong>{item.fatura.cartao}</strong> de {mesAno(item.fatura.reference_month)} ·{" "}
                {item.lancamentos.length} lançamento(s) no app
                {faturaDoItem && (
                  <span className="ms-2">
                    <BadgeAuditoria auditoria={faturaDoItem.auditoria} />
                  </span>
                )}
              </>
            ) : (
              item.lancamentos.map((l) => (
                <span key={l.id} className="me-2">
                  {l.description}
                  {l.categoria && ` (${l.categoria})`} · {dataBr(l.date)}
                </span>
              ))
            )}
          </div>
        )}

        {/* Sugestão */}
        {aberto && item.sugestao && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-2 ps-md-5 ms-md-4 small">
            <span className="text-primary">
              <i className="bi bi-lightbulb me-1"></i>
              Parece ser <strong>{item.sugestao.entrada.description}</strong> · {dataBr(item.sugestao.entrada.date)}
              {item.sugestao.dias > 0 && ` (${item.sugestao.dias}d)`}
              {item.sugestao.entrada.categoria && ` · ${item.sugestao.entrada.categoria}`}
            </span>
            {editavel && (
              <button type="button" className="btn btn-sm btn-primary py-0" disabled={ocupado} onClick={onAceitarSugestao}>
                <i className="bi bi-check2 me-1"></i>É esse
              </button>
            )}
          </div>
        )}

        {aberto && sugestaoFatura && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-2 ps-md-5 ms-md-4 small">
            <span className="text-primary">
              <i className="bi bi-credit-card me-1"></i>
              Parece o pagamento da fatura <strong>{sugestaoFatura.cartao}</strong> de {mesAno(sugestaoFatura.reference_month)} ({moeda(item.amount)})
            </span>
            {editavel && (
              <button type="button" className="btn btn-sm btn-primary py-0" disabled={ocupado} onClick={() => onPagamentoFatura(sugestaoFatura.id)}>
                <i className="bi bi-check2 me-1"></i>É essa
              </button>
            )}
          </div>
        )}

        {/* Ações */}
        {editavel && (
          <div className="d-flex flex-wrap gap-1 mt-2 ps-md-5 ms-md-4">
            {aberto && (
              <>
                <button type="button" className="btn btn-sm btn-outline-success" disabled={ocupado} onClick={onLancar}>
                  <i className="bi bi-plus-lg me-1"></i>Lançar agora
                </button>
                <button type="button" className="btn btn-sm btn-outline-primary" disabled={ocupado} onClick={onVincular}>
                  <i className="bi bi-link me-1"></i>Vincular...
                  {item.candidatos.length > 0 && <span className="badge rounded-pill text-bg-primary ms-1">{item.candidatos.length}</span>}
                </button>
                {/* Atalhos contextuais: só aparecem quando a descrição do banco sugere. */}
                {destaqueFatura && (
                  <button type="button" className="btn btn-sm btn-outline-dark" disabled={ocupado} onClick={() => onPagamentoFatura()}>
                    <i className="bi bi-credit-card me-1"></i>É pagamento de fatura
                  </button>
                )}
                {transferenciaProvavel && (
                  <button type="button" className="btn btn-sm btn-outline-dark" disabled={ocupado} onClick={onTransferencia}>
                    <i className="bi bi-arrow-left-right me-1"></i>É transferência
                  </button>
                )}
                {item.status === "PENDENTE" && (
                  <button type="button" className="btn btn-sm btn-outline-info" disabled={ocupado} onClick={onAdiar} title="Segura o fechamento do mês e lembra você toda semana">
                    <i className="bi bi-clock me-1"></i>Lançar depois
                  </button>
                )}
                <Dropdown>
                  <Dropdown.Toggle size="sm" variant="outline-secondary" disabled={ocupado}>
                    Mais
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {podeSerFatura && !destaqueFatura && (
                      <Dropdown.Item onClick={() => onPagamentoFatura()}>
                        <i className="bi bi-credit-card me-2"></i>É pagamento de fatura
                      </Dropdown.Item>
                    )}
                    {!transferenciaProvavel && (
                      <Dropdown.Item onClick={onTransferencia}>
                        <i className="bi bi-arrow-left-right me-2"></i>É transferência entre minhas contas
                      </Dropdown.Item>
                    )}
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={onIgnorar}>
                      <i className="bi bi-eye-slash me-2"></i>Ignorar (com motivo)
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            )}
            {(item.status === "CONCILIADO" || item.status === "IGNORADO" || item.status === "ADIADO") && (
              <button type="button" className="btn btn-sm btn-link text-decoration-none" disabled={ocupado} onClick={onDesfazer}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>
                {item.status === "ADIADO" ? "Voltar para pendente" : "Desfazer"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
