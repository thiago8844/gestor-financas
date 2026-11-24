import { useQuery } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { getEmprestimo } from "../../api/emprestimos";
import { CadastrarEmprestimo } from "./CadastrarEmprestimo";

/** Edição das condições (valor, taxa, prazo, vencimentos) de um empréstimo sem baixas nem ajustes. */
export function EditarEmprestimo() {
  const emprestimoId = Number(useParams().id);

  const { data: emprestimo, isLoading, isError } = useQuery({
    queryKey: ["emprestimo", emprestimoId],
    queryFn: () => getEmprestimo(emprestimoId),
    enabled: Number.isFinite(emprestimoId),
  });

  if (isLoading) return <PageLayout title="Editar condições" backTo="/emprestimos" loading><></></PageLayout>;
  if (isError || !emprestimo) return <Navigate to="/emprestimos" replace />;
  // Depois de baixas ou ajustes o servidor recusaria; nem abre o formulário.
  if (!emprestimo.contrato_editavel) return <Navigate to={`/emprestimos/${emprestimo.id}`} replace />;

  return <CadastrarEmprestimo emprestimo={emprestimo} />;
}
