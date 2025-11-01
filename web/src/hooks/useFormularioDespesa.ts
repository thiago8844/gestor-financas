import { useQuery } from "@tanstack/react-query";
import { getContas } from "../api/conta";
import { getCategorias } from "../api/categoria";

export function useFormularioDespesa() {
  //Contas
  const {
    data: contas,
    isLoading: isLoadingContas,
    isError: isErrorContas,
  } = useQuery({
    queryKey: ["contas", "active"],
    queryFn: () => getContas({ active: true, tipo: "INCOME" }),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  //CATEGORIAS
  const {
    data: categorias,
    isLoading: isLoadingCategorias,
    isError: isErrorCategorias,
  } = useQuery({
    queryKey: ["categorias"],
    queryFn: getCategorias,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  //ORÇAMENTOS IMPLEMENTAR DEPOIS
  const {
    data: orcamentos,
    isLoading: isLoadingOrcamentos,
    isError: isErrorOrcamentos,
  } = useQuery({
    queryKey: ["orcamentos", "active"],
    queryFn: () => {
      // TODO: Implementar getOrcamentos
      return Promise.resolve({ data: [] });
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    enabled: false,
  });

  return {
    contas: contas?.data || [],
    categorias: categorias?.data || [],
    orcamentos: orcamentos?.data || [],
    isLoading: isLoadingContas || isLoadingCategorias || isLoadingOrcamentos,
    isError: isErrorContas || isErrorCategorias || isErrorOrcamentos,
    isReady: !isLoadingContas && !isLoadingCategorias && !isLoadingOrcamentos,
  };
}
