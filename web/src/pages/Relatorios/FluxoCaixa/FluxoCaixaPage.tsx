import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../../layouts/PageLayout";
import { getRelatorioFluxoCaixa } from "../../../api/relatorios";
import { FiltrosFluxoCaixa } from "./FiltrosFluxoCaixa";
import { ResumoFluxoCaixa } from "./ResumoFluxoCaixa";
import { TabelaFluxoCaixa } from "./TabelaFluxoCaixa";
import { GraficosFluxoCaixa } from "./GraficosFluxoCaixa";
import { LancamentosFluxoCaixa } from "./LancamentosFluxoCaixa";
import { LancamentoDrawer } from "./LancamentoDrawer";
import type { AgrupamentoRelatorio, FiltrosFluxoCaixaParams } from "../../../types/relatorio";
import type { Transacao } from "../../../types/transacao";

const ABAS = ["resumo", "tabela", "graficos", "lancamentos"] as const;
type Aba = (typeof ABAS)[number];

const LABEL_ABA: Record<Aba, string> = {
  resumo: "Resumo",
  tabela: "Tabela",
  graficos: "Gráficos",
  lancamentos: "Lançamentos",
};

const LABEL_REGIME: Record<string, string> = {
  CAIXA: "Regime de caixa",
  COMPETENCIA: "Regime de competência",
};

export function FluxoCaixaPage() {
  const [filtros, setFiltros] = useState<FiltrosFluxoCaixaParams | null>(null);
  const [aba, setAba] = useState<Aba>("resumo");
  const [transacaoSelecionada, setTransacaoSelecionada] = useState<Transacao | null>(null);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["relatorio-fluxo-caixa", filtros],
    queryFn: () => getRelatorioFluxoCaixa(filtros!),
    enabled: !!filtros,
  });

  const relatorio = data?.data;

  const resumoTexto = filtros
    ? `${filtros.data_inicial.split("-").reverse().join("/")} – ${filtros.data_final
        .split("-")
        .reverse()
        .join("/")} · ${filtros.conta_id ? "Conta selecionada" : "Todas as contas"} · ${
        LABEL_REGIME[filtros.regime ?? "CAIXA"]
      }`
    : null;

  const handleAgrupamentoChange = (agrupamento: AgrupamentoRelatorio) => {
    setFiltros((prev) => (prev ? { ...prev, agrupamento } : prev));
  };

  return (
    <PageLayout title="Fluxo de Caixa" backTo="/relatorios">
      <FiltrosFluxoCaixa gerado={!!filtros} resumoTexto={resumoTexto} onGerar={setFiltros} />

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
            <ResumoFluxoCaixa resumo={relatorio.resumo} compararCom={filtros?.comparar_com} />
          )}

          {aba === "tabela" && (
            <TabelaFluxoCaixa
              serie={relatorio.serie}
              agrupamento={filtros?.agrupamento ?? "DAILY"}
              onAgrupamentoChange={handleAgrupamentoChange}
              onSelecionarTransacao={setTransacaoSelecionada}
            />
          )}

          {aba === "graficos" && <GraficosFluxoCaixa serie={relatorio.serie} />}

          {aba === "lancamentos" && (
            <LancamentosFluxoCaixa
              lancamentos={relatorio.lancamentos}
              onSelecionarTransacao={setTransacaoSelecionada}
            />
          )}
        </>
      )}

      <LancamentoDrawer transacao={transacaoSelecionada} onClose={() => setTransacaoSelecionada(null)} />
    </PageLayout>
  );
}
