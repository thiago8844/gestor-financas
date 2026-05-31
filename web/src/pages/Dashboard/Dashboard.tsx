import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../layouts/PageLayout";
import {
  getIndicadoresDashboard,
  getSaldoContas,
  getTransacoesCategoria,
} from "../../api/dashboard";
import { useAuthStore } from "../../stores/auth";

import IndicadoresMes from "./components/IndicadoresMes";
import { SaldoPorContaPeriodo } from "./components/SaldoPorContaPeriodo";
import { TransacaoCategoria } from "./components/TransacaoCategoria";
import type { SaldoFiltroParams } from "./components/SaldoPorContaPeriodo";
import type { CategoriaFiltroParams } from "./components/TransacaoCategoria";

export function Dashboard() {
  const { user } = useAuthStore();

  // Cada gráfico tem seu próprio estado de filtro e sua própria query —
  // filtrar um não recarrega os outros.
  const [saldoFiltros, setSaldoFiltros] = useState<SaldoFiltroParams>({});
  const [categoriaFiltros, setCategoriaFiltros] =
    useState<CategoriaFiltroParams>({});

  const { data: indicadores, isLoading: loadingIndicadores } = useQuery({
    queryKey: ["dashboard-indicadores"],
    queryFn: getIndicadoresDashboard,
  });

  const { data: saldoContas, isLoading: loadingSaldo } = useQuery({
    queryKey: ["dashboard-saldo-contas", saldoFiltros],
    queryFn: () =>
      getSaldoContas({
        alltime: saldoFiltros.saldosContasAlltime,
        dataInicial: saldoFiltros.saldosContasDataInicial,
        dataFinal: saldoFiltros.saldosContasDataFinal,
        intervalo: saldoFiltros.saldosContasIntervalo,
      }),
  });

  const { data: categorias, isLoading: loadingCategorias } = useQuery({
    queryKey: ["dashboard-transacoes-categoria", categoriaFiltros],
    queryFn: () =>
      getTransacoesCategoria({
        despesasAlltime: categoriaFiltros.despesasCategoriaAlltime,
        despesasDataInicial: categoriaFiltros.despesasCategoriaDataInicial,
        despesasDataFinal: categoriaFiltros.despesasCategoriaDataFinal,
        receitasAlltime: categoriaFiltros.receitasCategoriaAlltime,
        receitasDataInicial: categoriaFiltros.receitasCategoriaDataInicial,
        receitasDataFinal: categoriaFiltros.receitasCategoriaDataFinal,
      }),
  });

  const isLoading = loadingIndicadores && loadingSaldo && loadingCategorias;

  return (
    <PageLayout title={`Bem-Vindo ${user?.name}`} loading={isLoading}>
      {/* Cards de indicadores do mês */}
      {indicadores && <IndicadoresMes {...indicadores} />}

      <div className="container py-2">
        {/* Saldo por conta ao longo do tempo */}
        <div className="row mb-4">
          <div className="col-12">
            <SaldoPorContaPeriodo
              data={saldoContas}
              onFiltroChange={setSaldoFiltros}
            />
          </div>
        </div>

        {/* Despesas e Receitas por categoria */}
        <div className="row mb-4">
          <div className="col-12">
            <TransacaoCategoria
              despesas={categorias?.despesas_por_categoria}
              receitas={categorias?.receitas_por_categoria}
              onFiltroChange={setCategoriaFiltros}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
