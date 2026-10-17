import { useMemo, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { BadgeAuditoria } from "../../Cartoes/components/AuditoriaFaturaModal";
import type { ErroConciliacao, FaturaConciliacao, ItemConciliacao, RevisaoResponse } from "../../../types/conciliacao";
import { dataBr, diasEntre, mesAno, moeda, valorExtrato } from "../conciliacaoUtils";

type Props = {
  item: ItemConciliacao;
  faturas: FaturaConciliacao[];
  faturaInicialId?: number;
  onConfirmar: (dados: { invoice_id: number; ajuste_descricao?: string }) => Promise<RevisaoResponse>;
  onClose: () => void;
};

type Plano = {
  tipo: "pagar" | "parcial" | "ajustar_e_pagar" | "vincular" | "ajustar" | "sem_pagamento";
  texto: React.ReactNode;
  ajuste: number;
};

/** O que o app vai fazer com a fatura para ela bater com o débito do banco (espelha o backend). */
function planoParaFatura(item: ItemConciliacao, f: FaturaConciliacao): Plano {
  const valor = item.amount;
  const quando = dataBr(item.transaction_date);

  if (!f.paga) {
    const pendente = f.pendente;

    if (Math.abs(valor - pendente) < 0.005) {
      return { tipo: "pagar", ajuste: 0, texto: <>Marcar a fatura como <strong>paga em {quando}</strong>.</> };
    }

    if (valor < pendente) {
      return {
        tipo: "parcial",
        ajuste: 0,
        texto: (
          <>
            <strong>Pagamento parcial</strong> em {quando}: {moeda(valor)} saem da conta e{" "}
            <strong>{moeda(pendente - valor)}</strong> vão para a fatura seguinte como "Saldo restante".
          </>
        ),
      };
    }

    return {
      tipo: "ajustar_e_pagar",
      ajuste: valor - pendente,
      texto: (
        <>
          O banco debitou <strong>{moeda(valor - pendente)}</strong> a mais que o pendente no app ({moeda(pendente)}). Será
          lançada uma despesa de ajuste na fatura e ela será paga em {quando}.
        </>
      ),
    };
  }

  const livres = f.pagamentos.filter((p) => !p.conciliado);

  if (livres.length === 0) {
    return { tipo: "sem_pagamento", ajuste: 0, texto: <>O pagamento desta fatura já foi conferido com outra linha do extrato.</> };
  }

  const pagamento = [...livres].sort((a, b) => diasEntre(a.data, item.transaction_date) - diasEntre(b.data, item.transaction_date))[0];
  const diferenca = valor - pagamento.valor;
  const moverData = pagamento.data !== item.transaction_date.slice(0, 10);

  if (Math.abs(diferenca) < 0.005) {
    return {
      tipo: "vincular",
      ajuste: 0,
      texto: (
        <>
          Bate com o pagamento de {dataBr(pagamento.data)} ({moeda(pagamento.valor)}).
          {moverData && <> A data da baixa será movida para {quando}, a do banco.</>}
        </>
      ),
    };
  }

  return {
    tipo: "ajustar",
    ajuste: diferenca,
    texto: (
      <>
        O app registrou {moeda(pagamento.valor)} pagos em {dataBr(pagamento.data)}, o banco debitou {moeda(valor)}. Será lançado
        um <strong>{diferenca > 0 ? "ajuste de despesa" : "crédito"} de {moeda(Math.abs(diferenca))}</strong> na fatura
        {moverData && <> e a baixa será movida para {quando}</>}.
      </>
    ),
  };
}

/**
 * "Esta linha é o pagamento da fatura X": escolhe a fatura e mostra, antes de confirmar, o que o
 * app vai fazer para a fatura bater com o débito (pagar, pagamento parcial, ajustar).
 */
export function PagamentoFaturaModal({ item, faturas, faturaInicialId, onConfirmar, onClose }: Props) {
  const ordenadas = useMemo(
    () => [...faturas].sort((a, b) => diasEntre(a.due_date, item.transaction_date) - diasEntre(b.due_date, item.transaction_date)),
    [faturas, item.transaction_date]
  );

  const [faturaId, setFaturaId] = useState<number | null>(faturaInicialId ?? ordenadas[0]?.id ?? null);
  const [descricaoAjuste, setDescricaoAjuste] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const fatura = ordenadas.find((f) => f.id === faturaId) ?? null;
  const plano = fatura ? planoParaFatura(item, fatura) : null;
  const valor = valorExtrato(item.type, item.amount);
  const temAjuste = plano && Math.abs(plano.ajuste) >= 0.005;

  const confirmar = async () => {
    if (!fatura) return;

    setEnviando(true);
    setErro(null);

    try {
      await onConfirmar({ invoice_id: fatura.id, ajuste_descricao: descricaoAjuste.trim() || undefined });
      onClose();
    } catch (e) {
      setErro((e as ErroConciliacao).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          <i className="bi bi-credit-card me-2"></i>É pagamento de fatura
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="border rounded p-2 mb-3 bg-body-tertiary d-flex justify-content-between gap-2">
          <div>
            <div className="small text-muted">{dataBr(item.transaction_date)} · extrato</div>
            <div className="fw-semibold">{item.description}</div>
          </div>
          <div className={`fw-bold text-nowrap ${valor.classe}`}>{valor.texto}</div>
        </div>

        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        {ordenadas.length === 0 ? (
          <div className="text-center text-muted py-4">
            Nenhuma fatura de cartão pago por esta conta vence perto deste mês. Confira em Cartões se o cartão está ligado a
            esta conta.
          </div>
        ) : (
          <>
            <div className="small text-muted mb-2">Qual fatura?</div>
            <div className="list-group mb-3">
              {ordenadas.map((f) => {
                const bate = !f.paga
                  ? Math.abs(f.pendente - item.amount) < 0.005
                  : f.pagamentos.some((p) => !p.conciliado && Math.abs(p.valor - item.amount) < 0.005);

                return (
                  <label key={f.id} className={`list-group-item list-group-item-action d-flex gap-3 align-items-center ${faturaId === f.id ? "list-group-item-primary" : ""}`}>
                    <input type="radio" name="fatura" className="form-check-input mt-0" checked={faturaId === f.id} onChange={() => setFaturaId(f.id)} />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">
                        {f.cartao} · {mesAno(f.reference_month)}
                        {bate && <span className="badge text-bg-success ms-2">valor bate</span>}
                      </div>
                      <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
                        <span>Vence {dataBr(f.due_date)}</span>
                        <span>·</span>
                        <span>{f.paga ? `Paga (${moeda(f.pago)})` : `Pendente ${moeda(f.pendente)}`}</span>
                        <BadgeAuditoria auditoria={f.auditoria} />
                      </div>
                    </div>
                    <div className="fw-semibold text-nowrap">{moeda(f.total)}</div>
                  </label>
                );
              })}
            </div>

            {plano && (
              <div className={`alert ${plano.tipo === "sem_pagamento" ? "alert-warning" : temAjuste ? "alert-warning" : "alert-info"} mb-0`}>
                <div className="small fw-semibold text-uppercase mb-1">O que vai acontecer</div>
                <div>{plano.texto}</div>

                {temAjuste && (
                  <div className="mt-3">
                    <label className="form-label small mb-1">Descrição do ajuste (o que o banco cobrou a mais/menos?)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      maxLength={255}
                      placeholder="Ex.: IOF, juros do rotativo, anuidade..."
                      value={descricaoAjuste}
                      onChange={(e) => setDescricaoAjuste(e.target.value)}
                    />
                    <div className="small text-muted mt-1">
                      Se a diferença for uma compra esquecida, prefira lançá-la na fatura pela tela de Cartões e depois voltar aqui.
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmar} disabled={enviando || !fatura || plano?.tipo === "sem_pagamento"}>
          {enviando ? "Aplicando..." : "Confirmar e conferir"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
