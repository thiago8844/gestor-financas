import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import type { ErroConciliacao, RevisaoResponse } from "../../../types/conciliacao";

type Props = {
  titulo: string;
  descricao: React.ReactNode;
  rotulo: string;
  placeholder?: string;
  obrigatorio?: boolean;
  confirmar: string;
  variante?: string;
  sugestoes?: string[];
  onConfirmar: (nota: string) => Promise<RevisaoResponse | void>;
  onClose: () => void;
};

/** Pergunta um motivo antes de adiar/ignorar/manter (fica registrado na auditoria do mês). */
export function MotivoModal({ titulo, descricao, rotulo, placeholder, obrigatorio, confirmar, variante = "primary", sugestoes = [], onConfirmar, onClose }: Props) {
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);

    try {
      await onConfirmar(nota.trim());
      onClose();
    } catch (e) {
      setErro((e as ErroConciliacao).message);
    } finally {
      setEnviando(false);
    }
  };

  const invalido = obrigatorio && nota.trim() === "";

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="small text-muted mb-3">{descricao}</div>
        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        <label className="form-label">
          {rotulo} {obrigatorio && <span className="text-danger">*</span>}
        </label>
        <textarea
          className="form-control"
          rows={2}
          maxLength={500}
          value={nota}
          placeholder={placeholder}
          autoFocus
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !invalido) {
              e.preventDefault();
              enviar();
            }
          }}
        />

        {sugestoes.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mt-2">
            {sugestoes.map((s) => (
              <button key={s} type="button" className="btn btn-sm btn-light border" onClick={() => setNota(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant={variante} onClick={enviar} disabled={enviando || invalido}>
          {enviando ? "Salvando..." : confirmar}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
