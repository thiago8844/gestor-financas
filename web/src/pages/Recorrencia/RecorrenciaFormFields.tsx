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
import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import type { RecorrenciaForm } from "../../schemas/recorrencia";
import type { Conta } from "../../types/conta";

const DIAS_SEMANA = [
  { valor: 0, label: "Dom" },
  { valor: 1, label: "Seg" },
  { valor: 2, label: "Ter" },
  { valor: 3, label: "Qua" },
  { valor: 4, label: "Qui" },
  { valor: 5, label: "Sex" },
  { valor: 6, label: "Sáb" },
];

const MESES = [
  { valor: 1, label: "Janeiro" },
  { valor: 2, label: "Fevereiro" },
  { valor: 3, label: "Março" },
  { valor: 4, label: "Abril" },
  { valor: 5, label: "Maio" },
  { valor: 6, label: "Junho" },
  { valor: 7, label: "Julho" },
  { valor: 8, label: "Agosto" },
  { valor: 9, label: "Setembro" },
  { valor: 10, label: "Outubro" },
  { valor: 11, label: "Novembro" },
  { valor: 12, label: "Dezembro" },
];

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  errors: FieldErrors<RecorrenciaForm>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: UseFormWatch<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>;
  contas: Conta[];
  mostrarAtivo?: boolean;
};

export function RecorrenciaFormFields({
  register,
  control,
  errors,
  watch,
  setValue,
  contas,
  mostrarAtivo,
}: Props) {
  const type = watch("type");
  const frequency = watch("frequency");
  const valorFixo = watch("valorFixo");
  const defaultStatus = watch("default_status");
  const diasSelecionados: number[] = watch("days_of_week") || [];

  const toggleDiaSemana = (dia: number) => {
    const atual: number[] = diasSelecionados;
    const novo = atual.includes(dia)
      ? atual.filter((d) => d !== dia)
      : [...atual, dia].sort();
    setValue("days_of_week", novo, { shouldValidate: true });
  };

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
              id="tipoDespesa"
              checked={type === "EXPENSE"}
              onChange={() => setValue("type", "EXPENSE")}
            />
            <label className="btn btn-outline-danger" htmlFor="tipoDespesa">
              <i className="bi bi-arrow-down-circle me-1"></i> Despesa
            </label>

            <input
              type="radio"
              className="btn-check"
              id="tipoReceita"
              checked={type === "INCOME"}
              onChange={() => setValue("type", "INCOME")}
            />
            <label className="btn btn-outline-success" htmlFor="tipoReceita">
              <i className="bi bi-arrow-up-circle me-1"></i> Receita
            </label>
          </div>
        </div>

        {/* Descrição */}
        <div className="mb-3">
          <label htmlFor="description" className="form-label">
            Descrição <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            id="description"
            className="form-control"
            placeholder="Ex: Aluguel, Conta de luz, Parcela do seguro..."
            {...register("description")}
          />
          <FieldError>{errors.description?.message}</FieldError>
        </div>

        {/* Conta */}
        <div className="mb-3">
          <label htmlFor="account_id" className="form-label">
            Conta <span className="text-danger">*</span>
          </label>
          <select id="account_id" className="form-select" {...register("account_id")}>
            <option value="">Selecione uma conta</option>
            {contas.map((conta: Conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.name}
              </option>
            ))}
          </select>
          <FieldError>{errors.account_id?.message}</FieldError>
        </div>

        {/* Categoria */}
        <div className="mb-3">
          <label htmlFor="category_name" className="form-label">
            Categoria
          </label>
          <Controller
            name="category_name"
            control={control}
            render={({ field }) => (
              <CategoriaAutocomplete
                value={field.value || ""}
                onChange={(categoryName, categoryId) => {
                  field.onChange(categoryName);
                  setValue("category_id", categoryId ? categoryId.toString() : null);
                }}
                placeholder="Digite ou selecione uma categoria..."
              />
            )}
          />
          <FieldError>{errors.category_name?.message}</FieldError>
        </div>

        {/* Valor fixo */}
        <div className="mb-3">
          <div className="form-check form-switch">
            <input
              id="valorFixo"
              type="checkbox"
              role="switch"
              className="form-check-input"
              checked={!!valorFixo}
              onChange={(e) => {
                setValue("valorFixo", e.target.checked, { shouldValidate: true });
                if (!e.target.checked) {
                  setValue("amount", "");
                  setValue("default_status", "PENDING", { shouldValidate: true });
                }
              }}
            />
            <label htmlFor="valorFixo" className="form-check-label">
              Valor fixo?
            </label>
          </div>
          <small className="text-muted">
            Desligado quando o valor muda a cada ocorrência (ex: conta de luz) — cada
            lançamento nasce sem valor, pra você preencher depois.
          </small>
        </div>

        {valorFixo && (
          <div className="mb-3">
            <label htmlFor="amount" className="form-label">
              Valor <span className="text-danger">*</span>
            </label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => <InputMoeda {...field} placeholder="0,00" />}
            />
            <FieldError>{errors.amount?.message}</FieldError>
          </div>
        )}

        {/* Nasce como */}
        <div className="mb-3">
          <div className="form-check form-switch">
            <input
              id="defaultStatus"
              type="checkbox"
              role="switch"
              className="form-check-input"
              disabled={!valorFixo}
              checked={defaultStatus === "PAID"}
              onChange={(e) =>
                setValue("default_status", e.target.checked ? "PAID" : "PENDING", {
                  shouldValidate: true,
                })
              }
            />
            <label htmlFor="defaultStatus" className="form-check-label">
              Lançar já como paga
            </label>
          </div>
          {!valorFixo && (
            <small className="text-muted">
              Só é possível nascer paga quando há um valor fixo definido.
            </small>
          )}
          <FieldError>{errors.default_status?.message}</FieldError>
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
                Recorrência ativa
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="col-lg-6">
        {/* Frequência */}
        <div className="mb-3">
          <label htmlFor="frequency" className="form-label">
            Frequência <span className="text-danger">*</span>
          </label>
          <select id="frequency" className="form-select" {...register("frequency")}>
            <option value="DAILY">Diária</option>
            <option value="WEEKLY">Semanal</option>
            <option value="MONTHLY">Mensal</option>
            <option value="YEARLY">Anual</option>
          </select>
          <FieldError>{errors.frequency?.message}</FieldError>
        </div>

        {(frequency === "DAILY" || frequency === "MONTHLY" || frequency === "YEARLY") && (
          <div className="mb-3">
            <label htmlFor="interval" className="form-label">
              {frequency === "DAILY" && "A cada quantos dias"}
              {frequency === "MONTHLY" && "A cada quantos meses"}
              {frequency === "YEARLY" && "A cada quantos anos"}
            </label>
            <input
              type="number"
              min={1}
              id="interval"
              className="form-control"
              {...register("interval")}
            />
            <FieldError>{errors.interval?.message}</FieldError>
          </div>
        )}

        {frequency === "WEEKLY" && (
          <div className="mb-3">
            <label className="form-label d-block">Dias da semana</label>
            <div className="d-flex gap-1 flex-wrap">
              {DIAS_SEMANA.map((dia) => (
                <button
                  key={dia.valor}
                  type="button"
                  className={`btn btn-sm ${
                    diasSelecionados.includes(dia.valor)
                      ? "btn-primary"
                      : "btn-outline-secondary"
                  }`}
                  onClick={() => toggleDiaSemana(dia.valor)}
                >
                  {dia.label}
                </button>
              ))}
            </div>
            <FieldError>{errors.days_of_week?.message}</FieldError>
          </div>
        )}

        {(frequency === "MONTHLY" || frequency === "YEARLY") && (
          <div className="mb-3">
            <label htmlFor="day_of_month" className="form-label">
              Dia do mês
            </label>
            <input
              type="number"
              min={1}
              max={31}
              id="day_of_month"
              className="form-control"
              {...register("day_of_month")}
            />
            <FieldError>{errors.day_of_month?.message}</FieldError>
          </div>
        )}

        {frequency === "YEARLY" && (
          <div className="mb-3">
            <label htmlFor="month_of_year" className="form-label">
              Mês
            </label>
            <select id="month_of_year" className="form-select" {...register("month_of_year")}>
              <option value="">Selecione</option>
              {MESES.map((mes) => (
                <option key={mes.valor} value={mes.valor}>
                  {mes.label}
                </option>
              ))}
            </select>
            <FieldError>{errors.month_of_year?.message}</FieldError>
          </div>
        )}

        {/* Data início */}
        <div className="mb-3">
          <label htmlFor="start_date" className="form-label">
            Data de início <span className="text-danger">*</span>
          </label>
          <input
            type="date"
            id="start_date"
            className="form-control"
            {...register("start_date")}
          />
          <FieldError>{errors.start_date?.message}</FieldError>
        </div>

        {/* Data fim */}
        <div className="mb-3">
          <label htmlFor="end_date" className="form-label">
            Data final (opcional)
          </label>
          <input type="date" id="end_date" className="form-control" {...register("end_date")} />
          <FieldError>{errors.end_date?.message}</FieldError>
        </div>
      </div>
    </div>
  );
}
