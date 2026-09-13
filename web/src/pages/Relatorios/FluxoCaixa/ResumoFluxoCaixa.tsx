import { convertNumberToCurrencyMask } from "../../../utils";
import type { ResumoFluxoCaixa as ResumoFluxoCaixaType } from "../../../types/relatorio";

const LABEL_COMPARACAO: Record<string, string> = {
  PERIODO_ANTERIOR: "em relação ao período anterior",
  MESMO_PERIODO_ANO_ANTERIOR: "em relação ao mesmo período do ano anterior",
};

type Props = {
  resumo: ResumoFluxoCaixaType;
  compararCom?: string;
};

export function ResumoFluxoCaixa({ resumo, compararCom }: Props) {
  const resultadoPositivo = resumo.resultado_liquido >= 0;

  return (
    <div>
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">Saldo inicial</span>
              <span className="fs-4 fw-semibold">{convertNumberToCurrencyMask(resumo.saldo_inicial)}</span>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-arrow-down-circle-fill text-success me-2"></i>
                Entradas
              </span>
              <span className="fs-4 fw-semibold text-success">
                {convertNumberToCurrencyMask(resumo.entradas)}
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
                {convertNumberToCurrencyMask(resumo.saidas)}
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">Saldo final</span>
              <span className="fs-4 fw-semibold">{convertNumberToCurrencyMask(resumo.saldo_final)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span className="fw-semibold">
            Resultado líquido do período:{" "}
            <span className={resultadoPositivo ? "text-success" : "text-danger"}>
              {resultadoPositivo ? "+ " : "- "}
              {convertNumberToCurrencyMask(Math.abs(resumo.resultado_liquido))}
            </span>
          </span>

          {resumo.comparacao && resumo.comparacao.variacao_percentual !== null && (
            <span className={resumo.comparacao.variacao_percentual >= 0 ? "text-success" : "text-danger"}>
              <i className={`bi bi-arrow-${resumo.comparacao.variacao_percentual >= 0 ? "up" : "down"} me-1`}></i>
              {Math.abs(resumo.comparacao.variacao_percentual)}% {compararCom ? LABEL_COMPARACAO[compararCom] : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
