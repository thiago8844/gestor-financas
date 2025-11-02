import { useState } from "react";
import { Dropdown } from "react-bootstrap";
import Sidebar from "./Sidebar";
import { useAuthStore } from "../stores/auth";
import "../styles/components/header.scss";
export default function Header() {
  const [show, setShow] = useState(false);
  const { logout } = useAuthStore();

  const handleClose = () => setShow(false);

  return (
    <>
      <header className="header-custom shadow">
        <div className="app-max-width p-3 d-flex justify-content-between align-items-center">
          {/* ✅ LADO ESQUERDO: HAMBÚRGUER + LOGO + TÍTULO */}
          <div className="d-flex align-items-center gap-3">
            <button
              className="btn-hamburger d-flex align-items-center justify-content-center p-2 border-0 bg-transparent"
              onClick={() => setShow(true)}
              aria-label="Menu"
            >
              <i className="bi bi-list fs-2"></i>
            </button>

            <div className="d-flex align-items-center gap-2">
              <img
                src="/images/logo.svg"
                alt="Logo Gestor Finanças"
                className="header-logo"
              />
              <h1 className="header-title mb-0 d-none d-md-block">
                Gestor Finanças
              </h1>
            </div>
          </div>

          {/* ✅ LADO DIREITO: DROPDOWN DO USUÁRIO */}
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              className="btn-user d-flex align-items-center justify-content-center p-2 text-decoration-none"
              id="dropdown-user"
            >
              <i className="bi bi-person-circle fs-2 text-dark"></i>
            </Dropdown.Toggle>

            <Dropdown.Menu>
              <Dropdown.Header>
                <i className="bi bi-person-circle me-2"></i>
                Minha Conta
              </Dropdown.Header>
              <Dropdown.Divider />
              <Dropdown.Item onClick={logout}>
                <i className="bi bi-box-arrow-right me-2"></i>
                Sair
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </header>

      <Sidebar show={show} handleClose={handleClose} />
    </>
  );
}
