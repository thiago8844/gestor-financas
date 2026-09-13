import { Controller } from "react-hook-form";
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import InputMoeda from "../../components/InputMoeda";
import { FieldError } from "../../components/FieldError";
import type { OrcamentoForm } from "../../schemas/orcamento";
import { PeriodosPontuaisCampos } from "./PeriodosPontuaisCampos";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  errors: FieldErrors<OrcamentoForm>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: UseFormWatch<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>;
  mostrarAtivo?: boolean;
  mostrarLimiteAplicarAPartir?: boolean;
};

export function OrcamentoFormFields({
  register,
  control,
  errors,
  watch,
  setValue,
  mostrarAtivo,
  mostrarLimiteAplicarAPartir,
}: Props) {
  const type = watch("type");
  const frequency = watch("frequency");
  const amountLimit = watch("amount_limit");
  const limiteAplicarAPartir = watch("limite_aplicar_a_partir");

  return (
    <div className="row">
      <div className="col-lg-6">
        {/* Tipo */}
        <div className="mb-3">
          <label className="form-label d-block">
            Tipo <span className="text-danger">*</span>
          </label>
          <div className="btn-group" role="group">
            <input
              type="radio"
              className="btn-check"
              id="tipoPontual"
              checked={type === "ONE_TIME"}
              onChange={() => setValue("type", "ONE_TIME")}
            />
            <label className="btn btn-outline-primary" htmlFor="tipoPontual">
              <i className="bi bi-calendar-event me-1"></i> Pontual
            </label>

            <input
              type="radio"
              className="btn-check"
              id="tipoRecorrente"
              checked={type === "RECURRING"}
              onChange={() => setValue("type", "RECURRING")}
            />
            <label className="btn btn-outline-primary" htmlFor="tipoRecorrente">
              <i className="bi bi-arrow-repeat me-1"></i> Recorrente
            </label>
          </div>
        </div>

        {/* Nome */}
        <div className="mb-3">
          <label htmlFor="name" className="form-label">
            Nome <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="name"
            className="form-control"
            placeholder="Ex: Viagem, Lazer, Supermercado..."
            {...register("name")}
          />
          <FieldError>{errors.name?.message}</FieldError>
        </div>

        {/* Descrição */}
        <div className="mb-3">
          <label htmlFor="description" className="form-label">
            Descrição
          </label>
          <textarea id="description" className="form-control" rows={2} {...register("description")} />
          <FieldError>{errors.description?.message}</FieldError>
        </div>

        {/* Limite */}
        <div className="mb-3">
          <label htmlFor="amount_limit" className="form-label">
            Limite de gasto (opcional)
          </label>
          <Controller
            name="amount_limit"
            control={control}
            render={({ field }) => <InputMoeda {...field} placeholder="0,00" />}
          />
          <small className="text-muted">
            Deixe em branco para só acompanhar o gasto, sem limite.
          </small>
          <FieldError>{errors.amount_limit?.message}</FieldError>
        </div>

        {/* Alerta */}
        <div className="mb-3">
          <label htmlFor="alert_percentage" className="form-label">
            Alertar ao atingir (%)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            id="alert_percentage"
            className="form-control"
            disabled={!amountLimit}
            {...register("alert_percentage")}
          />
          {!amountLimit && (
            <small className="text-muted">Defina um limite antes de configurar o alerta.</small>
          )}
          <FieldError>{errors.alert_percentage?.message}</FieldError>
        </div>

        {/* Não considerar pendentes */}
        <div className="mb-3">
          <div className="form-check form-switch">
            <input
              id="ignore_pending_installments"
              type="checkbox"
              role="switch"
              className="form-check-input"
              checked={!!watch("ignore_pending_installments")}
              onChange={(e) => setValue("ignore_pending_installments", e.target.checked)}
            />
            <label htmlFor="ignore_pending_installments" className="form-check-label">
              Não considerar gastos pendentes
            </label>
          </div>
          <small className="text-muted">
            Compras parceladas vinculadas a esse orçamento contam pelo valor total da compra, de uma
            vez, em vez de parcela por parcela.
          </small>
        </div>

        {mostrarAtivo && (
          <div className="mb-3">
            <div className="form-check form-switch">
              <input
                id="active"
                type="checkbox"
                role="switch"
                className="form-check-input"
                checked={!!watch("active")}
                onChange={(e) => setValue("active", e.target.checked)}
              />
              <label htmlFor="active" className="form-check-label">
                Orçamento ativo
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="col-lg-6">
        {type === "RECURRING" && (
          <>
            <div className="mb-3">
              <label htmlFor="frequency" className="form-label">
                Frequência <span className="text-danger">*</span>
              </label>
              <select id="frequency" className="form-select" {...register("frequency")}>
                <option value="">Selecione</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="YEARLY">Anual</option>
              </select>
              <FieldError>{errors.frequency?.message}</FieldError>
            </div>

            {frequency === "MONTHLY" && (
              <div className="mb-3">
                <label htmlFor="interval" className="form-label">
                  A cada quantos meses
                </label>
                <input
                  type="number"
                  min={1}
                  id="interval"
                  className="form-control"
                  {...register("interval")}
                />
                <small className="text-muted">1 = todo mês, 3 = trimestral, 6 = semestral...</small>
                <FieldError>{errors.interval?.message}</FieldError>
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="start_date" className="form-label">
                Data de início <span className="text-danger">*</span>
              </label>
              <input type="date" id="start_date" className="form-control" {...register("start_date")} />
              <FieldError>{errors.start_date?.message}</FieldError>
            </div>

            {mostrarLimiteAplicarAPartir && (
              <div className="mb-3">
                <label className="form-label d-block">Ao alterar o limite, aplicar:</label>
                <div className="form-check">
                  <input
                    type="radio"
                    id="limiteAtual"
                    className="form-check-input"
                    checked={limiteAplicarAPartir !== "proximo"}
                    onChange={() => setValue("limite_aplicar_a_partir", "atual")}
                  />
                  <label htmlFor="limiteAtual" className="form-check-label">
                    No período atual
                  </label>
                </div>
                <div className="form-check">
                  <input
                    type="radio"
                    id="limiteProximo"
                    className="form-check-input"
                    checked={limiteAplicarAPartir === "proximo"}
                    onChange={() => setValue("limite_aplicar_a_partir", "proximo")}
                  />
                  <label htmlFor="limiteProximo" className="form-check-label">
                    A partir do próximo período
                  </label>
                </div>
                <small className="text-muted">Alterar o limite não modifica os períodos passados.</small>
              </div>
            )}
          </>
        )}

        {type === "ONE_TIME" && (
          <PeriodosPontuaisCampos register={register} control={control} errors={errors} />
        )}
      </div>
    </div>
  );
}
