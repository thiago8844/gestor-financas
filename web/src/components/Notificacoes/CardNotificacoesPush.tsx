import { usePush } from "../../hooks/usePush";
import { toast } from "../../utils/toast";

const ehIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Liga as notificações do sistema (celular/computador) mesmo com o app fechado. */
export function CardNotificacoesPush() {
  const { estado, ocupado, ativar, desativar } = usePush();

  const alternar = async () => {
    try {
      if (estado === "ativado") {
        await desativar();
        toast.success("Notificações desativadas neste dispositivo.");
      } else {
        await ativar();
      }
    } catch (error) {
      toast.error("Não foi possível alterar as notificações.", {
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  let ajuda = "Receba os avisos como notificação do aparelho, mesmo com o app fechado. Vale só para este dispositivo.";
  if (estado === "nao-suportado") {
    ajuda =
      ehIos() && !instalado()
        ? "No iPhone/iPad, instale o app na Tela de Início (Compartilhar > Adicionar à Tela de Início) e abra por lá para ativar."
        : "Este navegador não suporta notificações push.";
  } else if (estado === "bloqueado") {
    ajuda = "As notificações estão bloqueadas para este site. Libere nas configurações do navegador ou do aparelho.";
  }

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-body">
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="push_notifications"
            checked={estado === "ativado"}
            disabled={ocupado || estado === "carregando" || estado === "nao-suportado" || estado === "bloqueado"}
            onChange={alternar}
          />
          <label className="form-check-label fw-semibold" htmlFor="push_notifications">
            <i className="bi bi-phone-vibrate me-2 text-primary"></i>
            Notificações neste dispositivo
          </label>
        </div>
        <div className="form-text">{ajuda}</div>
      </div>
    </div>
  );
}
