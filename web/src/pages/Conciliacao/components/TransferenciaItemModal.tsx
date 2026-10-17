import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import type { ErroConciliacao, ItemConciliacao, RevisaoResponse } from "../../../types/conciliacao";
import type { Conta } from "../../../types";
import { dataBr, valorExtrato } from "../conciliacaoUtils";

type Props = {
  item: ItemConciliacao;
  contaAtualId: number;
  contaAtualNome?: string;
  onConfirmar: (dados: { conta_id: number; description?: string }) => Promise<RevisaoResponse>;
  onClose: () => void;
};

/**
 * A linha é dinheiro indo/vindo de outra conta sua: cria a transferência (saída numa, entrada na
 * outra — não conta como despesa nem receita) e já confere este lado.
 */
export function TransferenciaItemModal({ item, contaAtualId, contaAtualNome, onConfirmar, onClose }: Props) {
  const { contas } = useFormularioTransacao();
  const outras = contas.filter((c: Conta) => c.id !== contaAtualId);

  const [contaId, setContaId] = useState(outras.length === 1 ? String(outras[0].id) : "");
  const [descricao, setDescricao] = useState(item.description ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const saida = item.type === "EXPENSE";
  const valor = valorExtrato(item.type, item.amount);
  const outraNome = outras.find((c: Conta) => String(c.id) === contaId)?.name ?? "outra conta";

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);

    try {
      await onConfirmar({ conta_id: Number(contaId), description: descricao.trim() || undefined });
      onClose();
    } catch (e) {
      setErro((e as ErroConciliacao).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          <i className="bi bi-arrow-left-right me-2"></i>É transferência entre minhas contas
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

        <div className="mb-3">
          <label className="form-label">{saida ? "Foi para qual conta?" : "Veio de qual conta?"}</label>
          <select className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)} autoFocus>
            <option value="">Selecione...</option>
            {outras.map((c: Conta) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="form-label">Descrição</label>
          <input type="text" className="form-control" maxLength={255} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>

        {contaId && (
          <div className="alert alert-info small py-2 mb-0">
            <i className="bi bi-info-circle me-1"></i>
            Será criada a transferência <strong>{saida ? contaAtualNome : outraNome}</strong> →{" "}
            <strong>{saida ? outraNome : contaAtualNome}</strong> em {dataBr(item.transaction_date)}. Não entra como
            despesa nem receita nos relatórios. O lado de {outraNome} confere sozinho quando você conciliar aquela conta.
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmar} disabled={enviando || !contaId}>
          {enviando ? "Lançando..." : "Lançar transferência e conferir"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
