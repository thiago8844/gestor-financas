import type { ReactNode } from "react";

type Props = {
  titulo: string;
  valor: string;
  detalhe?: ReactNode;
  icone: string;
  variante: "danger" | "success" | "warning" | "primary";
  onClick?: () => void;
  ativo?: boolean;
};

export function CardResumo({ titulo, valor, detalhe, icone, variante, onClick, ativo }: Props) {
  const conteudo = (
    <div className={`card shadow-sm h-100 border-0 border-start border-4 border-${variante} ${ativo ? "bg-body-tertiary" : ""}`}>
      <div className="card-body">
        <small className="text-muted d-block mb-1">
          <i className={`bi ${icone} text-${variante} me-2`}></i>
          {titulo}
        </small>
        <span className="fs-4 fw-semibold d-block">{valor}</span>
        {detalhe && <small className="text-muted">{detalhe}</small>}
      </div>
    </div>
  );

  if (!onClick) return conteudo;

  return (
    <button type="button" className="btn p-0 border-0 text-start w-100 h-100" onClick={onClick} aria-pressed={ativo}>
      {conteudo}
    </button>
  );
}
