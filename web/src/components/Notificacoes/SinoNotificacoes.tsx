import { Badge, Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useNotificacoes } from "../../hooks/useNotificacoes";
import type { Notificacao } from "../../types/notificacao";

const ICONE_POR_SEVERIDADE: Record<string, string> = {
  info: "text-info",
  warning: "text-warning",
  danger: "text-danger",
};

export function SinoNotificacoes() {
  const { notificacoes, naoLidasCount, marcarComoLida, marcarTodasComoLidas } = useNotificacoes();
  const navigate = useNavigate();

  const handleClickNotificacao = (notificacao: Notificacao) => {
    marcarComoLida(notificacao.id);
    if (notificacao.action_url) {
      navigate(notificacao.action_url);
    }
  };

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        className="btn-user d-flex align-items-center justify-content-center p-2 text-decoration-none position-relative"
        id="dropdown-notificacoes"
      >
        <i className="bi bi-bell fs-2 text-dark d-block"></i>
        {naoLidasCount > 0 && (
          <Badge bg="danger" pill className="position-absolute top-0 end-0" style={{ fontSize: "0.65rem" }}>
            {naoLidasCount > 99 ? "99+" : naoLidasCount}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ minWidth: "320px", maxHeight: "420px", overflowY: "auto" }}>
        <Dropdown.Header className="d-flex justify-content-between align-items-center">
          <span>Notificações</span>
          {naoLidasCount > 0 && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={(evento) => {
                evento.stopPropagation();
                marcarTodasComoLidas();
              }}
            >
              Marcar todas como lidas
            </button>
          )}
        </Dropdown.Header>
        <Dropdown.Divider />

        {notificacoes.length === 0 && (
          <div className="text-center text-muted py-3 small">Nenhuma notificação nova.</div>
        )}

        {notificacoes.map((notificacao) => (
          <Dropdown.Item
            key={notificacao.id}
            onClick={() => handleClickNotificacao(notificacao)}
            style={{ whiteSpace: "normal" }}
          >
            <div className="d-flex align-items-start gap-2">
              <i
                className={`bi bi-exclamation-circle-fill mt-1 ${
                  ICONE_POR_SEVERIDADE[notificacao.severity] ?? "text-secondary"
                }`}
              ></i>
              <div>
                <div className="fw-semibold small">{notificacao.title}</div>
                <div className="text-muted small">{notificacao.message}</div>
              </div>
            </div>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
