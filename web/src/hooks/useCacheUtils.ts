import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook para gerenciar invalidações de cache de forma centralizada
 * 🎯 Mantém todos os caches organizados e atualizados
 */
export function useCacheUtils() {
  const queryClient = useQueryClient();

  // ✅ Invalidar dados relacionados a CONTAS
  const invalidateContas = () => {
    queryClient.invalidateQueries({ queryKey: ["contas"] });
  };

  // ✅ Invalidar dados relacionados a ORÇAMENTOS
  const invalidateOrcamentos = () => {
    queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
  };

  // ✅ Invalidar dados relacionados a CATEGORIAS
  const invalidateCategorias = () => {
    queryClient.invalidateQueries({ queryKey: ["categorias"] });
  };

  // ✅ Invalidar dados relacionados a DESPESAS
  const invalidateDespesas = () => {
    queryClient.invalidateQueries({ queryKey: ["despesas"] });
  };

  // ✅ Invalidar TODOS os dados de formulários
  const invalidateFormularios = () => {
    invalidateContas();
    invalidateOrcamentos();
    invalidateCategorias();
  };

  // ✅ Invalidar TUDO (use com cuidado)
  const invalidateAll = () => {
    queryClient.invalidateQueries();
  };

  // ✅ Forçar refetch de dados específicos
  const refetchContas = () => {
    queryClient.refetchQueries({ queryKey: ["contas"] });
  };

  // ✅ Remover cache específico
  const removeCache = (queryKey: unknown[]) => {
    queryClient.removeQueries({ queryKey });
  };

  return {
    // Invalidações específicas
    invalidateContas,
    invalidateOrcamentos,
    invalidateCategorias,
    invalidateDespesas,

    // Invalidações em grupo
    invalidateFormularios,
    invalidateAll,

    // Utilitários
    refetchContas,
    removeCache,
    queryClient, // Para casos específicos
  };
}
