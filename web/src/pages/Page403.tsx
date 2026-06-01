import { Link, useNavigate } from "react-router-dom";

export default function Page403() {
  const navigate = useNavigate();

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="text-center">
        {/* ÍCONE/NÚMERO 404 */}
        <h1
          className="display-1 fw-bold text-primary mb-4"
          style={{ fontSize: "8rem" }}
        >
          403
        </h1>

        {/* MENSAGEM */}
        <h2 className="mb-3">Acesso negado</h2>
        <p className="text-muted mb-4">
          Você não tem permissão para acessar esta página.
        </p>

        {/* BOTÕES */}
        <div className="d-flex gap-3 justify-content-center">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-outline-secondary"
          >
            <i className="bi bi-arrow-left me-2"></i>
            Voltar
          </button>
          <Link to="/" className="btn btn-primary">
            <i className="bi bi-house-door me-2"></i>
            Ir para Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
