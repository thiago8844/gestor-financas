import { useFieldArray } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { FieldError } from "../../components/FieldError";
import type { OrcamentoForm } from "../../schemas/orcamento";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  errors: FieldErrors<OrcamentoForm>;
};

export function PeriodosPontuaisCampos({ register, control, errors }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: "periodos" });

  return (
    <div className="mb-3">
      <label className="form-label d-block">
        Intervalos de datas <span className="text-danger">*</span>
      </label>

      {fields.map((field, index) => (
        <div key={field.id} className="row g-2 align-items-end mb-2">
          <div className="col-5">
            <label className="form-label small text-muted mb-1">Início</label>
            <input
              type="date"
              className="form-control"
              {...register(`periodos.${index}.start_date`)}
            />
            <FieldError>{errors.periodos?.[index]?.start_date?.message}</FieldError>
          </div>
          <div className="col-5">
            <label className="form-label small text-muted mb-1">Fim</label>
            <input type="date" className="form-control" {...register(`periodos.${index}.end_date`)} />
            <FieldError>{errors.periodos?.[index]?.end_date?.message}</FieldError>
          </div>
          <div className="col-2">
            <button
              type="button"
              className="btn btn-outline-danger w-100"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              title="Remover intervalo"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-outline-primary btn-sm"
        onClick={() => append({ start_date: "", end_date: "" })}
      >
        <i className="bi bi-plus-circle me-1"></i>
        Adicionar intervalo
      </button>

      {typeof errors.periodos?.message === "string" && (
        <div className="mt-1">
          <FieldError>{errors.periodos.message}</FieldError>
        </div>
      )}
    </div>
  );
}
