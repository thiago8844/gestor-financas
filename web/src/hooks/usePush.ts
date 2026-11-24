import { useCallback, useEffect, useState } from "react";
import { getChavePublicaPush, registrarInscricaoPush, removerInscricaoPush } from "../api/push";

export type EstadoPush = "carregando" | "nao-suportado" | "bloqueado" | "desativado" | "ativado";

/** A chave VAPID vem em base64url; o PushManager exige bytes. */
function chaveParaBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

const suportado = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/**
 * Liga/desliga as notificações push do dispositivo atual. Cada navegador/celular tem a sua
 * própria inscrição, por isso o estado é lido do próprio PushManager.
 */
export function usePush() {
  const [estado, setEstado] = useState<EstadoPush>("carregando");
  const [ocupado, setOcupado] = useState(false);

  const atualizar = useCallback(async () => {
    if (!suportado()) return setEstado("nao-suportado");
    if (Notification.permission === "denied") return setEstado("bloqueado");

    const registro = await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.getSubscription();
    setEstado(inscricao && Notification.permission === "granted" ? "ativado" : "desativado");
  }, []);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  /** Precisa ser chamado por um clique/toque do usuário (exigência do iOS). */
  const ativar = useCallback(async () => {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return;

      const chave = await getChavePublicaPush();
      if (!chave) throw new Error("O servidor não está configurado para enviar notificações push.");

      const registro = await navigator.serviceWorker.ready;
      const inscricao =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));

      await registrarInscricaoPush(inscricao.toJSON());
    } finally {
      setOcupado(false);
      await atualizar();
    }
  }, [atualizar]);

  const desativar = useCallback(async () => {
    setOcupado(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      if (inscricao) {
        await removerInscricaoPush(inscricao.endpoint);
        await inscricao.unsubscribe();
      }
    } finally {
      setOcupado(false);
      await atualizar();
    }
  }, [atualizar]);

  return { estado, ocupado, ativar, desativar };
}
