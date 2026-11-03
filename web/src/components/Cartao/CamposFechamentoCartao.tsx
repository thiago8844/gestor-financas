import type { FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";
import type { CartaoForm } from "../../schemas/cartao";
import { FieldError } from "../FieldError";
import { AvisoDiaCartao } from "./AvisoDiaCartao";

type Props = {
  register: UseFormRegister<CartaoForm>;
  watch: UseFormWatch<CartaoForm>;
  errors: FieldErrors<CartaoForm>;
  /** Avisa que mudar o vencimento/regra realoca as despesas pendentes (edição de cartão existente). */
  avisarRealocacao?: boolean;
};

/** Regra de fechamento (dia fixo ou X dias antes do vencimento) e dia de vencimento do cartão. */
export function CamposFechamentoCartao({ register, watch, errors, avisarRealocacao }: Props) {
  const regra = watch("closing_rule");

  return (
    <>
      <div className="mb-3">
        <label htmlFor="closing_rule" className="form-label">
          Regra de fechamento
        </label>
        <select id="closing_rule" className="form-select" {...register("closing_rule")}>
          <option value="FIXED_DAY">Dia fixo do mês</option>
          <option value="DAYS_BEFORE_DUE">X dias antes do vencimento</option>
        </select>
      </div>

      {regra === "DAYS_BEFORE_DUE" ? (
        <div className="mb-3">
          <label htmlFor="closing_days_before_due" className="form-label">
            Dias antes do vencimento
          </label>
          <input type="number" min={1} max={28} id="closing_days_before_due" className="form-control" {...register("closing_days_before_due")} />
          <div className="form-text">A fatura fecha esse número de dias antes de cada vencimento.</div>
          <FieldError>{errors.closing_days_before_due?.message}</FieldError>
        </div>
      ) : (
        <div className="mb-3">
          <label htmlFor="closing_day" className="form-label">
            Dia de fechamento
          </label>
          <input type="number" min={1} max={31} id="closing_day" className="form-control" {...register("closing_day")} />
          <AvisoDiaCartao dia={watch("closing_day")} />
          <FieldError>{errors.closing_day?.message}</FieldError>
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="due_day" className="form-label">
          Dia de vencimento
        </label>
        <input type="number" min={1} max={31} id="due_day" className="form-control" {...register("due_day")} />
        <AvisoDiaCartao dia={watch("due_day")} />
        <FieldError>{errors.due_day?.message}</FieldError>
      </div>

      {avisarRealocacao && (
        <div className="alert alert-info py-2 small">
          <i className="bi bi-info-circle me-1"></i>
          Ao mudar o vencimento ou a regra, as despesas pendentes são realocadas entre as faturas e os ajustes manuais de
          fechamento das faturas não pagas são desfeitos. Faturas com pagamento não mudam.
        </div>
      )}
    </>
  );
}
