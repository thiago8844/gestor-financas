import { useState } from "react";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import {
  isDataBRValida,
  mascararData,
  resolverPresetPeriodo,
  sugerirAgrupamento,
  type PresetPeriodo,
} from "../periodoPresets";
import type { FiltrosFluxoCaixaParams } from "../../../types/relatorio";
import type { Conta } from "../../../types";

type Props = {
  gerado: boolean;
  resumoTexto: string | null;
  onGerar: (filtros: FiltrosFluxoCaixaParams) => void;
};

const LABEL_PRESET: Record<PresetPeriodo, string> = {
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  ultimos_3_meses: "Últimos 3 meses",
  ano_atual: "Este ano",
  personalizado: "Personalizado",
};

export function FiltrosFluxoCaixa({ gerado, resumoTexto, onGerar }: Props) {
  const { contas, categorias, orcamentos } = useFormularioTransacao();

  const [expandido, setExpandido] = useState(true);
  const [mostrarMaisFiltros, setMostrarMaisFiltros] = useState(false);

  const [preset, setPreset] = useState<PresetPeriodo>("este_mes");
  const [dataInicialBR, setDataInicialBR] = useState("");
  const [dataFinalBR, setDataFinalBR] = useState("");
  const [contaId, setContaId] = useState("");
  const [regime, setRegime] = useState<"CAIXA" | "COMPETENCIA">("CAIXA");
  const [compararCom, setCompararCom] = useState<
    "NENHUM" | "PERIODO_ANTERIOR" | "MESMO_PERIODO_ANO_ANTERIOR"
  >("NENHUM");

  const [categoryId, setCategoryId] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [valorMinimo, setValorMinimo] = useState("");
  const [valorMaximo, setValorMaximo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const handleGerar = () => {
    const periodo = resolverPresetPeriodo(preset, dataInicialBR, dataFinalBR);

    if (!periodo) {
      setErro("Informe um período válido.");
      return;
    }

    setErro(null);

    onGerar({
      data_inicial: periodo.data_inicial,
      data_final: periodo.data_final,
      conta_id: contaId ? Number(contaId) : undefined,
      regime,
      comparar_com: compararCom,
      agrupamento: sugerirAgrupamento(periodo.data_inicial, periodo.data_final),
      category_id: categoryId ? Number(categoryId) : undefined,
      budget_id: budgetId ? Number(budgetId) : undefined,
      type: (tipo as "INCOME" | "EXPENSE") || undefined,
      status: (status as "PAID" | "PENDING") || undefined,
      valor_minimo: valorMinimo ? Number(valorMinimo) : undefined,
      valor_maximo: valorMaximo ? Number(valorMaximo) : undefined,
      descricao: descricao || undefined,
    });

    setExpandido(false);
  };

  if (gerado && !expandido) {
    return (
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 bg-light rounded px-3 py-2 mb-4">
        <span className="text-muted small">
          <i className="bi bi-funnel me-2"></i>
          {resumoTexto}
        </span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setExpandido(true)}>
          Alterar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-body">
        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-3">
            <label className="form-label small">Período</label>
            <select
              className="form-select"
              value={preset}
              onChange={(e) => setPreset(e.target.value as PresetPeriodo)}
            >
              {(Object.keys(LABEL_PRESET) as PresetPeriodo[]).map((p) => (
                <option key={p} value={p}>
                  {LABEL_PRESET[p]}
                </option>
              ))}
            </select>
          </div>

          {preset === "personalizado" && (
            <>
              <div className="col-6 col-md-2">
                <label className="form-label small">De</label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className={`form-control ${dataInicialBR.length === 10 && !isDataBRValida(dataInicialBR) ? "is-invalid" : ""}`}
                  value={dataInicialBR}
                  onChange={(e) => setDataInicialBR(mascararData(e.target.value))}
                />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small">Até</label>
                <input
                  type="text"
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className={`form-control ${dataFinalBR.length === 10 && !isDataBRValida(dataFinalBR) ? "is-invalid" : ""}`}
                  value={dataFinalBR}
                  onChange={(e) => setDataFinalBR(mascararData(e.target.value))}
                />
              </div>
            </>
          )}

          <div className="col-12 col-md-3">
            <label className="form-label small">Conta</label>
            <select className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Todas as contas</option>
              {contas.map((conta: Conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Regime</label>
            <select
              className="form-select"
              value={regime}
              onChange={(e) => setRegime(e.target.value as "CAIXA" | "COMPETENCIA")}
            >
              <option value="CAIXA">Pago/Recebido</option>
              <option value="COMPETENCIA">Competência</option>
            </select>
          </div>

          <div className="col-12 col-md-2">
            <label className="form-label small">Comparar com</label>
            <select
              className="form-select"
              value={compararCom}
              onChange={(e) =>
                setCompararCom(e.target.value as "NENHUM" | "PERIODO_ANTERIOR" | "MESMO_PERIODO_ANO_ANTERIOR")
              }
            >
              <option value="NENHUM">Nenhum</option>
              <option value="PERIODO_ANTERIOR">Período anterior</option>
              <option value="MESMO_PERIODO_ANO_ANTERIOR">Mesmo período ano anterior</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="btn btn-sm btn-link ps-0 text-decoration-none"
            onClick={() => setMostrarMaisFiltros((prev) => !prev)}
          >
            <i className={`bi bi-chevron-${mostrarMaisFiltros ? "up" : "down"} me-1`}></i>
            Mais filtros
          </button>
        </div>

        {mostrarMaisFiltros && (
          <div className="row g-3 mt-1">
            <div className="col-12 col-md-3">
              <label className="form-label small">Categoria</label>
              <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((categoria: { id: number; name: string }) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small">Orçamento</label>
              <select className="form-select" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
                <option value="">Todos</option>
                {orcamentos.map((orcamento: { id: number; name: string }) => (
                  <option key={orcamento.id} value={orcamento.id}>
                    {orcamento.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small">Tipo</label>
              <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                <option value="">Receita/Despesa</option>
                <option value="INCOME">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small">Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={regime === "CAIXA"}
                title={regime === "CAIXA" ? "No regime de caixa só entram lançamentos pagos" : undefined}
              >
                <option value="">Pago/Não pago</option>
                <option value="PAID">Pago</option>
                <option value="PENDING">Não pago</option>
              </select>
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label small">Descrição</label>
              <input
                type="text"
                className="form-control"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Contém..."
              />
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small">Valor mínimo</label>
              <input
                type="number"
                className="form-control"
                value={valorMinimo}
                onChange={(e) => setValorMinimo(e.target.value)}
              />
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small">Valor máximo</label>
              <input
                type="number"
                className="form-control"
                value={valorMaximo}
                onChange={(e) => setValorMaximo(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="d-flex justify-content-end gap-2 mt-4">
          {gerado && (
            <button type="button" className="btn btn-outline-secondary" onClick={() => setExpandido(false)}>
              Cancelar
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handleGerar}>
            <i className="bi bi-bar-chart-line me-2"></i>
            Gerar relatório
          </button>
        </div>
      </div>
    </div>
  );
}
