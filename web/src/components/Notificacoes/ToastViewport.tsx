import { Toast, ToastContainer } from "react-bootstrap";
import { useToastStore } from "../../stores/toast";

export function ToastViewport() {
  const { toasts, dismissToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <ToastContainer position="bottom-end" className="p-3" style={{ zIndex: 1080, position: "fixed" }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} show autohide delay={8000} onClose={() => dismissToast(toast.id)}>
          <Toast.Header>
            <i className={`bi bi-bell-fill me-2 text-${toast.severity}`}></i>
            <strong className="me-auto">{toast.title}</strong>
          </Toast.Header>
          <Toast.Body>{toast.message}</Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}
