import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { useToastStore } from "../../stores/toast";
import type { ErroConciliacao, RevisaoResponse } from "../../types/conciliacao";

/**
 * Executa uma ação da conciliação. Toda ação devolve a revisão inteira atualizada, que vai direto
 * para o cache da tela (sem refetch). Como uma ação pode criar lançamento, pagar fatura ou
 * mudar saldo, invalida também contas, faturas e o painel.
 */
export function useAcaoConciliacao(conciliacaoId: number) {
  const queryClient = useQueryClient();
  const { invalidateContas, invalidateFaturas, invalidateDespesas } = useCacheUtils();
  const pushToast = useToastStore((s) => s.pushToast);

  const mutation = useMutation({
    mutationFn: (executar: () => Promise<RevisaoResponse>) => executar(),
    onSuccess: (resposta) => {
      queryClient.setQueryData(["conciliacao", conciliacaoId], { data: resposta.data });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-painel"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacoes"] });
      invalidateContas();
      invalidateFaturas();
      invalidateDespesas();

      if (resposta.message) {
        // Curto: ao resolver linha atrás de linha, os avisos não podem empilhar sobre a lista.
        pushToast({ title: "Conciliação", message: resposta.message, severity: "success", delay: 3500 });
      }
    },
  });

  /** Promise que rejeita com a mensagem do servidor, para o modal mostrar o erro sem fechar. */
  const executar = (fn: () => Promise<RevisaoResponse>) =>
    mutation.mutateAsync(fn).catch((error: AxiosError<ErroConciliacao>) => {
      throw error.response?.data ?? { message: "Erro inesperado. Tente novamente." };
    });

  /** Para ações de um clique (sem modal): erro vira toast. */
  const executarComToast = (fn: () => Promise<RevisaoResponse>) =>
    executar(fn).catch((erro: ErroConciliacao) =>
      pushToast({ title: "Conciliação", message: erro.message, severity: "danger" })
    );

  return { executar, executarComToast, isPending: mutation.isPending };
}
