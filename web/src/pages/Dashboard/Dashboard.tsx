import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../layouts/PageLayout";
import { getDashboardData } from "../../api/dashboard";
import { useAuthStore } from "../../stores/auth";
import { convertNumberToCurrencyMask } from "../../utils";

export function Dashboard() {
  const { user } = useAuthStore();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardData(),
  });

  if (isError) {
    return (
      <PageLayout title="Erro ao carregar o dashboard">
        <div className="alert alert-danger">
          Erro ao carregar os dados do dashboard.
        </div>
      </PageLayout>
    );
  }

  console.log(data);

  return (
    <PageLayout title={`Bem-Vindo ${user?.name}`} loading={isLoading}>
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
                  {data ? convertNumberToCurrencyMask(data.entrada) : "--"}
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
                  {data ? convertNumberToCurrencyMask(data.saida) : "--"}
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
                    data && data.entrada_menos_saida >= 0
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {data
                    ? convertNumberToCurrencyMask(data.entrada_menos_saida)
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
                  {data
                    ? convertNumberToCurrencyMask(data.patrimonio_liquido)
                    : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
