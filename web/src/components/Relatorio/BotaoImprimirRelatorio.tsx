type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export function BotaoImprimirRelatorio({ onClick, disabled }: Props) {
  return (
    <button type="button" className="btn btn-outline-secondary" onClick={onClick} disabled={disabled}>
      <i className="bi bi-file-earmark-pdf me-2"></i>
      Exportar PDF
    </button>
  );
}
