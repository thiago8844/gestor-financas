import { brlComSinal, diaDaSemana, formatarDiaMes, ICONE_ORIGEM, rotuloOrigem } from "./formatadores";
import type { EventoCompromisso } from "../../../types/relatorio";

type Props = {
  eventos: EventoCompromisso[];
  limite?: number;
  onVerTodos?: () => void;
};

/** Lista cronológica curta do que vence primeiro — o "e agora, o que vem pela frente?". */
export function ProximosCompromissos({ eventos, limite = 8, onVerTodos }: Props) {
  const proximos = eventos.slice(0, limite);

  return (
    <div className="card shadow-sm border-0 h-100">
      <div className="card-body d-flex flex-column">
        <h6 className="fw-bold mb-3">
          <i className="bi bi-calendar-event me-2 text-primary"></i>
          Próximos compromissos
        </h6>

        {proximos.length === 0 ? (
          <div className="text-center text-muted py-4">
            <i className="bi bi-calendar-check fs-1 opacity-25"></i>
            <p className="mt-2 small mb-0">Nada a vencer no período.</p>
          </div>
        ) : (
          <ul className="list-unstyled mb-0 flex-grow-1">
            {proximos.map((evento) => (
              <li key={evento.id} className="d-flex align-items-center gap-3 py-2 border-bottom">
                <div className="text-center flex-shrink-0" style={{ width: 48 }}>
                  <div className="fw-semibold small">{formatarDiaMes(evento.data)}</div>
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                    {evento.atrasado ? "vencido" : diaDaSemana(evento.data)}
                  </div>
                </div>

                <div className="flex-grow-1 text-truncate">
                  <div className="text-truncate">{evento.descricao}</div>
                  <div className="text-muted small text-truncate">
                    <i className={`bi ${ICONE_ORIGEM[evento.origem]} me-1`}></i>
                    {rotuloOrigem(evento)}
                  </div>
                </div>

                <div className="text-end flex-shrink-0">
                  {evento.valor === null ? (
                    <span className="badge text-bg-light border">sem valor</span>
                  ) : (
                    <span className={`fw-semibold ${evento.tipo === "INCOME" ? "text-success" : "text-danger"}`}>
                      {evento.estimado && <span className="text-muted">≈ </span>}
                      {brlComSinal(evento.valor, evento.tipo)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {onVerTodos && eventos.length > limite && (
          <button type="button" className="btn btn-link btn-sm align-self-start px-0 mt-2" onClick={onVerTodos}>
            Ver todos os {eventos.length} compromissos
            <i className="bi bi-arrow-right ms-1"></i>
          </button>
        )}
      </div>
    </div>
  );
}
