import { create } from "zustand";

type ConfirmModalOptions = {
  callback: () => void;
  message?: string;
  title?: string;
  autoClose?: boolean;
  async?: boolean;
};

type ConfirmModalStore = {
  show: boolean;
  autoClose: boolean;
  async: boolean;
  title: string;
  message: string;
  callback: () => void;

  // ✅ Ações principais
  openModal: (options: ConfirmModalOptions) => void;
  closeModal: () => void;
  confirm: () => void;
};

export const useConfirmModalStore = create<ConfirmModalStore>((set, get) => ({
  show: false,
  async: false,
  autoClose: true,
  title: "Confirmação",
  message:
    "Tem certeza que deseja fazer isso? Esta ação não poderá ser desfeita.",
  callback: () => {},
  openModal: (options: ConfirmModalOptions) => {
    const currentState = get();
    set({
      show: true,
      callback: options.callback,
      autoClose: options.autoClose ?? currentState.autoClose,
      async: options.async ?? currentState.async,
      message: options.message ?? currentState.message,
      title: options.title ?? currentState.title,
    });
  },
  closeModal: () => {
    set({
      show: false,
      callback: () => {},
    });
  },
  confirm: () => {
    const { callback, autoClose } = get();
    callback();
    if (autoClose) {
      get().closeModal();
    }
  },
}));
