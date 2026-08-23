import { useState } from "react";

export type ModoSelecao = "none" | "editar" | "excluir";

export function useSelecaoEmMassa() {
  const [modo, setModo] = useState<ModoSelecao>("none");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  const iniciar = (novoModo: "editar" | "excluir") => {
    setModo(novoModo);
    setSelecionados(new Set());
  };

  const cancelar = () => {
    setModo("none");
    setSelecionados(new Set());
  };

  const alternar = (id: number) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  };

  return {
    modo,
    ativo: modo !== "none",
    selecionados,
    quantidade: selecionados.size,
    iniciar,
    cancelar,
    alternar,
  };
}
