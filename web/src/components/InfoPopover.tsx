import { OverlayTrigger, Popover } from "react-bootstrap";

export function InfoPopover({ text }: { text: string }) {
  return (
    <OverlayTrigger
      trigger={["hover", "focus"]}
      placement="right"
      overlay={
        <Popover>
          <Popover.Body className="small">{text}</Popover.Body>
        </Popover>
      }
    >
      <button
        type="button"
        className="btn btn-sm btn-link p-0 ms-2 text-muted"
        aria-label="Mais informações"
      >
        <i className="bi bi-info-circle"></i>
      </button>
    </OverlayTrigger>
  );
}
