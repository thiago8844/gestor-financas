import { create } from "zustand";
import type { SeveridadeNotificacao } from "../types/notificacao";

/**
 * Estado dos toasts. Toast = feedback temporário/persistente de uma operação; não é a central de
 * notificações (essa vem do servidor) e não grava nada no banco. Regras documentadas em docs/toasts-alertas.md.
 */

export type ToastKind = "success" | "error" | "warning" | "info" | "loading" | "neutral";
/** queued: na fila · visible: na tela · leaving: animando a saída (ainda ocupa a vaga). */
export type ToastStatus = "queued" | "visible" | "leaving";
export type ToastCloseReason = "manual" | "timeout" | "action" | "programmatic";

export type ToastAction = {
  label: string;
  /** Pode ser assíncrona: o botão fica bloqueado e mostra processamento até terminar. */
  onClick?: () => void | Promise<void>;
  /** Destino interno (rota). Alternativa a onClick. */
  to?: string;
  /** Fecha o toast depois de executar a ação (padrão: não fecha). */
  closeOnClick?: boolean;
};

export type ToastOptions = {
  id?: string;
  kind: ToastKind;
  title: string;
  message?: string;
  /** auto: some sozinho · manual: fica até ser fechado. Padrão depende do tipo. */
  dismiss?: "auto" | "manual";
  /** Duração em ms no modo auto. Padrão depende do tipo. */
  duration?: number;
  /** Persistente que fica visualmente discreto após 5s sem interação. */
  fadeWhenIdle?: boolean;
  action?: ToastAction;
  /** Mesma chave = mesmo toast (não empilha repetido). */
  dedupeKey?: string;
  onClose?: (reason: ToastCloseReason) => void;
};

export type ToastItem = Omit<ToastOptions, "id" | "dismiss" | "duration"> & {
  id: string;
  dismiss: "auto" | "manual";
  duration: number;
  status: ToastStatus;
  /** Muda quando o prazo automático deve recomeçar (troca de tipo). Mudar só o texto não muda. */
  timerEpoch: number;
};

/** Padrões por tipo (spec): sucesso/info/neutro 5s auto · atenção 8s auto · erro e carregando persistentes. */
export const PADROES_POR_TIPO: Record<ToastKind, { dismiss: "auto" | "manual"; duration: number }> = {
  success: { dismiss: "auto", duration: 5000 },
  info: { dismiss: "auto", duration: 5000 },
  neutral: { dismiss: "auto", duration: 5000 },
  warning: { dismiss: "auto", duration: 8000 },
  error: { dismiss: "manual", duration: 0 },
  loading: { dismiss: "manual", duration: 0 },
};

export const MAX_VISIVEIS_PADRAO = 3;
/** Limite da fila de espera. Ao estourar, descarta o toast automático mais antigo da fila (ver docs). */
export const MAX_FILA_PADRAO = 20;

/** Aliases das severidades antigas (notificações do servidor e primeiros usos de pushToast). */
type SeveridadeLegada = SeveridadeNotificacao | "success";

type ToastStore = {
  toasts: ToastItem[];
  maxVisible: number;
  maxQueue: number;
  setMaxVisible: (n: number) => void;
  show: (options: ToastOptions) => string | null;
  update: (id: string, patch: Partial<Omit<ToastOptions, "id" | "dedupeKey">>) => void;
  dismiss: (id: string, reason?: ToastCloseReason) => void;
  dismissAll: (options?: { includePersistent?: boolean }) => void;
  /** Chamado pelo viewport quando a animação de saída termina. */
  finalizeRemoval: (id: string) => void;
  /** Descarta tudo sem callbacks (logout / troca de usuário). */
  clear: () => void;
  /** API antiga, mantida para as notificações do servidor. */
  pushToast: (toast: { title: string; message: string; severity: SeveridadeLegada; delay?: number }) => void;
  dismissToast: (id: string) => void;
};

let sequencia = 1;
let epoca = 1;

const kindDaSeveridade: Record<SeveridadeLegada, ToastKind> = {
  success: "success",
  info: "info",
  warning: "warning",
  danger: "error",
};

function ehPersistente(t: Pick<ToastItem, "dismiss">) {
  return t.dismiss === "manual";
}

/** Promove itens da fila enquanto houver vaga (visíveis + em saída ocupam vaga). */
function promover(toasts: ToastItem[], maxVisible: number): ToastItem[] {
  let ocupadas = toasts.filter((t) => t.status !== "queued").length;
  if (ocupadas >= maxVisible) return toasts;

  return toasts.map((t) => {
    if (t.status === "queued" && ocupadas < maxVisible) {
      ocupadas++;
      return { ...t, status: "visible" as const };
    }
    return t;
  });
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  maxVisible: MAX_VISIVEIS_PADRAO,
  maxQueue: MAX_FILA_PADRAO,

  setMaxVisible: (n) => {
    const maxVisible = Math.max(1, Math.floor(n));
    set((s) => ({ maxVisible, toasts: promover(s.toasts, maxVisible) }));
  },

  show: (options) => {
    const { toasts, maxQueue, maxVisible } = get();

    // Deduplicação: mesma chave atualiza o toast existente em vez de empilhar outro.
    if (options.dedupeKey) {
      const existente = toasts.find((t) => t.dedupeKey === options.dedupeKey && t.status !== "leaving");
      if (existente) {
        get().update(existente.id, options);
        return existente.id;
      }
    }

    if (options.id && toasts.some((t) => t.id === options.id)) {
      get().update(options.id, options);
      return options.id;
    }

    const padrao = PADROES_POR_TIPO[options.kind];
    const item: ToastItem = {
      ...options,
      id: options.id ?? `toast-${sequencia++}`,
      dismiss: options.dismiss ?? padrao.dismiss,
      duration: options.duration ?? padrao.duration,
      status: "queued",
      timerEpoch: epoca++,
    };

    let proximos = [...toasts];
    const naFila = proximos.filter((t) => t.status === "queued");
    const vagaLivre = proximos.filter((t) => t.status !== "queued").length < maxVisible;

    if (!vagaLivre && naFila.length >= maxQueue) {
      // Fila cheia: sai o automático mais antigo da fila; se só houver persistentes, o novo é descartado.
      const descartavel = naFila.find((t) => !ehPersistente(t));
      if (descartavel) {
        proximos = proximos.filter((t) => t.id !== descartavel.id);
        descartavel.onClose?.("programmatic");
      } else {
        item.onClose?.("programmatic");
        return null;
      }
    }

    set({ toasts: promover([...proximos, item], maxVisible) });
    return item.id;
  },

  update: (id, rawPatch) => {
    // Chaves com undefined não podem apagar valores existentes.
    const patch = Object.fromEntries(Object.entries(rawPatch).filter(([, v]) => v !== undefined)) as typeof rawPatch;

    set((s) => ({
      toasts: s.toasts.map((t) => {
        if (t.id !== id || t.status === "leaving") return t;

        const trocouTipo = patch.kind !== undefined && patch.kind !== t.kind;
        const padrao = PADROES_POR_TIPO[patch.kind ?? t.kind];

        const proximo: ToastItem = { ...t, ...patch, id: t.id, status: t.status };
        if (trocouTipo) {
          // Troca de tipo (ex.: carregando -> sucesso) aplica o modo do novo tipo e recomeça o prazo.
          proximo.dismiss = patch.dismiss ?? padrao.dismiss;
          proximo.duration = patch.duration ?? padrao.duration;
          proximo.timerEpoch = epoca++;
        } else if (patch.dismiss !== undefined || patch.duration !== undefined) {
          proximo.timerEpoch = epoca++;
        }
        return proximo;
      }),
    }));
  },

  dismiss: (id, reason = "programmatic") => {
    const alvo = get().toasts.find((t) => t.id === id);
    if (!alvo || alvo.status === "leaving") return;

    if (alvo.status === "queued") {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    } else {
      set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, status: "leaving" as const } : t)) }));
    }
    alvo.onClose?.(reason);
  },

  dismissAll: ({ includePersistent = false } = {}) => {
    get()
      .toasts.filter((t) => includePersistent || !ehPersistente(t))
      .forEach((t) => get().dismiss(t.id, "programmatic"));
  },

  finalizeRemoval: (id) => {
    set((s) => ({ toasts: promover(s.toasts.filter((t) => t.id !== id), s.maxVisible) }));
  },

  clear: () => set({ toasts: [] }),

  pushToast: ({ title, message, severity, delay }) => {
    get().show({
      kind: kindDaSeveridade[severity],
      title,
      message,
      // Notificações do servidor e confirmações antigas sempre sumiam sozinhas.
      dismiss: "auto",
      duration: delay ?? (severity === "success" ? 5000 : 8000),
    });
  },

  dismissToast: (id) => get().dismiss(id, "manual"),
}));
