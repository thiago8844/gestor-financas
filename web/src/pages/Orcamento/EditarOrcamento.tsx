import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import type { AxiosError } from "axios";

import PageLayout from "../../layouts/PageLayout";
import { OrcamentoFormSchema, type OrcamentoForm } from "../../schemas/orcamento";
import { getOrcamento, updateOrcamento } from "../../api/orcamentos";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { convertNumberToCurrencyMask } from "../../utils";
import { OrcamentoFormFields } from "./OrcamentoFormFields";

export function EditarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: orcamento,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["orcamento", id],
    queryFn: () => getOrcamento(Number(id)),
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
  } = useForm<OrcamentoForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(OrcamentoFormSchema),
  });

  useEffect(() => {
    if (orcamento) {
      reset({
        name: orcamento.name,
        description: orcamento.description || "",
        type: orcamento.type,
        // @ts-expect-error InputMoeda trabalha com string
        amount_limit: orcamento.amount_limit
          ? convertNumberToCurrencyMask(orcamento.amount_limit)
          : "",
        alert_percentage: orcamento.alert_percentage ?? undefined,
        ignore_pending_installments: orcamento.ignore_pending_installments,
        active: orcamento.active,
        frequency: orcamento.frequency ?? undefined,
        interval: orcamento.interval,
        start_date: orcamento.start_date || "",
        periodos:
          orcamento.periodos.length > 0 ? orcamento.periodos : [{ start_date: "", end_date: "" }],
        limite_aplicar_a_partir: "atual",
      });
    }
  }, [orcamento, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: OrcamentoForm) => updateOrcamento(Number(id), data),
    onSuccess: () => {
      alert("Orçamento atualizado com sucesso!");
      navigate("/orcamentos");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => {
    mutate(data as OrcamentoForm);
  };

  if (isError) {
    return (
      <PageLayout title="Editar Orçamento" backTo="/orcamentos">
        <div className="alert alert-danger">Erro ao carregar dados necessários.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout loading={isLoading} title="Editar Orçamento" backTo="/orcamentos">
      <div className="container-fluid">
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && <div className="alert alert-danger">{errors.root.message}</div>}

          <OrcamentoFormFields
            register={register}
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
            mostrarAtivo
            mostrarLimiteAplicarAPartir
          />

          <div className="row mt-4">
            <div className="col-12">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-secondary text-white"
                  onClick={() => navigate("/orcamentos")}
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
