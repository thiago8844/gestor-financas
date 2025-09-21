import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { Navigate, Outlet } from "react-router-dom";
import { Overlay } from "../components/Overlay";
import { useOverlayStore } from "../stores/overlay";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

export function DefaultLayout() {
  const { token, user, fetchUser, logout } = useAuthStore();
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
  }, []);


  if (!token) {
    return <Navigate to="/login" replace />; //Esse mano causa flash da página de login
    //Mesmo começando como true, de alguma forma ele ainda está renderizando esse / login, se tirar esse código o flash para, mas o login nunca é renderizado
  }

  return (
    <div>
      <Overlay />
      <Header/>

      {/*  Só mostra a página se tiver o user e o token*/}
      {user && token && <Outlet />}
    </div>
  );
}
