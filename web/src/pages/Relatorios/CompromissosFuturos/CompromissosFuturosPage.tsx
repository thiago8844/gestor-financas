import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import PageLayout from "../../../layouts/PageLayout";
import { getRelatorioCompromissosFuturos } from "../../../api/relatorios";
import { BotaoImprimirRelatorio } from "../../../components/Relatorio/BotaoImprimirRelatorio";
import { RelatorioImprimivel } from "../../../components/Relatorio/RelatorioImprimivel";
import { useImprimirRelatorio } from "../../../hooks/useImprimirRelatorio";
import { brParaISO, isDataBRValida, textoContas } from "../periodoPresets";
import { FiltrosCompromissosFuturos, type Horizonte } from "./FiltrosCompromissosFuturos";
import { AlertasCompromissos } from "./AlertasCompromissos";
import { ResumoCompromissosFuturos } from "./ResumoCompromissosFuturos";
import { GraficoEvolucaoSaldo } from "./GraficoEvolucaoSaldo";
import { ProximosCompromissos } from "./ProximosCompromissos";
import { TabelaResumoMensal } from "./TabelaResumoMensal";
import { CompromissosDetalhados } from "./CompromissosDetalhados";
import { CompromissosPorCategoria } from "./CompromissosPorCategoria";
import { erroDataFinal, fimDoHorizonte, formatarDataBR } from "./formatadores";
import type { FonteProjecao, TipoProjecao } from "../../../types/relatorio";

const LABEL_TIPO: Record<TipoProjecao, string> = {
  AMBOS: "Receitas e despesas",
  DESPESAS: "Só despesas",
  RECEITAS: "Só receitas",
};

const ABAS = ["evolucao", "categorias", "detalhes"] as const;
type Aba = (typeof ABAS)[number];

const LABEL_ABA: Record<Aba, string> = {
  evolucao: "Evolução do saldo",
  categorias: "Por categoria",
  detalhes: "Compromissos detalhados",
};

const ICONE_ABA: Record<Aba, string> = {
  evolucao: "bi-graph-up-arrow",
  categorias: "bi-tags",
  detalhes: "bi-list-check",
};

const LABEL_FONTE: Record<FonteProjecao, string> = {
  TODAS: "Lançadas e recorrências",
  LANCADAS: "Só já lançadas",
  RECORRENCIAS: "Só recorrências a lançar",
};

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function CompromissosFuturosPage() {
  const [tipos, setTipos] = useState<TipoProjecao>("AMBOS");
  const [fonte, setFonte] = useState<FonteProjecao>("TODAS");
  const [horizonte, setHorizonte] = useState<Horizonte>(6);
  const [dataFinalBR, setDataFinalBR] = useState("");
  const [contaIds, setContaIds] = useState<number[]>([]);
  const [estimar, setEstimar] = useState(false);
  const [aba, setAba] = useState<Aba>("evolucao");

  // Data final efetiva e eventual erro de digitação (só no modo "Outra data").
  const { dataFinal, erroData } = useMemo(() => {
    if (horizonte !== "personalizado") return { dataFinal: fimDoHorizonte(horizonte), erroData: null };

    const erroFormato = erroDataFinal(dataFinalBR);
    if (erroFormato) return { dataFinal: null, erroData: erroFormato };
    if (!isDataBRValida(dataFinalBR)) return { dataFinal: null, erroData: null };

    const iso = brParaISO(dataFinalBR);
    if (iso < hojeISO()) return { dataFinal: null, erroData: "A data precisa ser hoje ou futura." };

    return { dataFinal: iso, erroData: null };
  }, [horizonte, dataFinalBR]);

  const filtros = useMemo(
    () =>
      dataFinal
        ? {
            data_final: dataFinal,
            conta_ids: contaIds.length ? contaIds : undefined,
            estimar_variaveis: estimar,
            tipos,
            fonte,
          }
        : null,
    [dataFinal, contaIds, estimar, tipos, fonte]
  );

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["relatorio-compromissos-futuros", filtros],
    queryFn: () => getRelatorioCompromissosFuturos(filtros!),
    enabled: !!filtros,
    // Trocar horizonte/estimativa não "pisca" a tela: o resultado anterior fica até chegar o novo.
    placeholderData: keepPreviousData,
    // Relatório é pesado: não refaz a consulta ao voltar para a aba
    refetchOnWindowFocus: false,
  });

  const relatorio = data?.data;

  const { contentRef, imprimir } = useImprimirRelatorio(
    relatorio ? `Compromissos Futuros até ${relatorio.periodo.data_final}` : "Compromissos Futuros"
  );

  const filtrosTexto = relatorio
    ? `Hoje a ${formatarDataBR(relatorio.periodo.data_final)} · ${LABEL_TIPO[relatorio.tipos]} · ${LABEL_FONTE[relatorio.fonte]} · ${textoContas(
        filtros?.conta_ids
      )} · ${relatorio.estimar_variaveis ? "Valores variáveis estimados pelo histórico" : "Valores variáveis fora dos totais"}`
    : null;

  const alertasEResumo = relatorio && (
    <AlertasCompromissos
      tipos={relatorio.tipos}
      alertas={relatorio.alertas}
      resumo={relatorio.resumo}
      estimando={relatorio.estimar_variaveis}
      onEstimar={() => setEstimar(true)}
    />
  );

  return (
    <PageLayout title="Compromissos Futuros" backTo="/relatorios">
      <p className="text-muted small mt-n3 mb-4">
        Quanto do seu dinheiro já está comprometido: parcelas, faturas de cartão, contas e recorrências a
        vencer, aplicadas dia a dia ao seu saldo.
      </p>

      <FiltrosCompromissosFuturos
        tipos={tipos}
        onTipos={setTipos}
        fonte={fonte}
        onFonte={setFonte}
        horizonte={horizonte}
        onHorizonte={setHorizonte}
        dataFinalBR={dataFinalBR}
        onDataFinalBR={setDataFinalBR}
        contaIds={contaIds}
        onContaIds={setContaIds}
        estimar={estimar}
        onEstimar={setEstimar}
        erroData={erroData}
      />

      {isError && <div className="alert alert-danger">Erro ao gerar a projeção. Tente novamente.</div>}

      {filtros && isLoading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
        </div>
      )}

      {relatorio && (
        <div style={{ opacity: isFetching ? 0.6 : 1, transition: "opacity .15s" }} aria-busy={isFetching}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="text-muted small">
              <i className="bi bi-calendar-range me-2"></i>
              De hoje até {formatarDataBR(relatorio.periodo.data_final)}
              {isFetching && <span className="spinner-border spinner-border-sm ms-2" role="status" />}
            </span>
            <BotaoImprimirRelatorio onClick={imprimir} disabled={isFetching} />
          </div>

          {alertasEResumo}

          <ResumoCompromissosFuturos
            resumo={relatorio.resumo}
            meses={relatorio.meses}
            tipos={relatorio.tipos}
            dataFinal={relatorio.periodo.data_final}
          />

          <ul className="nav nav-tabs my-4">
            {ABAS.map((valor) => (
              <li className="nav-item" key={valor}>
                <button
                  type="button"
                  className={`nav-link ${aba === valor ? "active" : ""}`}
                  onClick={() => setAba(valor)}
                >
                  <i className={`bi ${ICONE_ABA[valor]} me-2`}></i>
                  {LABEL_ABA[valor]}
                  {valor === "detalhes" && (
                    <span className="badge text-bg-secondary ms-2">{relatorio.resumo.quantidade}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {aba === "evolucao" && (
            <>
              <div className="row g-4 mb-4">
                <div className="col-12 col-xl-8">
                  <GraficoEvolucaoSaldo
                    tipos={relatorio.tipos}
                    meses={relatorio.meses}
                    serieDiaria={relatorio.serie_diaria}
                    resumo={relatorio.resumo}
                    dataInicial={relatorio.periodo.data_inicial}
                    mostrarFaixa={relatorio.estimar_variaveis && relatorio.meses.some((m) => m.incerteza > 0)}
                  />
                </div>
                <div className="col-12 col-xl-4">
                  <ProximosCompromissos eventos={relatorio.eventos} onVerTodos={() => setAba("detalhes")} />
                </div>
              </div>

              <TabelaResumoMensal meses={relatorio.meses} saldoAtual={relatorio.resumo.saldo_atual} />
            </>
          )}

          {aba === "categorias" && <CompromissosPorCategoria eventos={relatorio.eventos} tipos={relatorio.tipos} />}

          {aba === "detalhes" && <CompromissosDetalhados eventos={relatorio.eventos} meses={relatorio.meses} />}
        </div>
      )}

      {relatorio && (
        <RelatorioImprimivel
          contentRef={contentRef}
          titulo="Compromissos Futuros"
          filtrosTexto={filtrosTexto}
          resumo={
            <>
              {alertasEResumo}
              <ResumoCompromissosFuturos
                resumo={relatorio.resumo}
                meses={relatorio.meses}
                tipos={relatorio.tipos}
                dataFinal={relatorio.periodo.data_final}
              />
            </>
          }
          tabelas={
            <>
              <TabelaResumoMensal meses={relatorio.meses} saldoAtual={relatorio.resumo.saldo_atual} />
              <div className="mt-4">
                <CompromissosPorCategoria eventos={relatorio.eventos} tipos={relatorio.tipos} modoImpressao />
              </div>
              <div className="mt-4">
                <CompromissosDetalhados eventos={relatorio.eventos} meses={relatorio.meses} modoImpressao />
              </div>
            </>
          }
          graficos={
            <GraficoEvolucaoSaldo
              tipos={relatorio.tipos}
              meses={relatorio.meses}
              serieDiaria={relatorio.serie_diaria}
              resumo={relatorio.resumo}
              dataInicial={relatorio.periodo.data_inicial}
              mostrarFaixa={relatorio.estimar_variaveis && relatorio.meses.some((m) => m.incerteza > 0)}
              modoImpressao
            />
          }
        />
      )}
    </PageLayout>
  );
}
