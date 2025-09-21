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

  //TODO: CRIAR SUBLINKS NO FUTURO

  return (
    <Offcanvas show={show} onHide={handleClose} id="main-sidebar">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>Gestor Finanças</Offcanvas.Title>
      </Offcanvas.Header>

      <Offcanvas.Body>
        <nav className="nav flex-column gap-1 ">
          <NavLink
            to="/"
            end
            className={(isActive) =>
              `nav-link rounded ${isActive ? "active" : ""}`
            }
          >
            <i className="bi bi-house"></i> Dashboard
          </NavLink>
          <NavLink
            to="/contas"
            className={({ isActive }) =>
              `nav-link rounded ${isActive ? "active" : ""}`
            }
          >
            <i className="bi bi-wallet2"></i> Contas
          </NavLink>

          <NavLink
            to="/transacoes"
            className={({ isActive }) =>
              `nav-link rounded ${isActive ? "active" : ""}`
            }
          >
            <i className="bi bi-cash-coin"></i> Transações
          </NavLink>

          <NavLink
            to="/categorias"
            className={({ isActive }) =>
              `nav-link rounded ${isActive ? "active" : ""}`
            }
          >
            <i className="bi bi-tags"></i> Categorias
          </NavLink>

          <NavLink
            to="/relatorios"
            className={({ isActive }) =>
              `nav-link rounded ${isActive ? "active" : ""}`
            }
          >
            <i className="bi bi-bar-chart"></i> Relatórios
          </NavLink>
        </nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
