import type { ToastKind } from "../../stores/toast";

/** Ícone (bootstrap-icons) e cor semântica (variável do tema Bootstrap) de cada tipo. Compartilhado com o alerta inline. */
export const VISUAL_POR_TIPO: Record<ToastKind, { icone: string; cor: string; rotulo: string }> = {
  success: { icone: "bi-check-circle-fill", cor: "var(--bs-success)", rotulo: "Sucesso" },
  error: { icone: "bi-x-octagon-fill", cor: "var(--bs-danger)", rotulo: "Erro" },
  warning: { icone: "bi-exclamation-triangle-fill", cor: "var(--bs-warning)", rotulo: "Atenção" },
  info: { icone: "bi-info-circle-fill", cor: "var(--bs-info)", rotulo: "Informação" },
  loading: { icone: "", cor: "var(--bs-primary)", rotulo: "Carregando" },
  neutral: { icone: "bi-dot", cor: "var(--bs-secondary)", rotulo: "Aviso" },
};
