import { Dropdown } from "react-bootstrap";
import type { ModoSelecao } from "../../hooks/useSelecaoEmMassa";

type Props = {
  modo: ModoSelecao;
  quantidade: number;
  onIniciar: (modo: "editar" | "excluir") => void;
  onCancelar: () => void;
  onProsseguir: () => void;
};

export function AcoesEmMassa({ modo, quantidade, onIniciar, onCancelar, onProsseguir }: Props) {
  if (modo === "none") {
    return (
      <Dropdown>
        <Dropdown.Toggle variant="outline-secondary" id="acoes-em-massa-dropdown">
          <i className="bi bi-list-check me-2"></i>
          Ações
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <Dropdown.Item onClick={() => onIniciar("editar")}>
            <i className="bi bi-pencil me-2"></i>
            Editar selecionadas
          </Dropdown.Item>
          <Dropdown.Item onClick={() => onIniciar("excluir")} className="text-danger">
            <i className="bi bi-trash me-2"></i>
            Excluir selecionadas
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  return (
    <div className="d-flex align-items-center gap-2">
      <span className="text-muted small">
        {quantidade} selecionada{quantidade !== 1 ? "s" : ""}
      </span>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancelar}>
        Cancelar
      </button>
      <button
        type="button"
        className={`btn btn-sm ${modo === "excluir" ? "btn-danger" : "btn-primary"}`}
        onClick={onProsseguir}
        disabled={quantidade === 0}
      >
        <i className={`bi ${modo === "excluir" ? "bi-trash" : "bi-pencil"} me-1`}></i>
        Prosseguir
      </button>
    </div>
  );
}
