import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import { SelectMultiplo } from "../../../components/SelectMultiplo";
import { mascararData } from "../periodoPresets";
import type { Conta } from "../../../types";
import type { TipoProjecao } from "../../../types/relatorio";

export type Horizonte = 3 | 6 | 12 | "personalizado";

const OPCOES_TIPO: { valor: TipoProjecao; label: string; ajuda: string }[] = [
  {
    valor: "AMBOS",
    label: "Receitas e despesas",
    ajuda: "Mostra quanto sobra livre em cada mês: a parte que você pode usar com os gastos variáveis.",
  },
  {
    valor: "DESPESAS",
    label: "Só despesas",
    ajuda: "Simula pagar tudo que vence, sem contar receitas: mostra se seu saldo hoje aguenta todas as despesas.",
  },
  {
    valor: "RECEITAS",
    label: "Só receitas",
    ajuda: "Simula só as entradas, sem pagar nada: mostra quanto o saldo cresceria.",
  },
];

const OPCOES_HORIZONTE: { valor: Horizonte; label: string }[] = [
  { valor: 3, label: "3 meses" },
  { valor: 6, label: "6 meses" },
  { valor: 12, label: "12 meses" },
  { valor: "personalizado", label: "Outra data" },
];

type Props = {
  tipos: TipoProjecao;
  onTipos: (tipos: TipoProjecao) => void;
  horizonte: Horizonte;
  onHorizonte: (horizonte: Horizonte) => void;
  dataFinalBR: string;
  onDataFinalBR: (data: string) => void;
  contaIds: number[];
  onContaIds: (ids: number[]) => void;
  estimar: boolean;
  onEstimar: (estimar: boolean) => void;
  erroData?: string | null;
};

/**
 * Os filtros aplicam na hora (sem botão "Gerar"): é uma projeção para "o que vem pela frente",
 * e mexer no horizonte, nas contas ou na estimativa é a forma natural de explorar o cenário.
 */
export function FiltrosCompromissosFuturos({
  tipos,
  onTipos,
  horizonte,
  onHorizonte,
  dataFinalBR,
  onDataFinalBR,
  contaIds,
  onContaIds,
  estimar,
  onEstimar,
  erroData,
}: Props) {
  const { contas } = useFormularioTransacao();

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-body">
        <div className="mb-4">
          <label className="form-label small">O que projetar</label>
          <div className="btn-group w-100" role="group" aria-label="O que projetar">
            {OPCOES_TIPO.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                className={`btn ${tipos === opcao.valor ? "btn-primary" : "btn-outline-primary"}`}
                aria-pressed={tipos === opcao.valor}
                onClick={() => onTipos(opcao.valor)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
          <div className="text-muted small mt-2">
            <i className="bi bi-info-circle me-1"></i>
            {OPCOES_TIPO.find((o) => o.valor === tipos)?.ajuda}
          </div>
        </div>

        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-5">
            <label className="form-label small">Projetar os próximos</label>
            <div className="btn-group w-100" role="group" aria-label="Horizonte da projeção">
              {OPCOES_HORIZONTE.map((opcao) => (
                <button
                  key={String(opcao.valor)}
                  type="button"
                  className={`btn btn-sm ${horizonte === opcao.valor ? "btn-primary" : "btn-outline-primary"}`}
                  aria-pressed={horizonte === opcao.valor}
                  onClick={() => onHorizonte(opcao.valor)}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </div>

          {horizonte === "personalizado" && (
            <div className="col-12 col-md-4 col-lg-2">
              <label className="form-label small">Até</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={`form-control ${erroData ? "is-invalid" : ""}`}
                value={dataFinalBR}
                onChange={(e) => onDataFinalBR(mascararData(e.target.value))}
              />
              {erroData && <div className="invalid-feedback">{erroData}</div>}
            </div>
          )}

          <div className={`col-12 ${horizonte === "personalizado" ? "col-md-8 col-lg-5" : "col-lg-7"}`}>
            <label className="form-label small">Contas</label>
            <SelectMultiplo
              opcoes={contas.map((conta: Conta) => ({ value: conta.id, label: conta.name }))}
              valor={contaIds}
              onChange={onContaIds}
              placeholder="Todas as contas"
            />
          </div>
        </div>

        <hr className="my-3" />

        <div className="form-check form-switch mb-0">
          <input
            className="form-check-input"
            type="checkbox"
            role="switch"
            id="estimar-variaveis"
            checked={estimar}
            onChange={(e) => onEstimar(e.target.checked)}
          />
          <label className="form-check-label fw-semibold" htmlFor="estimar-variaveis">
            Estimar valores variáveis pelo histórico
          </label>
          <div className="text-muted small">
            Recorrências sem valor fixo (conta de luz, comissões...) entram com uma previsão calculada a
            partir dos valores anteriores. Desligado, elas aparecem sem valor e ficam fora dos totais.
          </div>
        </div>

        {horizonte === "personalizado" && !dataFinalBR && (
          <div className="text-muted small mt-2">
            <i className="bi bi-info-circle me-1"></i>
            Informe a data final para gerar a projeção.
          </div>
        )}
      </div>
    </div>
  );
}
