import { convertNumberToCurrencyMask } from "../../../utils";
import type { ResumoResultadoFinanceiro as ResumoResultadoFinanceiroType } from "../../../types/relatorio";

const LABEL_COMPARACAO: Record<string, string> = {
  PERIODO_ANTERIOR: "em relação ao período anterior",
  MESMO_PERIODO_ANO_ANTERIOR: "em relação ao mesmo período do ano anterior",
};

type Props = {
  resumo: ResumoResultadoFinanceiroType;
  compararCom?: string;
};

export function ResumoResultadoFinanceiro({ resumo, compararCom }: Props) {
  const resultadoPositivo = resumo.resultado >= 0;

  return (
    <div>
      <div className="row g-4 mb-4">
        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-arrow-down-circle-fill text-success me-2"></i>
                Receitas
              </span>
              <span className="fs-4 fw-semibold text-success">
                {convertNumberToCurrencyMask(resumo.receitas)}
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">
                <i className="bi bi-arrow-up-circle-fill text-danger me-2"></i>
                Despesas
              </span>
              <span className="fs-4 fw-semibold text-danger">
                {convertNumberToCurrencyMask(resumo.despesas)}
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">Resultado</span>
              <span className={`fs-4 fw-semibold ${resultadoPositivo ? "text-success" : "text-danger"}`}>
                {resultadoPositivo ? "+ " : "- "}
                {convertNumberToCurrencyMask(Math.abs(resumo.resultado))}
              </span>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body d-flex flex-column align-items-start">
              <span className="text-muted small mb-1">Margem</span>
              <span className="fs-4 fw-semibold">
                {resumo.margem !== null ? `${resumo.margem}%` : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {resumo.comparacao && resumo.comparacao.variacao_percentual !== null && (
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <span className={resumo.comparacao.variacao_percentual >= 0 ? "text-success" : "text-danger"}>
              <i className={`bi bi-arrow-${resumo.comparacao.variacao_percentual >= 0 ? "up" : "down"} me-1`}></i>
              {Math.abs(resumo.comparacao.variacao_percentual)}% no resultado{" "}
              {compararCom ? LABEL_COMPARACAO[compararCom] : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
