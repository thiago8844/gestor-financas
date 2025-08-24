import { createBrowserRouter } from "react-router-dom";
import { DefaultLayout } from "./layouts/DefaultLayout";
import { Dashboard } from "./pages/Dashboard";
import { GuestLayout } from "./layouts/GuestLayout";
import { Login } from "./pages/Login";
import { Cadastro } from "./pages/Cadastro";
import Page404 from "./pages/Page404";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
    ],
  },
  {
    path: '/',
    element: <GuestLayout />,
    children: [
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/cadastro',
        element: <Cadastro />,
      },
    ],
  },
  {
    path: '*',
    element: <Page404 />,
  }
]);
