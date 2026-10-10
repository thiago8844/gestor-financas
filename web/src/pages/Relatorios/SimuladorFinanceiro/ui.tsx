import type { ReactNode } from "react";
import { OverlayTrigger, Popover } from "react-bootstrap";
import type { Confianca, Natureza } from "../../../types/simulador";
import { CLASSE_CONFIANCA, ICONE_NATUREZA, LABEL_CONFIANCA, LABEL_NATUREZA } from "./utils";

export function Secao({
  titulo,
  icone,
  acoes,
  children,
  rodape,
  className = "",
  ajuda,
}: {
  titulo: ReactNode;
  icone?: string;
  acoes?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  className?: string;
  ajuda?: string;
}) {
  return (
    <div className={`card shadow-sm border-0 h-100 ${className}`}>
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h6 className="fw-bold mb-0 d-flex align-items-center">
            {icone && <i className={`bi ${icone} me-2 text-primary`}></i>}
            {titulo}
            {ajuda && <Ajuda texto={ajuda} />}
          </h6>
          {acoes}
        </div>
        {children}
        {rodape && <p className="text-muted small mt-3 mb-0">{rodape}</p>}
      </div>
    </div>
  );
}

export function Ajuda({ texto, titulo }: { texto: ReactNode; titulo?: string }) {
  return (
    <OverlayTrigger
      trigger={["hover", "focus"]}
      placement="top"
      overlay={
        <Popover>
          {titulo && <Popover.Header as="h6">{titulo}</Popover.Header>}
          <Popover.Body className="small">{texto}</Popover.Body>
        </Popover>
      }
    >
      <button type="button" className="btn btn-link p-0 ms-2 text-muted align-baseline" aria-label="Mais informações">
        <i className="bi bi-info-circle"></i>
      </button>
    </OverlayTrigger>
  );
}

export function BadgeConfianca({ nivel, prefixo = true }: { nivel: Confianca | "INSUFICIENTE" | "EVENTUAL" | null | undefined; prefixo?: boolean }) {
  if (!nivel) return null;
  const texto = LABEL_CONFIANCA[nivel];
  return (
    <span className={`badge ${CLASSE_CONFIANCA[nivel]} fw-normal`}>
      {prefixo && nivel !== "INSUFICIENTE" && nivel !== "EVENTUAL" ? `Confiança ${texto.toLowerCase()}` : texto}
    </span>
  );
}

export function BadgeNatureza({ natureza }: { natureza: Natureza }) {
  const classes: Record<Natureza, string> = {
    CONHECIDO: "text-bg-light border",
    RECORRENCIA: "text-bg-light border",
    ESTIMADO: "bg-primary-subtle text-primary-emphasis",
    HIPOTETICO: "",
    FATURA: "text-bg-light border",
  };
  return (
    <span
      className={`badge fw-normal ${classes[natureza]}`}
      style={natureza === "HIPOTETICO" ? { background: "rgba(111,66,193,.12)", color: "#59359a" } : undefined}
    >
      <i className={`bi ${ICONE_NATUREZA[natureza]} me-1`}></i>
      {LABEL_NATUREZA[natureza]}
    </span>
  );
}

export function Marcador({ cor, texto, tracejado }: { cor: string; texto: ReactNode; tracejado?: boolean }) {
  return (
    <div className="d-flex align-items-center gap-2 small">
      <span
        className="d-inline-block flex-shrink-0"
        style={{
          width: 10,
          height: tracejado ? 0 : 10,
          borderRadius: tracejado ? 0 : 3,
          background: tracejado ? "transparent" : cor,
          borderTop: tracejado ? `2px dashed ${cor}` : undefined,
        }}
      />
      <span>{texto}</span>
    </div>
  );
}

export function CaixaTooltip({ titulo, children, largura = 220 }: { titulo: ReactNode; children: ReactNode; largura?: number }) {
  return (
    <div className="card shadow border-0 p-2" style={{ minWidth: largura }}>
      <div className="fw-semibold small mb-1">{titulo}</div>
      {children}
    </div>
  );
}

export function Vazio({ icone = "bi-bar-chart-line", texto }: { icone?: string; texto: string }) {
  return (
    <div className="text-center text-muted py-5">
      <i className={`bi ${icone} fs-1 opacity-25`}></i>
      <p className="mt-2 small mb-0">{texto}</p>
    </div>
  );
}

export function Alternador<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: { valor: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="btn-group btn-group-sm" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={`btn ${valor === o.valor ? "btn-primary" : "btn-outline-primary"}`}
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

