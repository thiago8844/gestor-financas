import { useState } from "react";
import type { Conta, TipoConta } from "../../../types";
import { ContaCard } from "./ContaCard";

interface TabelaProps {
  contas: {
    data: Conta[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any; // Para outros campos da paginação
  };
}

export function TabelaContas({ contas }: TabelaProps) {
  const [filtros] = useState({
    tipo: "INCOME" as TipoConta,
    busca: "",
  });

  const validarFiltros = (conta: Conta): boolean => {
    // Filtro por tipo
    if (conta.type !== filtros.tipo) return false;

    // Filtro por busca (se tiver)
    if (
      filtros.busca &&
      !conta.name.toLowerCase().includes(filtros.busca.toLowerCase())
    ) {
      return false;
    }

    return true;
  };

  const contasFiltradas = contas.data.filter(validarFiltros);

  return (
    <div>
      {/* Filtros */}
      <header className="mb-3 d-flex align-items-center justify-content-between">
        <div className="d-flex">
          {/* <div
            onClick={() => setFiltros({ ...filtros, tipo: "INCOME" })}
            className={`text-success  px-2 selected-conta ${
              filtros.tipo === "INCOME" ? "active" : ""
            }`}
          >
            Receita
          </div> */}
          {/* <div
            onClick={() => setFiltros({ ...filtros, tipo: "EXPENSE" })}
            className={`text-danger selected-tab px-2 selected-conta ${
              filtros.tipo === "EXPENSE" ? "active" : ""
            }`}
          >
            Despesa
          </div> */}
        </div>
      </header>

      {/* Listagem */}
      <div className="row">

        {contasFiltradas.map((conta) => <ContaCard key={conta.id} conta={conta} />)}
      </div>

      {/* Nenhum resultado */}
      {contasFiltradas.length === 0 && (
        <div className="text-center py-4">
          <p className="text-muted">
            Nenhuma conta encontrada para este filtro.
          </p>
        </div>
      )}
    </div>
  );
}
