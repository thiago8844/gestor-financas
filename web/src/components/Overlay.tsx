import { useOverlayStore } from "../stores/overlay";

export function Overlay() {

  const {isOpen, message} = useOverlayStore(); 

  if (!isOpen) return null;

  return (
    <div className="overlay">
      <div className="overlay-content">
        <div className="spinner-border text-light" role="status" />
        <p>{message}</p>
      </div>
    </div>
  );
}
