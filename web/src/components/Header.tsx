import { useState } from "react";
import Sidebar from "./Sidebar";
import { useAuthStore } from "../stores/auth";

export default function Header() {
  const [show, setShow] = useState(false);
  const { logout } = useAuthStore();

  const handleClose = () => setShow(false);

  return (
    <>
      <header className="shadow">
        <div className="app-max-width p-2 mb-3 d-flex justify-content-between">
          <button
            className="d-flex align-items-center justify-content-center p-2 border-0 bg-transparent"
            onClick={() => setShow(true)}
          >
            <i
              className="bi bi-list fs-3 fw-bold"
              style={{ fontWeight: 900 }}
            ></i>
          </button>
          <div>
            <button className="btn d-flex align-items-center justify-content-center p-2">
              <i className="bi bi-person-circle fs-3"></i>
            </button>

            <button onClick={logout}>Log Out</button>
          </div>
        </div>
      </header>

      <Sidebar show={show} handleClose={handleClose} />
    </>
  );
}
