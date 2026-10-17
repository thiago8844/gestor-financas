import { useState } from "react";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import { SelectMultiplo } from "../../../components/SelectMultiplo";
import { brParaISO, isDataBRValida, mascararData } from "../periodoPresets";
import type { BaseDataGastos, FiltrosAnaliseGastosParams, OrigemGastos } from "../../../types/relatorio";
import type { Conta } from "../../../types";

type Preset = "este_mes" | "mes_passado" | "ultimos_3_meses" | "ultimos_6_meses" | "ano_atual" | "proximos_3_meses" | "proximos_6_meses" | "personalizado";

const LABEL_PRESET: Record<Preset, string> = {
  este_mes: "Este mês",
  mes_passado: "Mês passado",
  ultimos_3_meses: "Últimos 3 meses",
  ultimos_6_meses: "Últimos 6 meses",
  ano_atual: "Este ano",
  proximos_3_meses: "Este mês + próximos 3 (futuro)",
  proximos_6_meses: "Este mês + próximos 6 (futuro)",
  personalizado: "Personalizado",
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function resolver(preset: Preset, deBR: string, ateBR: string): { data_inicial: string; data_final: string } | null {
  const h = new Date();
  const mes = (n: number, dia = 1) => new Date(h.getFullYear(), h.getMonth() + n, dia);

  switch (preset) {
    case "este_mes": return { data_inicial: iso(mes(0)), data_final: iso(mes(1, 0)) };
    case "mes_passado": return { data_inicial: iso(mes(-1)), data_final: iso(mes(0, 0)) };
    case "ultimos_3_meses": return { data_inicial: iso(mes(-2)), data_final: iso(mes(1, 0)) };
    case "ultimos_6_meses": return { data_inicial: iso(mes(-5)), data_final: iso(mes(1, 0)) };
    case "ano_atual": return { data_inicial: iso(new Date(h.getFullYear(), 0, 1)), data_final: iso(new Date(h.getFullYear(), 11, 31)) };
    case "proximos_3_meses": return { data_inicial: iso(mes(0)), data_final: iso(mes(4, 0)) };
    case "proximos_6_meses": return { data_inicial: iso(mes(0)), data_final: iso(mes(7, 0)) };
    default:
      if (isDataBRValida(deBR) && isDataBRValida(ateBR) && brParaISO(deBR) <= brParaISO(ateBR)) {
        return { data_inicial: brParaISO(deBR), data_final: brParaISO(ateBR) };
      }
      return null;
  }
}

type Props = {
  gerado: boolean;
  resumoTexto: string | null;
  onGerar: (filtros: FiltrosAnaliseGastosParams) => void;
};

export function FiltrosAnaliseGastos({ gerado, resumoTexto, onGerar }: Props) {
  const { contas } = useFormularioTransacao();

  const [expandido, setExpandido] = useState(true);
  const [preset, setPreset] = useState<Preset>("este_mes");
  const [deBR, setDeBR] = useState("");
  const [ateBR, setAteBR] = useState("");
  const [contaIds, setContaIds] = useState<number[]>([]);
  const [origem, setOrigem] = useState<OrigemGastos>("TODAS");
  const [baseData, setBaseData] = useState<BaseDataGastos>("GASTO");
  const [comparar, setComparar] = useState(false);
  const [estimar, setEstimar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const gerarRelatorio = () => {
    const periodo = resolver(preset, deBR, ateBR);
    if (!periodo) {
      setErro("Informe um período válido.");
      return;
    }
    setErro(null);
    onGerar({
      ...periodo,
      conta_ids: contaIds.length ? contaIds : undefined,
      origem,
      base_data: baseData,
      comparar,
      estimar_variaveis: estimar,
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
          <div className="col-12 col-md-4">
            <label className="form-label small">Período</label>
            <select className="form-select" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              {(Object.keys(LABEL_PRESET) as Preset[]).map((p) => (
                <option key={p} value={p}>{LABEL_PRESET[p]}</option>
              ))}
            </select>
          </div>

          {preset === "personalizado" && (
            <>
              <div className="col-6 col-md-2">
                <label className="form-label small">De</label>
                <input type="text" placeholder="DD/MM/AAAA" maxLength={10} className={`form-control ${deBR.length === 10 && !isDataBRValida(deBR) ? "is-invalid" : ""}`} value={deBR} onChange={(e) => setDeBR(mascararData(e.target.value))} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small">Até</label>
                <input type="text" placeholder="DD/MM/AAAA" maxLength={10} className={`form-control ${ateBR.length === 10 && !isDataBRValida(ateBR) ? "is-invalid" : ""}`} value={ateBR} onChange={(e) => setAteBR(mascararData(e.target.value))} />
              </div>
            </>
          )}

          <div className="col-12 col-md-4">
            <label className="form-label small">Contas</label>
            <SelectMultiplo
              opcoes={contas.map((c: Conta) => ({ value: c.id, label: c.name }))}
              valor={contaIds}
              onChange={setContaIds}
              placeholder="Todas as contas"
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label small">Meio de pagamento</label>
            <select className="form-select" value={origem} onChange={(e) => setOrigem(e.target.value as OrigemGastos)}>
              <option value="TODAS">Cartão e contas</option>
              <option value="CONTA">Só contas financeiras</option>
              <option value="CARTAO">Só cartão</option>
            </select>
          </div>

          <div className="col-6 col-md-5">
            <label className="form-label small">Contar cada gasto pela data…</label>
            <select className="form-select" value={baseData} onChange={(e) => setBaseData(e.target.value as BaseDataGastos)}>
              <option value="GASTO">Do gasto (dia da compra)</option>
              <option value="PAGAMENTO">Do pagamento (quando o dinheiro sai)</option>
            </select>
          </div>

          <div className="col-12 col-md-4">
            <div className="form-check form-switch">
              <input id="ag-comparar" type="checkbox" role="switch" className="form-check-input" checked={comparar} onChange={(e) => setComparar(e.target.checked)} />
              <label htmlFor="ag-comparar" className="form-check-label small">Comparar com o período anterior</label>
            </div>
            <div className="form-check form-switch">
              <input id="ag-estimar" type="checkbox" role="switch" className="form-check-input" checked={estimar} onChange={(e) => setEstimar(e.target.checked)} />
              <label htmlFor="ag-estimar" className="form-check-label small">Estimar valores variáveis futuros (luz, água...)</label>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-4">
          {gerado && (
            <button type="button" className="btn btn-outline-secondary" onClick={() => setExpandido(false)}>Cancelar</button>
          )}
          <button type="button" className="btn btn-primary" onClick={gerarRelatorio}>
            <i className="bi bi-bar-chart-line me-2"></i>
            Gerar relatório
          </button>
        </div>
      </div>
    </div>
  );
}
