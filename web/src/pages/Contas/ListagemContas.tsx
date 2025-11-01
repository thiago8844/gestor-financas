import { useQuery } from "@tanstack/react-query";
import { getContas } from "../../api/conta";
import { TabelaContas } from "./components/TabelaContas";
import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";

export function ListagemContas() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["contas"],
    queryFn: () => getContas({}), // 🚨 Passa objeto vazio como filtro
    staleTime: 0, // 🚨 Dados sempre considerados stale
    gcTime: 0, // 🚨 Sem cache
    refetchOnMount: true, // 🚨 Sempre refetch quando montar
    refetchOnWindowFocus: true, // 🚨 Refetch quando voltar pra aba
  });

  if (isPending) {
    return <div>Carregando...</div>;
  }

  return (
    <PageLayout title="Contas" backTo="/">
      <Link to="/contas/cadastrar" className="btn btn-success mb-3">
        + Nova Conta
      </Link>

      {isError && <div>Ocorreu um erro: {(error as Error).message}</div>}

      <TabelaContas contas={data || []} />
    </PageLayout>
  );
}
