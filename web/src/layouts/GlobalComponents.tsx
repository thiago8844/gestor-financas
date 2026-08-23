import { Overlay } from "../components/Overlay";
import { ConfirmModal } from "../components/ConfirmModal";
import { ToastViewport } from "../components/Notificacoes/ToastViewport";
import { NotificacaoDigestModal } from "../components/Notificacoes/NotificacaoDigestModal";
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
      <ToastViewport />
      <NotificacaoDigestModal />
    </>
  );
}
