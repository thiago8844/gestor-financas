import { create } from "zustand";
import type { SeveridadeNotificacao } from "../types/notificacao";

type Toast = {
  id: number;
  title: string;
  message: string;
  severity: SeveridadeNotificacao;
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
