import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificacoes,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
} from "../api/notificacoes";

export const NOTIFICACOES_QUERY_KEY = ["notificacoes", "nao-lidas"];

export function useNotificacoes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICACOES_QUERY_KEY,
    queryFn: () => getNotificacoes({ apenas_nao_lidas: true, limit: 50 }),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: NOTIFICACOES_QUERY_KEY });

  const { mutate: marcarComoLida } = useMutation({
    mutationFn: marcarNotificacaoComoLida,
    onSuccess: invalidar,
  });

  const { mutate: marcarTodasComoLidas } = useMutation({
    mutationFn: marcarTodasNotificacoesComoLidas,
    onSuccess: invalidar,
  });

  return {
    notificacoes: query.data?.data ?? [],
    naoLidasCount: query.data?.nao_lidas_count ?? 0,
    isLoading: query.isLoading,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
