import { Dropdown } from "react-bootstrap";
import type { Conta } from "../../../types";

interface Props {
  contas: Conta[] | undefined;
  /** Ids marcados. Vazio = todas as contas. */
  selecionadas: number[];
  onChange: (ids: number[]) => void;
  id: string;
}

/** Seleção de várias contas com checkboxes. Nenhuma marcada (ou todas) equivale a "Todas as contas". */
export function SeletorContas({ contas, selecionadas, onChange, id }: Props) {
  if (!contas || contas.length === 0) return null;

  const alternar = (contaId: number) => {
    const novas = selecionadas.includes(contaId)
      ? selecionadas.filter((c) => c !== contaId)
      : [...selecionadas, contaId];
    // Marcou todas = mesma coisa que não filtrar
    onChange(novas.length === contas.length ? [] : novas);
  };

  const rotulo =
    selecionadas.length === 0
      ? "Todas as contas"
      : selecionadas.length === 1
        ? (contas.find((c) => c.id === selecionadas[0])?.name ?? "1 conta")
        : `${selecionadas.length} contas`;

  return (
    <Dropdown autoClose="outside">
      <Dropdown.Toggle
        variant={selecionadas.length ? "primary" : "outline-secondary"}
        size="sm"
        id={id}
        style={{ minWidth: 160 }}
      >
        <i className="bi bi-wallet2 me-2"></i>
        {rotulo}
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ minWidth: 230, maxHeight: "50vh", overflowY: "auto" }}>
        <div className="px-3 py-1">
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none"
            onClick={() => onChange([])}
            disabled={selecionadas.length === 0}
          >
            Todas as contas
          </button>
        </div>
        <Dropdown.Divider />
        {contas.map((conta) => (
          <div key={conta.id} className="form-check px-3 py-1 ms-3">
            <input
              type="checkbox"
              className="form-check-input"
              id={`${id}-${conta.id}`}
              checked={selecionadas.includes(conta.id)}
              onChange={() => alternar(conta.id)}
            />
            <label className="form-check-label w-100" htmlFor={`${id}-${conta.id}`}>
              {conta.name}
            </label>
          </div>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
