import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import type { ErroConciliacao, RevisaoConciliacao, RevisaoResponse } from "../../../types/conciliacao";
import { dataBr, mesAno, moeda } from "../conciliacaoUtils";

type Props = {
  revisao: RevisaoConciliacao;
  onFinalizar: (observacao?: string) => Promise<RevisaoResponse>;
  onClose: () => void;
};

/** Confirmação do fechamento do mês: mostra o retrato que vai ficar registrado. */
export function FinalizarConciliacaoModal({ revisao, onFinalizar, onClose }: Props) {
  const { resumo, saldo, conciliacao } = revisao;
  const saldoDiverge = saldo.diferenca !== null && Math.abs(saldo.diferenca) >= 0.005;
  // Lançamentos confirmados como "só no app" mexem no saldo do app e não no do banco: explicam parte da diferença.
  const explicadoPorSoNoApp = -revisao.itens
    .filter((i) => i.source === "APP")
    .reduce((soma, i) => soma + (i.type === "INCOME" ? i.amount : -i.amount), 0);
  const restoSemExplicacao = (saldo.diferenca ?? 0) - explicadoPorSoNoApp;

  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const finalizar = async () => {
    setEnviando(true);
    setErro(null);

    try {
      await onFinalizar(observacao.trim() || undefined);
      onClose();
    } catch (e) {
      setErro((e as ErroConciliacao).message);
    } finally {
      setEnviando(false);
    }
  };

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <li className="list-group-item d-flex justify-content-between px-0">
      <span className="text-muted">{rotulo}</span>
      <span className="fw-semibold">{valor}</span>
    </li>
  );

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          <i className="bi bi-lock me-2"></i>
          Finalizar {conciliacao.conta?.name} · {mesAno(conciliacao.reference_month)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        <ul className="list-group list-group-flush small mb-3">
          {linha("Linhas do extrato", resumo.linhas)}
          {linha("Conferidas (automático / manual)", `${resumo.conciliadas_auto} / ${resumo.conciliadas - resumo.conciliadas_auto}`)}
          {linha("Ignoradas com motivo", resumo.ignoradas)}
          {linha("Só no app, confirmados", resumo.mantidos_so_no_app)}
          {linha("Entradas / saídas no extrato", `${moeda(resumo.entradas)} / ${moeda(resumo.saidas)}`)}
          {saldo.banco !== null && linha(`Saldo do banco em ${dataBr(saldo.data)}`, moeda(saldo.banco))}
          {linha(`Saldo no app em ${dataBr(saldo.data)}`, moeda(saldo.app))}
        </ul>

        {saldoDiverge ? (
          <div className="alert alert-warning small">
            <i className="bi bi-exclamation-triangle me-1"></i>
            Todas as linhas foram resolvidas, mas o saldo do app difere do banco em <strong>{moeda(Math.abs(saldo.diferenca ?? 0))}</strong>.
            {Math.abs(explicadoPorSoNoApp) >= 0.005 && (
              <> {moeda(Math.abs(explicadoPorSoNoApp))} vêm dos lançamentos que você confirmou como "só no app".</>
            )}
            {Math.abs(restoSemExplicacao) >= 0.005 && (
              <> {Math.abs(explicadoPorSoNoApp) >= 0.005 ? `O restante (${moeda(Math.abs(restoSemExplicacao))})` : "Isso"} normalmente é saldo inicial da conta diferente ou algo de meses anteriores.</>
            )}{" "}
            Explique abaixo para finalizar.
          </div>
        ) : (
          <div className="alert alert-success small">
            <i className="bi bi-check-circle me-1"></i>
            {saldo.banco !== null ? "Saldo do app bate com o do banco." : "O extrato não trouxe saldo final; a conferência foi linha a linha."}
          </div>
        )}

        <label className="form-label">
          Observação {saldoDiverge ? <span className="text-danger">*</span> : <span className="text-muted small">(opcional)</span>}
        </label>
        <textarea className="form-control" rows={2} maxLength={2000} value={observacao} onChange={(e) => setObservacao(e.target.value)} />

        <p className="small text-muted mt-3 mb-0">
          O retrato deste fechamento fica guardado no histórico. Dá para reabrir depois, se precisar corrigir algo.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Voltar
        </Button>
        <Button variant="success" onClick={finalizar} disabled={enviando || (saldoDiverge && observacao.trim() === "")}>
          {enviando ? "Finalizando..." : "Finalizar mês"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
