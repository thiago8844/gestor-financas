import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import PageLayout from "../../../layouts/PageLayout";
import { simularFinanceiro } from "../../../api/simulador";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import type { Conta } from "../../../types";
import type { Categoria } from "../../../api/categoria";
import type { AjusteCenario, CenarioSalvo, ConfiguracaoSalva, FiltrosSimuladorParams } from "../../../types/simulador";
import { brParaISO, isDataBRValida } from "../periodoPresets";
import { erroDataFinal, fimDoHorizonte } from "../CompromissosFuturos/formatadores";
import { FiltrosSimulador, type FiltrosState, type Horizonte } from "./FiltrosSimulador";
import { KpisSimulador } from "./KpisSimulador";
import { GraficoSaldoFuturo } from "./graficos/GraficoSaldoFuturo";
import { GraficoHistoricoFuturo, GraficoPoupanca, GraficoReceitasDespesas } from "./graficos/GraficosMensais";
import { GraficoCascata } from "./graficos/GraficoCascata";
import { GraficoComposicaoCategorias, GraficoEvolucaoCategorias } from "./graficos/GraficosCategorias";
import { AbaCartoes } from "./graficos/GraficoFaturas";
import { AbaRiscos } from "./AbaRiscos";
import { AbaDetalhamento } from "./AbaDetalhamento";
import { PainelCategoria } from "./PainelCategoria";
import { AvisoMovimentosDeHoje } from "./AvisoMovimentosDeHoje";
import { AjustesGerais, TabelaCategoriasControle } from "./simulacoes/ControlesCenario";
import { DecisoesRapidas, EventosHipoteticos, ImpactosDecisoes } from "./simulacoes/EventosEDecisoes";
import { CenariosSalvos, ComparacaoCenarios } from "./simulacoes/Cenarios";
import { useCenario } from "./useCenario";
import { BadgeConfianca, Secao } from "./ui";
import { brl, brlSinal, cenarioVazio, formatarDataBR, hojeISO, isoLocal, mapaCoresCategorias, useDebounce } from "./utils";

const ABAS = [
  { valor: "geral", label: "Visão geral", icone: "bi-speedometer" },
  { valor: "fluxos", label: "Receitas e despesas", icone: "bi-arrow-left-right" },
  { valor: "cartoes", label: "Cartões", icone: "bi-credit-card" },
  { valor: "simulacoes", label: "Simulações", icone: "bi-sliders" },
  { valor: "riscos", label: "Riscos", icone: "bi-shield-exclamation" },
  { valor: "detalhes", label: "Detalhamento", icone: "bi-list-columns" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];

const FILTROS_INICIAIS: FiltrosState = {
  horizonte: 6,
  dataFinalBR: "",
  contaIds: [],
  cartaoIds: [],
  mesesHistorico: null,
  // Simulação-base já estimando pelo histórico, sem exigir nada do usuário.
  estimar: true,
  preverDespesas: true,
  preverReceitas: true,
};

function resolverDataFinal(horizonte: Horizonte, dataFinalBR: string): { dataFinal: string | null; erro: string | null } {
  if (horizonte === "30d") {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return { dataFinal: isoLocal(d), erro: null };
  }
  if (horizonte !== "personalizado") return { dataFinal: fimDoHorizonte(horizonte), erro: null };

  const erroFormato = erroDataFinal(dataFinalBR);
  if (erroFormato) return { dataFinal: null, erro: erroFormato };
  if (!isDataBRValida(dataFinalBR)) return { dataFinal: null, erro: null };
  const iso = brParaISO(dataFinalBR);
  if (iso < hojeISO()) return { dataFinal: null, erro: "A data precisa ser hoje ou futura." };
  if (iso > fimDoHorizonte(36)) return { dataFinal: null, erro: "No máximo 36 meses à frente." };
  return { dataFinal: iso, erro: null };
}

export function SimuladorFinanceiroPage() {
  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_INICIAIS);
  const [cenario, acoes] = useCenario();
  const [aba, setAba] = useState<Aba>("geral");
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(null);
  const [cenarioSalvoId, setCenarioSalvoId] = useState<number | null>(null);
  const { contas, cartoes, categorias } = useFormularioTransacao();

  const { dataFinal, erro: erroData } = resolverDataFinal(filtros.horizonte, filtros.dataFinalBR);

  const params = useMemo<FiltrosSimuladorParams | null>(
    () =>
      dataFinal
        ? {
            data_final: dataFinal,
            conta_ids: filtros.contaIds.length ? filtros.contaIds : undefined,
            cartao_ids: filtros.cartaoIds.length ? filtros.cartaoIds : undefined,
            meses_historico: filtros.mesesHistorico,
            estimar_variaveis: filtros.estimar,
            prever_despesas_variaveis: filtros.preverDespesas,
            prever_receitas_variaveis: filtros.preverReceitas,
            cenario: cenarioVazio(cenario) ? undefined : cenario,
          }
        : null,
    [dataFinal, filtros, cenario]
  );

  // Sliders e campos atualizam na hora; o recálculo (uma simulação completa no servidor) espera
  // o usuário parar de mexer. Enquanto isso, o resultado anterior continua na tela.
  const paramsDebounced = useDebounce(params, 400);
  const recalculando = params !== paramsDebounced;

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["relatorio-simulador-financeiro", paramsDebounced],
    queryFn: ({ signal }) => simularFinanceiro(paramsDebounced!, signal),
    enabled: !!paramsDebounced,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const relatorio = data?.data;

  // Cor de cada categoria: primeiro as com previsão automática (pela estimativa-base, que não muda
  // ao mexer no cenário), depois as demais pelo total. Despesas e receitas têm sequências próprias.
  const coresPorTipo = useMemo(() => {
    if (!relatorio) return {};
    const ordem = (tipo: string) =>
      [
        ...new Set([
          ...relatorio.categorias
            .filter((c) => c.tipo === tipo && c.projetada)
            .sort((a, b) => (b.estimativa_mensal ?? 0) - (a.estimativa_mensal ?? 0))
            .map((c) => c.chave),
          ...relatorio.categorias_mes.filter((c) => c.tipo === tipo).sort((a, b) => b.total - a.total).map((c) => c.chave),
        ]),
      ];
    return { ...mapaCoresCategorias(ordem("EXPENSE")), ...mapaCoresCategorias(ordem("INCOME")) };
  }, [relatorio]);

  const configuracaoAtual: ConfiguracaoSalva = {
    horizonte: filtros.horizonte,
    data_final: filtros.horizonte === "personalizado" ? dataFinal ?? undefined : undefined,
    conta_ids: filtros.contaIds,
    cartao_ids: filtros.cartaoIds,
    meses_historico: filtros.mesesHistorico,
    estimar_variaveis: filtros.estimar,
    prever_despesas_variaveis: filtros.preverDespesas,
    prever_receitas_variaveis: filtros.preverReceitas,
    cenario,
  };

  const carregarCenario = (salvo: CenarioSalvo) => {
    const s = salvo.settings;
    const horizonte = (typeof s.horizonte === "number" || s.horizonte === "30d" || s.horizonte === "personalizado" ? s.horizonte : 6) as Horizonte;
    setFiltros({
      horizonte,
      dataFinalBR: s.data_final ? formatarDataBR(s.data_final) : "",
      contaIds: s.conta_ids ?? [],
      cartaoIds: s.cartao_ids ?? [],
      mesesHistorico: s.meses_historico ?? null,
      estimar: s.estimar_variaveis ?? true,
      preverDespesas: s.prever_despesas_variaveis ?? true,
      preverReceitas: s.prever_receitas_variaveis ?? true,
    });
    acoes.substituir(s.cenario ?? { inflacao_mensal: 0, ajustes: [], eventos: [] });
    setCenarioSalvoId(salvo.id);
  };

  const aplicarAjuste = (ajuste: AjusteCenario) => {
    acoes.adicionarAjuste(ajuste);
    setAba("simulacoes");
  };

  const contexto = relatorio && {
    relatorio,
    cenario,
    acoes,
    contas: contas as Conta[],
    categorias: categorias as Categoria[],
  };

  const categoriaSelecionada = relatorio?.categorias.find((c) => c.chave === categoriaAberta) ?? null;
  const decisoes = cenario.ajustes.length + cenario.eventos.length + (cenario.inflacao_mensal ? 1 : 0);

  return (
    <PageLayout title="Simulador Financeiro Futuro" backTo="/relatorios">
      <p className="text-muted small mt-n3 mb-4">
        Uma previsão completa do seu dinheiro: compromissos já cadastrados + o que o seu histórico indica que você vai gastar e receber.
        Depois, mexa nas variáveis e veja o efeito na hora — nada do que você simula altera seus lançamentos.
      </p>

      <FiltrosSimulador
        filtros={filtros}
        onChange={(parcial) => setFiltros((f) => ({ ...f, ...parcial }))}
        contas={contas as Conta[]}
        cartoes={relatorio?.cartoes ?? cartoes.map((c: { id: number; name: string; account_id: number; closing_day: number; due_day: number; active: boolean }) => ({ id: c.id, nome: c.name, conta_id: c.account_id, fechamento: c.closing_day, vencimento: c.due_day, ativo: c.active }))}
        erroData={erroData}
        historicoDisponivel={relatorio?.configuracao.historico.meses}
      />

      {isError && (
        <div className="alert alert-danger">
          Erro ao gerar a simulação.{" "}
          {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Tente novamente."}
        </div>
      )}

      {params && isLoading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Analisando seu histórico...</span>
          </div>
          <div className="text-muted small mt-2">Analisando seu histórico e montando a projeção...</div>
        </div>
      )}

      {relatorio && contexto && (
        <div aria-busy={isFetching || recalculando}>
          {/* Barra da simulação: sempre visível quando há algo modificado, em qualquer aba. */}
          {decisoes > 0 && (
            <div className="card border-0 shadow-sm mb-3 sticky-top" style={{ top: 8, zIndex: 1020, background: "rgba(111,66,193,.06)", backdropFilter: "blur(6px)" }}>
              <div className="card-body py-2 d-flex flex-wrap align-items-center gap-3 small">
                <span className="fw-semibold" style={{ color: "#59359a" }}>
                  <i className="bi bi-lightbulb-fill me-1"></i>
                  Simulação ativa · {decisoes} {decisoes === 1 ? "alteração" : "alterações"}
                </span>
                <span>
                  Saldo final: {brl(relatorio.cenarios.base.resumo.saldo_final)} → <strong>{brl(relatorio.cenarios.personalizado.resumo.saldo_final)}</strong>{" "}
                  <span className={relatorio.cenarios.personalizado.resumo.saldo_final >= relatorio.cenarios.base.resumo.saldo_final ? "text-success" : "text-danger"}>
                    ({brlSinal(relatorio.cenarios.personalizado.resumo.saldo_final - relatorio.cenarios.base.resumo.saldo_final)})
                  </span>
                </span>
                <span className="text-muted">Menor saldo: {brl(relatorio.cenarios.personalizado.resumo.menor_saldo.valor)}</span>
                {(isFetching || recalculando) && (
                  <span className="text-muted">
                    <span className="spinner-border spinner-border-sm me-1" role="status" />
                    recalculando...
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary ms-auto"
                  onClick={() => {
                    acoes.restaurar();
                    setCenarioSalvoId(null);
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Restaurar previsão automática
                </button>
              </div>
            </div>
          )}

          <div style={{ opacity: isFetching && !decisoes ? 0.6 : 1, transition: "opacity .15s" }}>
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <span className="text-muted small">
                <i className="bi bi-calendar-range me-2"></i>
                De hoje até {formatarDataBR(relatorio.periodo.data_final)} · histórico de {relatorio.configuracao.historico.meses} meses
                {isFetching && !decisoes && <span className="spinner-border spinner-border-sm ms-2" role="status" />}
              </span>
            </div>

            {relatorio.avisos.map((a) => (
              <div key={a} className="alert alert-warning small py-2">
                <i className="bi bi-exclamation-triangle me-1"></i>
                {a}
              </div>
            ))}

            <AvisoMovimentosDeHoje relatorio={relatorio} onVerDetalhes={() => setAba("detalhes")} />

            {relatorio.riscos.saldo_negativo.personalizado && (
              <div className="alert alert-danger small py-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span>
                  <i className="bi bi-exclamation-octagon-fill me-1"></i>
                  O saldo previsto fica negativo em {formatarDataBR(relatorio.riscos.saldo_negativo.personalizado.primeira_data)} e chega a{" "}
                  <strong>{brl(relatorio.riscos.saldo_negativo.personalizado.menor_saldo)}</strong>.
                </span>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setAba("riscos")}>
                  Ver riscos
                </button>
              </div>
            )}

            <KpisSimulador relatorio={relatorio} />

            <ul className="nav nav-tabs mb-4 flex-nowrap overflow-auto">
              {ABAS.map((a) => (
                <li className="nav-item" key={a.valor}>
                  <button type="button" className={`nav-link text-nowrap ${aba === a.valor ? "active" : ""}`} onClick={() => setAba(a.valor)}>
                    <i className={`bi ${a.icone} me-2`}></i>
                    {a.label}
                    {a.valor === "simulacoes" && decisoes > 0 && <span className="badge ms-2" style={{ background: "#6f42c1" }}>{decisoes}</span>}
                  </button>
                </li>
              ))}
            </ul>

            {aba === "geral" && (
              <div className="row g-4">
                <div className="col-12">
                  <GraficoSaldoFuturo relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-7">
                  <GraficoCascata relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-5">
                  <GraficoPoupanca relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-7">
                  <ComparacaoCenarios relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-5">
                  <Secao titulo="Confiabilidade da previsão" icone="bi-shield-check" acoes={<BadgeConfianca nivel={relatorio.confiabilidade.nivel} />}>
                    <ul className="small mb-2 ps-3">
                      {relatorio.confiabilidade.motivos.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                    <p className="text-muted small mb-0">
                      Critérios: quanto do movimento é estimativa, a confiança de cada estimativa (ponderada pelo valor) e o tamanho do histórico.
                      Quanto mais longe no tempo, maior a incerteza — por isso a faixa otimista–pessimista se abre.
                    </p>
                  </Secao>
                </div>
              </div>
            )}

            {aba === "fluxos" && (
              <div className="row g-4">
                <div className="col-12 col-xl-6">
                  <GraficoReceitasDespesas relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-6">
                  <GraficoComposicaoCategorias relatorio={relatorio} cores={coresPorTipo} onAbrirCategoria={setCategoriaAberta} />
                </div>
                <div className="col-12 col-xl-6">
                  <GraficoHistoricoFuturo relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-6">
                  <GraficoEvolucaoCategorias relatorio={relatorio} cores={coresPorTipo} />
                </div>
              </div>
            )}

            {aba === "cartoes" && <AbaCartoes relatorio={relatorio} />}

            {aba === "simulacoes" && (
              <div className="row g-4">
                <div className="col-12">
                  <Secao titulo="Resultado da simulação" icone="bi-graph-up-arrow" ajuda="Linha roxa: sua simulação. Tracejada azul: previsão automática.">
                    <GraficoSaldoFuturo relatorio={relatorio} compacto />
                  </Secao>
                </div>
                <div className="col-12">
                  <DecisoesRapidas {...contexto} />
                </div>
                <div className="col-12 col-xxl-8">
                  <TabelaCategoriasControle relatorio={relatorio} cenario={cenario} acoes={acoes} onAbrirCategoria={setCategoriaAberta} />
                </div>
                <div className="col-12 col-xxl-4">
                  <AjustesGerais relatorio={relatorio} cenario={cenario} acoes={acoes} />
                </div>
                <div className="col-12 col-xl-6">
                  <EventosHipoteticos {...contexto} />
                </div>
                <div className="col-12 col-xl-6">
                  <ImpactosDecisoes relatorio={relatorio} cenario={cenario} acoes={acoes} />
                </div>
                <div className="col-12 col-xl-7">
                  <ComparacaoCenarios relatorio={relatorio} />
                </div>
                <div className="col-12 col-xl-5">
                  <CenariosSalvos
                    configuracaoAtual={configuracaoAtual}
                    carregadoId={cenarioSalvoId}
                    onCarregar={carregarCenario}
                    onSalvo={(c) => setCenarioSalvoId(c.id)}
                  />
                </div>
              </div>
            )}

            {aba === "riscos" && <AbaRiscos relatorio={relatorio} onAplicarAjuste={aplicarAjuste} />}

            {aba === "detalhes" && <AbaDetalhamento relatorio={relatorio} onAbrirCategoria={setCategoriaAberta} />}
          </div>

          <PainelCategoria categoria={categoriaSelecionada} cenario={cenario} acoes={acoes} onFechar={() => setCategoriaAberta(null)} />
        </div>
      )}
    </PageLayout>
  );
}
