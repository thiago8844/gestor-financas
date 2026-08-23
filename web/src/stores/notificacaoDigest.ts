import { create } from "zustand";
import type { Notificacao } from "../types/notificacao";

type NotificacaoDigestStore = {
  show: boolean;
  titulo: string;
  notificacoes: Notificacao[];
  abrir: (titulo: string, notificacoes: Notificacao[]) => void;
  fechar: () => void;
};

export const useNotificacaoDigestStore = create<NotificacaoDigestStore>((set) => ({
  show: false,
  titulo: "",
  notificacoes: [],
  abrir: (titulo, notificacoes) => set({ show: true, titulo, notificacoes }),
  fechar: () => set({ show: false, notificacoes: [] }),
}));
