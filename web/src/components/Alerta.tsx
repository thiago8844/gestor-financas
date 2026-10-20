import type { ReactNode } from "react";
import type { ToastKind } from "../stores/toast";
import { VISUAL_POR_TIPO } from "./Toast/toastVisual";

type Props = {
  tipo?: Exclude<ToastKind, "loading"> | "loading";
  titulo: string;
  descricao?: ReactNode;
  /** Lista de orientações exibida abaixo da descrição. */
  orientacoes?: string[];
  acao?: { rotulo: string; onClick: () => void; desabilitado?: boolean };
  /** Fechar só esconde o aviso; não resolve o problema financeiro ou de validação por trás dele. */
  onFechar?: () => void;
  className?: string;
};

/**
 * Alerta inline (dentro da página/formulário/seção). Usa os mesmos tipos, cores e ícones dos toasts,
 * não entra na fila e nunca some sozinho.
 */
export function Alerta({ tipo = "info", titulo, descricao, orientacoes, acao, onFechar, className = "" }: Props) {
  const visual = VISUAL_POR_TIPO[tipo];

  return (
    <div
      className={`alerta-inline ${className}`}
      style={{ ["--toast-accent" as string]: visual.cor }}
      role={tipo === "error" ? "alert" : "status"}
    >
      <span className="alerta-inline__icon" aria-hidden="true">
        {tipo === "loading" ? <span className="spinner-border spinner-border-sm" /> : <i className={`bi ${visual.icone}`}></i>}
      </span>

      <div className="alerta-inline__content">
        <div className="fw-semibold">{titulo}</div>
        {descricao && <div className="alerta-inline__desc">{descricao}</div>}
        {orientacoes && orientacoes.length > 0 && (
          <ul className="alerta-inline__list">
            {orientacoes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        )}
        {acao && (
          <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={acao.onClick} disabled={acao.desabilitado}>
            {acao.rotulo}
          </button>
        )}
      </div>

      {onFechar && (
        <button type="button" className="toast-card__close" aria-label="Fechar aviso" onClick={onFechar}>
          <i className="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}
