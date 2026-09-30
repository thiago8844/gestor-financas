import { useQuery } from "@tanstack/react-query";
import { getContas } from "../api/conta";
import { getCartoes } from "../api/cartao";
import { getCategorias, type CategoriasResponse } from "../api/categoria";
import { getOrcamentos } from "../api/orcamentos";

export function useFormularioTransacao() {
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

  //Cartões
  const {
    data: cartoes,
    isLoading: isLoadingCartoes,
    isError: isErrorCartoes,
  } = useQuery({
    queryKey: ["cartoes", "active"],
    queryFn: () => getCartoes({ active: true }),
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
  } = useQuery<CategoriasResponse>({
    queryKey: ["categorias"],
    queryFn: () => getCategorias(),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  //ORÇAMENTOS
  const {
    data: orcamentos,
    isLoading: isLoadingOrcamentos,
    isError: isErrorOrcamentos,
  } = useQuery({
    queryKey: ["orcamentos", "active"],
    queryFn: () => getOrcamentos({ active: true }),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    contas: contas?.data || [],
    cartoes: cartoes?.data || [],
    categorias: categorias?.data ?? [],
    orcamentos: orcamentos?.data || [],
    isLoading: isLoadingContas || isLoadingCartoes || isLoadingCategorias || isLoadingOrcamentos,
    isError: isErrorContas || isErrorCartoes || isErrorCategorias || isErrorOrcamentos,
    isReady: !isLoadingContas && !isLoadingCartoes && !isLoadingCategorias && !isLoadingOrcamentos,
  };
}
