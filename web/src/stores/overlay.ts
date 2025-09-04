import { create } from "zustand";

type OverlayState = {
  isOpen: boolean;
  message: string | null;
  open: (message: string | null, autoCloseMs: number) => void;
  close: () => void;
};

export const useOverlayStore = create<OverlayState>((set) => ({
  isOpen: false,
  message: null,
  open: (message: string | null, autoCloseMs: number = 0) => {
    set({ isOpen: true, message });
    if (autoCloseMs > 0) {
      setTimeout(() => set({ isOpen: false, message: null }), autoCloseMs);
    }
  },
  close: () => set({ isOpen: false, message: null }),
}));
