import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "../../../layouts/PageLayout";
import { getRelatorioAnaliseGastos } from "../../../api/relatorios";
import { BotaoImprimirRelatorio } from "../../../components/Relatorio/BotaoImprimirRelatorio";
import { RelatorioImprimivel } from "../../../components/Relatorio/RelatorioImprimivel";
import { useImprimirRelatorio } from "../../../hooks/useImprimirRelatorio";
import { textoContas } from "../periodoPresets";
import { formatarDataBR } from "../CompromissosFuturos/formatadores";
import { FiltrosAnaliseGastos } from "./FiltrosAnaliseGastos";
import { ResumoAnaliseGastos } from "./ResumoAnaliseGastos";
import { GraficoMesesGastos } from "./GraficoMesesGastos";
import { MeiosEMaioresGastos } from "./MeiosEMaioresGastos";
import { NaturezasGastos } from "./NaturezasGastos";
import { CategoriasGastos } from "./CategoriasGastos";
import { LancamentosGastos } from "./LancamentosGastos";
import type { FiltrosAnaliseGastosParams } from "../../../types/relatorio";

const ABAS = ["visao", "tipos", "categorias", "lancamentos"] as const;
type Aba = (typeof ABAS)[number];

const LABEL_ABA: Record<Aba, string> = {
  visao: "Visão geral",
  tipos: "Fixas e variáveis",
  categorias: "Por categoria",
  lancamentos: "Lançamentos",
};

const ICONE_ABA: Record<Aba, string> = {
  visao: "bi-speedometer2",
  tipos: "bi-pin-angle",
  categorias: "bi-tags",
  lancamentos: "bi-list-check",
};

export function AnaliseGastosPage() {
  const [filtros, setFiltros] = useState<FiltrosAnaliseGastosParams | null>(null);
  const [aba, setAba] = useState<Aba>("visao");

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["relatorio-analise-gastos", filtros],
    queryFn: () => getRelatorioAnaliseGastos(filtros!),
    enabled: !!filtros,
    refetchOnWindowFocus: false,
  });

  const relatorio = data?.data;

  const { contentRef, imprimir } = useImprimirRelatorio(
    filtros ? `Análise dos Gastos ${filtros.data_inicial} a ${filtros.data_final}` : "Análise dos Gastos"
  );

  const resumoTexto = relatorio
    ? [
        `${formatarDataBR(relatorio.periodo.data_inicial)} a ${formatarDataBR(relatorio.periodo.data_final)}`,
        textoContas(filtros?.conta_ids),
        relatorio.filtros.origem === "CARTAO" ? "Só cartão" : relatorio.filtros.origem === "CONTA" ? "Só contas financeiras" : "Cartão e contas",
        relatorio.filtros.base_data === "PAGAMENTO" ? "Pela data do pagamento" : "Pela data do gasto",
      ].join(" · ")
    : null;

  return (
    <PageLayout title="Análise dos Gastos" backTo="/relatorios">
      <p className="text-muted small mt-n3 mb-4">
        Como o seu dinheiro é gasto: o que é fixo, o que varia, o que já foi pago e o que ainda vem pela frente — em
        qualquer período, passado ou futuro.
      </p>

      <FiltrosAnaliseGastos gerado={!!relatorio} resumoTexto={resumoTexto} onGerar={setFiltros} />

      {isError && <div className="alert alert-danger">Erro ao gerar o relatório. Tente novamente.</div>}

      {filtros && isLoading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
        </div>
      )}

      {relatorio && (
        <div style={{ opacity: isFetching ? 0.6 : 1, transition: "opacity .15s" }} aria-busy={isFetching}>
          <div className="d-flex justify-content-end mb-3">
            <BotaoImprimirRelatorio onClick={imprimir} disabled={isFetching} />
          </div>

          <ul className="nav nav-tabs mb-4">
            {ABAS.map((valor) => (
              <li className="nav-item" key={valor}>
                <button type="button" className={`nav-link ${aba === valor ? "active" : ""}`} onClick={() => setAba(valor)}>
                  <i className={`bi ${ICONE_ABA[valor]} me-2`}></i>
                  {LABEL_ABA[valor]}
                </button>
              </li>
            ))}
          </ul>

          {aba === "visao" && (
            <>
              <ResumoAnaliseGastos relatorio={relatorio} />
              <div className="my-3"><GraficoMesesGastos meses={relatorio.por_mes} /></div>
              <MeiosEMaioresGastos meios={relatorio.por_meio} maiores={relatorio.maiores} />
            </>
          )}

          {aba === "tipos" && <NaturezasGastos relatorio={relatorio} />}

          {aba === "categorias" && (
            <CategoriasGastos categorias={relatorio.por_categoria} lancamentos={relatorio.lancamentos} />
          )}

          {aba === "lancamentos" && (
            <LancamentosGastos lancamentos={relatorio.lancamentos} truncado={relatorio.lancamentos_truncados} />
          )}
        </div>
      )}

      {relatorio && (
        <RelatorioImprimivel
          contentRef={contentRef}
          titulo="Análise dos Gastos"
          filtrosTexto={resumoTexto}
          resumo={<ResumoAnaliseGastos relatorio={relatorio} />}
          tabelas={
            <>
              <NaturezasGastos relatorio={relatorio} modoImpressao />
              <div className="mt-4">
                <CategoriasGastos categorias={relatorio.por_categoria} lancamentos={relatorio.lancamentos} modoImpressao />
              </div>
              <div className="mt-4">
                <MeiosEMaioresGastos meios={relatorio.por_meio} maiores={relatorio.maiores} />
              </div>
            </>
          }
          graficos={<GraficoMesesGastos meses={relatorio.por_mes} modoImpressao />}
        />
      )}
    </PageLayout>
  );
}
