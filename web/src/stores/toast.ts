import { create } from "zustand";
import type { SeveridadeNotificacao } from "../types/notificacao";

type Toast = {
  id: number;
  title: string;
  message: string;
  // "success" é só de toasts de confirmação da própria tela (notificações do servidor não usam).
  severity: SeveridadeNotificacao | "success";
  /** Tempo na tela em ms (padrão 8s). Confirmações rápidas de ação usam menos para não empilhar. */
  delay?: number;
};

type ToastStore = {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
};

let proximoId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = proximoId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
