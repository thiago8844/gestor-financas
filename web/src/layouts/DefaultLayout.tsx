import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { Navigate, Outlet } from "react-router-dom";
import { useOverlayStore } from "../stores/overlay";
import Header from "../components/Header";
import { GlobalComponents } from "./GlobalComponents";

export function DefaultLayout() {
  const { token, user, fetchUser } = useAuthStore();
  const { open, close } = useOverlayStore();

  useEffect(() => {
    async function startUserFetch() {
      open(null, 0);

      await fetchUser();

      close();
    }

    if (!user && token) {
      startUserFetch();
    }
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />; //Esse mano causa flash da página de login
    //Mesmo começando como true, de alguma forma ele ainda está renderizando esse / login, se tirar esse código o flash para, mas o login nunca é renderizado
  }

  return (
    <div>

      <Header />

      <GlobalComponents/>

      {/*  Só mostra a página se tiver o user e o token*/}
      <main className="main-content app-max-width mx-auto">
        {user && token && <Outlet />}
      </main>
    </div>
  );
}
