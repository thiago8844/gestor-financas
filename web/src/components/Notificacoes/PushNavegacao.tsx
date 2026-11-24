import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Componente invisível: quando o usuário toca numa notificação push com o app já aberto,
 * o service worker avisa e o app navega para a tela da notificação sem recarregar.
 */
export function PushNavegacao() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const aoReceber = (event: MessageEvent) => {
      if (event.data?.type !== "NAVIGATE" || typeof event.data.url !== "string") return;

      const destino = new URL(event.data.url);
      if (destino.origin === window.location.origin) {
        navigate(destino.pathname + destino.search + destino.hash);
      }
    };

    navigator.serviceWorker.addEventListener("message", aoReceber);
    return () => navigator.serviceWorker.removeEventListener("message", aoReceber);
  }, [navigate]);

  return null;
}
