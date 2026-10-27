import { useQueryClient } from "@tanstack/react-query";

/**
 * Baixar, reverter ou excluir parcelas cria/remove lançamentos, então além dos empréstimos
 * é preciso atualizar saldos de contas, indicadores do dashboard e notificações.
 */
export function useInvalidarEmprestimos() {
  const queryClient = useQueryClient();

  return () => {
    for (const key of ["emprestimos", "emprestimo", "emprestimos-resumo", "contas", "despesas", "receitas", "dashboard-indicadores", "dashboard-despesas-futuras", "notificacoes"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}
