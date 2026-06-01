import { Offcanvas } from "react-bootstrap";
import "../styles/components/sidebar.scss";
import { NavLink } from "react-router-dom";

export default function Sidebar({
  show,
  handleClose,
}: {
  show: boolean;
  handleClose: () => void;
}) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link rounded ${isActive ? "active" : ""}`;

  return (
    <Offcanvas show={show} onHide={handleClose} id="main-sidebar">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>
          <span className="fw-bold">Gestor Finanças</span>
        </Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        <nav className="nav flex-column gap-1">
          <NavLink to="/" end onClick={handleClose} className={linkClass}>
            <i className="bi bi-house"></i> Dashboard
          </NavLink>

          <NavLink to="/contas" onClick={handleClose} className={linkClass}>
            <i className="bi bi-wallet2"></i> Contas
          </NavLink>

          <NavLink to="/despesas" onClick={handleClose} className={linkClass}>
            <i className="bi bi-arrow-down-circle"></i> Despesas
          </NavLink>

          <NavLink to="/receitas" onClick={handleClose} className={linkClass}>
            <i className="bi bi-arrow-up-circle"></i> Receitas
          </NavLink>

          <NavLink to="/consultor" onClick={handleClose} className={linkClass}>
            <i className="bi bi-chat-text"></i> Consultor IA
          </NavLink>

          <NavLink to="/categorias" onClick={handleClose} className={linkClass}>
            <i className="bi bi-tags"></i> Categorias
          </NavLink>

          <NavLink
            to="/orcamentos"
            onClick={(e) => e.preventDefault()}
            className={({ isActive }) =>
              `nav-link rounded ${isActive ? "active" : ""} disabled`
            }
          >
            <i className="bi bi-pie-chart"></i> Orçamentos (Em Breve)
          </NavLink>

          <NavLink
            to="/relatorios"
            onClick={(e) => e.preventDefault()}
            className={({ isActive }) =>
              `nav-link rounded ${isActive ? "active" : ""} disabled`
            }
          >
            <i className="bi bi-bar-chart"></i> Relatórios (Em Breve)
          </NavLink>
        </nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
