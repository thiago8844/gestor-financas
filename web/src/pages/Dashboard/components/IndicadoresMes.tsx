import { convertNumberToCurrencyMask } from "../../../utils";

function IndicadoresMes(
  indicadoresMes: {
    entrada: number;
    saida: number;
    saldo: number;
    patrimonio_liquido: number;
  } | null
) {
  return (
    <div className="container py-4">
      <h5 className="mb-4 fw-bold">Dados do mês atual</h5>
      <div className="row g-4">
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-arrow-down-circle-fill text-success me-2"></i>
                Entradas
              </span>
              <span className="fs-4 fw-semibold text-success">
                {indicadoresMes
                  ? convertNumberToCurrencyMask(indicadoresMes.entrada)
                  : "--"}
              </span>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-arrow-up-circle-fill text-danger me-2"></i>
                Saídas
              </span>
              <span className="fs-4 fw-semibold text-danger">
                {indicadoresMes
                  ? convertNumberToCurrencyMask(indicadoresMes.saida)
                  : "--"}
              </span>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-calculator-fill text-primary me-2"></i>
                Saldo do mês
              </span>
              <span
                className={`fs-4 fw-semibold ${
                  indicadoresMes && indicadoresMes.saldo >= 0
                    ? "text-success"
                    : "text-danger"
                }`}
              >
                {indicadoresMes
                  ? convertNumberToCurrencyMask(indicadoresMes.saldo)
                  : "--"}
              </span>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-piggy-bank-fill text-warning me-2"></i>
                Patrimônio Líquido
              </span>
              <span className="fs-4 fw-semibold text-dark">
                {indicadoresMes
                  ? convertNumberToCurrencyMask(
                      indicadoresMes.patrimonio_liquido,
                    )
                  : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndicadoresMes;
