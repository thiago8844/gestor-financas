import React from "react";
import { useNavigate } from "react-router-dom";

export default function PageLayout({
  title,
  children,
  backTo,
  loading,
}: {
  title?: string;
  children: React.ReactNode;
  backTo?: string;
  loading?: boolean;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <div>
      {backTo && (
        <div
          onClick={handleBack}
          className="text-muted hover-link d-inline-block pe-4 pt-3 mb-4"
        >
          <i className="bi bi-arrow-left me-1"></i>
          Voltar
        </div>
      )}

      {title && <h2 className="d-flex align-items-center mb-5 mt-4">{title}</h2>}
      {loading && (
        <div className="mx-auto my-5" style={{ width: "3rem", height: "3rem" }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {!loading && <main>{children}</main>}
    </div>
  );
}
