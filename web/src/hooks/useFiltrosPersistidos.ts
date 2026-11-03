import { useEffect, useState } from "react";

export const FILTROS_TTL_MS = 10 * 60 * 1000;

interface Armazenado<T> {
  filtros: T;
  filtrosModificados: T;
  expiraEm: number;
}

function ler<T extends object>(chave: string, originais: T): Armazenado<T> | null {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const salvo = JSON.parse(bruto) as Armazenado<T>;
    if (!salvo.expiraEm || salvo.expiraEm < Date.now()) {
      localStorage.removeItem(chave);
      return null;
    }
    // Mescla com os originais para tolerar filtros novos adicionados depois do salvamento
    return {
      expiraEm: salvo.expiraEm,
      filtros: { ...originais, ...salvo.filtros },
      filtrosModificados: { ...originais, ...salvo.filtrosModificados },
    };
  } catch {
    return null;
  }
}

/**
 * Filtros de listagem que sobrevivem à navegação. Cada acesso e cada alteração renovam
 * o prazo de 10 minutos; sem nenhuma interação nesse tempo, os filtros expiram.
 */
export function useFiltrosPersistidos<T extends object>(chave: string, originais: T) {
  const [inicial] = useState(() => ler(chave, originais));
  const [filtros, setFiltros] = useState<T>(inicial?.filtros ?? originais);
  const [filtrosModificados, setFiltrosModificados] = useState<T>(
    inicial?.filtrosModificados ?? originais,
  );

  // Roda na montagem (renova o prazo ao entrar na página) e a cada alteração
  useEffect(() => {
    try {
      const dados: Armazenado<T> = {
        filtros,
        filtrosModificados,
        expiraEm: Date.now() + FILTROS_TTL_MS,
      };
      localStorage.setItem(chave, JSON.stringify(dados));
    } catch {
      // Armazenamento indisponível: os filtros só não persistem
    }
  }, [chave, filtros, filtrosModificados]);

  const limpar = () => {
    setFiltros(originais);
    setFiltrosModificados(originais);
  };

  return { filtros, setFiltros, filtrosModificados, setFiltrosModificados, limpar };
}
