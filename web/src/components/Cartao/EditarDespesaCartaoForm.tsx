import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import InputMoeda from "../InputMoeda";
import { FieldError } from "../FieldError";
import { InfoPopover } from "../InfoPopover";
import {
  EditarValorDespesaSchema,
  type EditarValorDespesaForm,
} from "../../schemas/editarValorDespesa";
import { atualizarValorDespesa } from "../../api/transacoes";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { convertNumberToCurrencyMask } from "../../utils";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import type { Transacao } from "../../types/transacao";

const EXPLICACAO_BLOQUEIO =
  "Essa despesa pertence a um cartão e faz parte do grupo de parcelas da fatura, por isso não é possível editar esses campos aqui. Se precisar mudar algo além do valor, exclua todas as despesas desse grupo e cadastre a compra novamente.";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(dataStr: string) {
  const [ano, mes] = dataStr.slice(0, 10).split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

type Props = {
  despesa: Transacao;
};

export function EditarDespesaCartaoForm({ despesa }: Props) {
  const navigate = useNavigate();
  const { invalidateFormularios } = useCacheUtils();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditarValorDespesaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(EditarValorDespesaSchema),
    defaultValues: {
      // @ts-expect-error InputMoeda trabalha com string, o schema transforma em number no submit
      amount: convertNumberToCurrencyMask(despesa.amount ?? 0),
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: EditarValorDespesaForm) => atualizarValorDespesa(despesa.id, data.amount),
    onSuccess: () => {
      invalidateFormularios();
      alert("Valor atualizado com sucesso!");
      navigate("/despesas");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: EditarValorDespesaForm) => {
    mutate(data);
  };

  return (
    // @ts-expect-error TS não entende Zod transform string->number
    <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
      {errors.root && (
        <div className="alert alert-danger">{errors.root.message}</div>
      )}

      <div className="alert alert-secondary d-flex align-items-start">
        <i className="bi bi-credit-card fs-5 me-2"></i>
        <div className="flex-grow-1">
          <strong>Despesa do cartão {despesa.cartao?.name}</strong>
          {despesa.fatura && (
            <div className="small text-muted">
              Fatura de {formatarMesAno(despesa.fatura.reference_month)} · vence{" "}
              {despesa.due_date ?? "-"}
            </div>
          )}
          {despesa.is_installment && (
            <div className="small text-muted">
              Parcela {despesa.installment_number}/{despesa.installment_total} — as demais
              parcelas do grupo são editadas separadamente, cada uma na sua própria fatura.
            </div>
          )}
        </div>
        <InfoPopover text={EXPLICACAO_BLOQUEIO} />
      </div>

      <div className="row">
        <div className="col-lg-6">
          <div className="mb-3">
            <label className="form-label">Descrição</label>
            <input type="text" className="form-control" value={despesa.description} disabled />
          </div>

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

          <div className="mb-3">
            <label className="form-label">Categoria</label>
            <input
              type="text"
              className="form-control"
              value={despesa.categoria?.name ?? "Sem categoria"}
              disabled
            />
          </div>
        </div>

        <div className="col-lg-6">
          <div className="mb-3">
            <label className="form-label">Pago com</label>
            <input type="text" className="form-control" value={despesa.conta?.name ?? "-"} disabled />
          </div>

          <div className="mb-3">
            <label className="form-label">Vencimento</label>
            <input type="text" className="form-control" value={despesa.due_date ?? "-"} disabled />
          </div>

          <div className="mb-3">
            <label className="form-label">Status</label>
            <input
              type="text"
              className="form-control"
              value={despesa.status === "PAID" ? "Pago" : "Pendente"}
              disabled
            />
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate("/despesas")}
              disabled={isPending}
            >
              <i className="bi bi-x-circle me-2"></i>
              Cancelar
            </button>

            <button type="submit" className="btn btn-success" disabled={isPending}>
              {isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Salvar valor
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
