import { Button, ListGroup, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useNotificacaoDigestStore } from "../../stores/notificacaoDigest";

export function NotificacaoDigestModal() {
  const { show, titulo, notificacoes, fechar } = useNotificacaoDigestStore();
  const navigate = useNavigate();

  return (
    <Modal show={show} onHide={fechar} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted">
          {notificacoes.length} notificações novas — dá uma olhada em cada uma.
        </p>
        <ListGroup>
          {notificacoes.map((notificacao) => (
            <ListGroup.Item
              key={notificacao.id}
              action
              onClick={() => {
                fechar();
                if (notificacao.action_url) {
                  navigate(notificacao.action_url);
                }
              }}
            >
              <div className="fw-semibold">{notificacao.title}</div>
              <div className="small text-muted">{notificacao.message}</div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={fechar}>
          Fechar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
