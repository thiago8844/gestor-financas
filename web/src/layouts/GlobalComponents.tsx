import { Overlay } from "../components/Overlay";
import { ConfirmModal } from "../components/ConfirmModal";
import { ToastViewport } from "../components/Toast/ToastViewport";
import { NotificacaoDigestModal } from "../components/Notificacoes/NotificacaoDigestModal";
import { PushNavegacao } from "../components/Notificacoes/PushNavegacao";
import { NotificacoesWatcher } from "../components/Notificacoes/NotificacoesWatcher";

/**
 *
 * @returns Components globais do zustand
 */
export function GlobalComponents() {
  return (
    <>
      <Overlay />
      <ConfirmModal/>
      <NotificacoesWatcher />
      <PushNavegacao />
      <ToastViewport />
      <NotificacaoDigestModal />
    </>
  );
}
