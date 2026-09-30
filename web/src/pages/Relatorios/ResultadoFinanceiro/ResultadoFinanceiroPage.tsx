import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../../layouts/PageLayout";
import { getRelatorioResultadoFinanceiro } from "../../../api/relatorios";
import { FiltrosResultadoFinanceiro } from "./FiltrosResultadoFinanceiro";
import { ResumoResultadoFinanceiro } from "./ResumoResultadoFinanceiro";
import { TabelaResultadoFinanceiro } from "./TabelaResultadoFinanceiro";
import { GraficosResultadoFinanceiro } from "./GraficosResultadoFinanceiro";
import { LancamentoDrawer } from "../FluxoCaixa/LancamentoDrawer";
import type { FiltrosResultadoFinanceiroParams } from "../../../types/relatorio";
import type { Transacao } from "../../../types/transacao";
import { textoContas } from "../periodoPresets";
import { useImprimirRelatorio } from "../../../hooks/useImprimirRelatorio";
import { BotaoImprimirRelatorio } from "../../../components/Relatorio/BotaoImprimirRelatorio";
import { RelatorioImprimivel } from "../../../components/Relatorio/RelatorioImprimivel";

const ABAS = ["resumo", "tabela", "graficos"] as const;
type Aba = (typeof ABAS)[number];

const LABEL_ABA: Record<Aba, string> = {
  resumo: "Resumo",
  tabela: "Tabela",
  graficos: "Gráficos",
};

const LABEL_REGIME: Record<string, string> = {
  CAIXA: "Regime de caixa",
  COMPETENCIA: "Regime de competência",
};

export function ResultadoFinanceiroPage() {
  const [filtros, setFiltros] = useState<FiltrosResultadoFinanceiroParams | null>(null);
  const [aba, setAba] = useState<Aba>("resumo");
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<Transacao | null>(null);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["relatorio-resultado-financeiro", filtros],
    queryFn: () => getRelatorioResultadoFinanceiro(filtros!),
    enabled: !!filtros,
  });

  const relatorio = data?.data;

  const { contentRef, imprimir } = useImprimirRelatorio(
    filtros
      ? `Resultado Financeiro ${filtros.data_inicial} a ${filtros.data_final}`
      : "Resultado Financeiro"
  );

  const resumoTexto = filtros
    ? `${filtros.data_inicial.split("-").reverse().join("/")} – ${filtros.data_final
        .split("-")
        .reverse()
        .join("/")} · ${textoContas(filtros.conta_ids)} · ${
        LABEL_REGIME[filtros.regime ?? "CAIXA"]
      }`
    : null;

  return (
    <PageLayout title="Resultado Financeiro" backTo="/relatorios">
      <p className="text-muted small mt-n3 mb-4">
        Visão simplificada de receitas, despesas e resultado.
      </p>

      <FiltrosResultadoFinanceiro gerado={!!filtros} resumoTexto={resumoTexto} onGerar={setFiltros} />

      {isError && <div className="alert alert-danger">Erro ao gerar o relatório. Tente novamente.</div>}

      {filtros && (isLoading || isFetching) && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
        </div>
      )}

      {relatorio && !isFetching && (
        <>
          <div className="d-flex justify-content-end mb-3">
            <BotaoImprimirRelatorio onClick={imprimir} />
          </div>

          <ul className="nav nav-tabs mb-4">
            {ABAS.map((valor) => (
              <li className="nav-item" key={valor}>
                <button
                  type="button"
                  className={`nav-link ${aba === valor ? "active" : ""}`}
                  onClick={() => setAba(valor)}
                >
                  {LABEL_ABA[valor]}
                </button>
              </li>
            ))}
          </ul>

          {aba === "resumo" && (
            <ResumoResultadoFinanceiro resumo={relatorio.resumo} compararCom={filtros?.comparar_com} />
          )}

          {aba === "tabela" && (
            <TabelaResultadoFinanceiro
              receitas={relatorio.receitas}
              despesas={relatorio.despesas}
              totalReceitas={relatorio.resumo.receitas}
              totalDespesas={relatorio.resumo.despesas}
              resultado={relatorio.resumo.resultado}
              onSelecionarTransacao={setTransacaoSelecionada}
            />
          )}

          {aba === "graficos" && (
            <GraficosResultadoFinanceiro
              serieMensal={relatorio.serie_mensal}
              despesasPorCategoria={relatorio.despesas}
            />
          )}
        </>
      )}

      {relatorio && !isFetching && (
        <RelatorioImprimivel
          contentRef={contentRef}
          titulo="Resultado Financeiro"
          filtrosTexto={resumoTexto}
          resumo={<ResumoResultadoFinanceiro resumo={relatorio.resumo} compararCom={filtros?.comparar_com} />}
          tabelas={
            <TabelaResultadoFinanceiro
              receitas={relatorio.receitas}
              despesas={relatorio.despesas}
              totalReceitas={relatorio.resumo.receitas}
              totalDespesas={relatorio.resumo.despesas}
              resultado={relatorio.resumo.resultado}
              modoImpressao
            />
          }
          graficos={
            <GraficosResultadoFinanceiro
              serieMensal={relatorio.serie_mensal}
              despesasPorCategoria={relatorio.despesas}
              modoImpressao
            />
          }
        />
      )}

      <LancamentoDrawer transacao={transacaoSelecionada} onClose={() => setTransacaoSelecionada(null)} />
    </PageLayout>
  );
}
