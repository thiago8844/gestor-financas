import { Button, Modal } from "react-bootstrap";
import { useConfirmModalStore } from "../stores/confirmModal";

export function ConfirmModal() {

  const { title, message, closeModal, show, confirm } = useConfirmModalStore();

  return (
    <Modal show={show} onHide={closeModal}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={closeModal}>
          Fechar
        </Button>
        <Button variant="primary" onClick={confirm}>
          Confirmar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
