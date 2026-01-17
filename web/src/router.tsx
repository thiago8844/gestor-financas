import { createBrowserRouter } from "react-router-dom";
import { DefaultLayout } from "./layouts/DefaultLayout";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { GuestLayout } from "./layouts/GuestLayout";
import { Login } from "./pages/Login";
import { Cadastro } from "./pages/Cadastro";
import Page404 from "./pages/Page404";
import { ContaRoutes } from "./pages/Contas/ContaRoutes";

import Cadastrar from "./pages/Contas/Cadastrar";
import Editar from "./pages/Contas/Editar";

import { EditarDespesa } from "./pages/Despesa/EditarDespesa";
import { DespesaRoute } from "./pages/Despesa/DespesaRoute";
import { ListagemDespesa } from "./pages/Despesa/ListagemDespesa";
import { CadastrarDespesa } from "./pages/Despesa/CadastrarDespesa";
import { TesteCategoria } from "./pages/Contas/components/CategoriaAutocomplete";
import TesteTabela from "./pages/TesteTabela";
import { ListagemContas } from "./pages/Contas/ListagemContas";
import { ReceitaRoute } from "./pages/Receita/ReceitaRoute";
import { ListagemReceita } from "./pages/Receita/ListagemReceita";
import { CadastrarReceita } from "./pages/Receita/CadastrarReceita";
import { EditarReceita } from "./pages/Receita/EditarReceita";
import { ConsultorPage } from "./pages/Consultor/ConsultorPage";
import { CategoriaRoutes } from "./pages/Categorias/CategoriaRoutes";
import { ListagemCategorias } from "./pages/Categorias/ListagemCategorias";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <DefaultLayout />,
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
      {
        path: "contas",
        element: <ContaRoutes />,
        children: [
          { path: "", element: <ListagemContas /> },
          { path: "cadastrar", element: <Cadastrar /> },
          { path: "editar/:id", element: <Editar /> },
        ],
      },
      {
        path: "despesas",
        element: <DespesaRoute />,
        children: [
          { path: "", element: <ListagemDespesa /> },
          { path: "cadastrar", element: <CadastrarDespesa /> },
          { path: "editar/:id", element: <EditarDespesa /> },
        ],
      },
      {
        path: "receitas",
        element: <ReceitaRoute />,
        children: [
          { path: "", element: <ListagemReceita /> },
          { path: "cadastrar", element: <CadastrarReceita /> },
          { path: "editar/:id", element: <EditarReceita /> },
        ],
      },
      {
        path: "categorias",
        element: <CategoriaRoutes />,
        children: [{ path: "", element: <ListagemCategorias /> }],
      },
      {
        path: "consultor",
        element: <ConsultorPage />,
      },
      {
        path: "/teste-categoria",
        element: <TesteCategoria />,
      },
      {
        path: "/teste-tabela",
        element: <TesteTabela />,
      },
    ],
  },
  {
    path: "/",
    element: <GuestLayout />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/cadastro",
        element: <Cadastro />,
      },
    ],
  },
  {
    path: "*",
    element: <Page404 />,
  },
]);
