import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import type { AxiosError } from "axios";

import PageLayout from "../../layouts/PageLayout";
import { RecorrenciaFormSchema, type RecorrenciaForm } from "../../schemas/recorrencia";
import { getRecorrencia, updateRecorrencia } from "../../api/recorrencias";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { convertNumberToCurrencyMask } from "../../utils";
import { RecorrenciaFormFields } from "./RecorrenciaFormFields";

export function EditarRecorrencia() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { contas, isLoading: isLoadingForm, isError: isErrorForm } = useFormularioTransacao();

  const {
    data: recorrencia,
    isLoading: isLoadingRecorrencia,
    isError: isErrorRecorrencia,
  } = useQuery({
    queryKey: ["recorrencia", id],
    queryFn: () => getRecorrencia(Number(id)),
    enabled: !!id,
    select: (response) => response.data,
  });

  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RecorrenciaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(RecorrenciaFormSchema),
  });

  useEffect(() => {
    if (recorrencia) {
      reset({
        type: recorrencia.type,
        description: recorrencia.description,
        account_id: recorrencia.account_id?.toString() || "",
        category_id: recorrencia.categoria?.id?.toString() || null,
        category_name: recorrencia.categoria?.name || "",
        valorFixo: recorrencia.amount !== null,
        // @ts-expect-error InputMoeda trabalha com string
        amount: recorrencia.amount ? convertNumberToCurrencyMask(recorrencia.amount) : "",
        default_status: recorrencia.default_status,
        frequency: recorrencia.frequency,
        interval: recorrencia.interval,
        days_of_week: recorrencia.days_of_week || [],
        day_of_month: recorrencia.day_of_month ?? undefined,
        month_of_year: recorrencia.month_of_year ?? undefined,
        start_date: recorrencia.start_date,
        end_date: recorrencia.end_date || "",
        active: recorrencia.active,
      });
    }
  }, [recorrencia, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: RecorrenciaForm) => updateRecorrencia(Number(id), data),
    onSuccess: () => {
      alert("Recorrência atualizada com sucesso!");
      navigate("/recorrencias");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => {
    mutate(data as RecorrenciaForm);
  };

  const isLoading = isLoadingForm || isLoadingRecorrencia;
  const isError = isErrorForm || isErrorRecorrencia;

  if (isError) {
    return (
      <PageLayout title="Editar Recorrência" backTo="/recorrencias">
        <div className="alert alert-danger">Erro ao carregar dados necessários.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout loading={isLoading} title="Editar Recorrência" backTo="/recorrencias">
      <div className="container-fluid">
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && <div className="alert alert-danger">{errors.root.message}</div>}

          <RecorrenciaFormFields
            register={register}
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
            contas={contas}
            mostrarAtivo
          />

          <div className="row mt-4">
            <div className="col-12">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-secondary text-white"
                  onClick={() => navigate("/recorrencias")}
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
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
