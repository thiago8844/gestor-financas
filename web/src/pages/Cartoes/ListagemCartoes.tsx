import { useQuery } from "@tanstack/react-query";
import { getCartoes } from "../../api/cartao";
import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { CartaoCard } from "./components/CartaoCard";
import type { Cartao } from "../../types/cartao";

export function ListagemCartoes() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["cartoes"],
    queryFn: () => getCartoes({}),
  });

  const cartoes: Cartao[] = data?.data || [];

  return (
    <PageLayout title="Cartões" backTo="/contas" loading={isPending}>
      <Link to="/cartoes/cadastrar" className="btn btn-success mb-3">
        + Novo Cartão
      </Link>

      {isError && <div>Ocorreu um erro: {(error as Error).message}</div>}

      <div className="row">
        {cartoes.map((cartao) => (
          <CartaoCard key={cartao.id} cartao={cartao} />
        ))}
      </div>

      {!isPending && cartoes.length === 0 && (
        <div className="text-center py-4">
          <p className="text-muted">Nenhum cartão cadastrado ainda.</p>
        </div>
      )}
    </PageLayout>
  );
}
