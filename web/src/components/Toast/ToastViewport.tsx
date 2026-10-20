import { useEffect } from "react";
import { useToastStore } from "../../stores/toast";
import { ToastCard } from "./ToastCard";

const ALTURA_MINIMA_POR_TOAST = 110;
const MARGEM_VERTICAL = 48;

/**
 * Renderiza os toasts visíveis (a fila não é renderizada, então nada é anunciado antes da hora).
 * Montado uma única vez no layout principal (GlobalComponents).
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const setMaxVisible = useToastStore((s) => s.setMaxVisible);

  // 3 visíveis no desktop, 2 no mobile; menos ainda se a altura da janela não comportar.
  useEffect(() => {
    const ajustar = () => {
      const base = window.innerWidth < 576 ? 2 : 3;
      const porAltura = Math.floor((window.innerHeight - MARGEM_VERTICAL) / ALTURA_MINIMA_POR_TOAST);
      setMaxVisible(Math.max(1, Math.min(base, porAltura)));
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, [setMaxVisible]);

  const visiveis = toasts.filter((t) => t.status !== "queued");

  return (
    <section className="toast-viewport" aria-label="Avisos">
      {visiveis.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </section>
  );
}
