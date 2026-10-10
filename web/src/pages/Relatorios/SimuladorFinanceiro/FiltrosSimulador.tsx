import { SelectMultiplo } from "../../../components/SelectMultiplo";
import { mascararData } from "../periodoPresets";
import type { CartaoSimulador } from "../../../types/simulador";
import type { Conta } from "../../../types";
import { Ajuda } from "./ui";

export type Horizonte = "30d" | 3 | 6 | 12 | 24 | "personalizado";

const OPCOES_HORIZONTE: { valor: Horizonte; label: string }[] = [
  { valor: "30d", label: "30 dias" },
  { valor: 3, label: "3 meses" },
  { valor: 6, label: "6 meses" },
  { valor: 12, label: "12 meses" },
  { valor: 24, label: "24 meses" },
  { valor: "personalizado", label: "Outra data" },
];

const OPCOES_HISTORICO: { valor: number | null; label: string }[] = [
  { valor: null, label: "Automático" },
  { valor: 3, label: "3 meses" },
  { valor: 6, label: "6 meses" },
  { valor: 12, label: "12 meses" },
  { valor: 24, label: "24 meses" },
];

export type FiltrosState = {
  horizonte: Horizonte;
  dataFinalBR: string;
  contaIds: number[];
  cartaoIds: number[];
  mesesHistorico: number | null;
  estimar: boolean;
  preverDespesas: boolean;
  preverReceitas: boolean;
};

type Props = {
  filtros: FiltrosState;
  onChange: (parcial: Partial<FiltrosState>) => void;
  contas: Conta[];
  cartoes: CartaoSimulador[];
  erroData: string | null;
  historicoDisponivel?: number;
};

/** Filtros aplicam na hora, sem botão "Gerar": a simulação é para explorar. */
export function FiltrosSimulador({ filtros, onChange, contas, cartoes, erroData, historicoDisponivel }: Props) {
  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-xl-6">
            <label className="form-label small">Simular os próximos</label>
            <div className="btn-group w-100 flex-wrap" role="group" aria-label="Horizonte da simulação">
              {OPCOES_HORIZONTE.map((opcao) => (
                <button
                  key={String(opcao.valor)}
                  type="button"
                  className={`btn btn-sm ${filtros.horizonte === opcao.valor ? "btn-primary" : "btn-outline-primary"}`}
                  aria-pressed={filtros.horizonte === opcao.valor}
                  onClick={() => onChange({ horizonte: opcao.valor })}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </div>

          {filtros.horizonte === "personalizado" && (
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label small">Até</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={`form-control form-control-sm ${erroData ? "is-invalid" : ""}`}
                value={filtros.dataFinalBR}
                onChange={(e) => onChange({ dataFinalBR: mascararData(e.target.value) })}
              />
              {erroData && <div className="invalid-feedback">{erroData}</div>}
            </div>
          )}

          <div className={`col-12 col-md-6 ${filtros.horizonte === "personalizado" ? "col-xl-4" : "col-xl-6"}`}>
            <label className="form-label small">
              Histórico analisado
              <Ajuda texto="Quantos meses completos do passado alimentam as estimativas. No automático, usa até 24 meses, conforme houver dados." />
            </label>
            <select
              className="form-select form-select-sm"
              value={filtros.mesesHistorico ?? ""}
              onChange={(e) => onChange({ mesesHistorico: e.target.value ? Number(e.target.value) : null })}
            >
              {OPCOES_HISTORICO.map((o) => (
                <option key={String(o.valor)} value={o.valor ?? ""}>
                  {o.label}
                  {o.valor === null && historicoDisponivel !== undefined ? ` (${historicoDisponivel} meses)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label small">Contas</label>
            <SelectMultiplo
              opcoes={contas.map((c) => ({ value: c.id, label: c.name }))}
              valor={filtros.contaIds}
              onChange={(contaIds) => onChange({ contaIds })}
              placeholder="Todas as contas"
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label small">Cartões</label>
            <SelectMultiplo
              opcoes={cartoes.map((c) => ({ value: c.id, label: c.nome }))}
              valor={filtros.cartaoIds}
              onChange={(cartaoIds) => onChange({ cartaoIds })}
              placeholder="Todos os cartões das contas"
            />
          </div>
        </div>

        <hr className="my-3" />

        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="sim-estimar"
                checked={filtros.estimar}
                onChange={(e) => onChange({ estimar: e.target.checked })}
              />
              <label className="form-check-label fw-semibold" htmlFor="sim-estimar">
                Tentar descobrir valores de receitas e despesas não fixas com base no histórico
              </label>
              <div className="text-muted small">
                Mesma regra do relatório de Compromissos Futuros para recorrências sem valor fixo, e também a previsão de
                gastos e receitas do dia a dia que ainda não foram lançados. Desligado, só entra o que já está cadastrado.
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6 d-flex flex-wrap gap-4 align-items-start">
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="sim-despesas"
                checked={filtros.preverDespesas && filtros.estimar}
                disabled={!filtros.estimar}
                onChange={(e) => onChange({ preverDespesas: e.target.checked })}
              />
              <label className="form-check-label small" htmlFor="sim-despesas">
                Prever gastos variáveis
              </label>
            </div>
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="sim-receitas"
                checked={filtros.preverReceitas && filtros.estimar}
                disabled={!filtros.estimar}
                onChange={(e) => onChange({ preverReceitas: e.target.checked })}
              />
              <label className="form-check-label small" htmlFor="sim-receitas">
                Prever receitas variáveis
              </label>
            </div>
          </div>
        </div>

        {filtros.horizonte === "personalizado" && !filtros.dataFinalBR && (
          <div className="text-muted small mt-2">
            <i className="bi bi-info-circle me-1"></i>
            Informe a data final para gerar a simulação.
          </div>
        )}
      </div>
    </div>
  );
}
