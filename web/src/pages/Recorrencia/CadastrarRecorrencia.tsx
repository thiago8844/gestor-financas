import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";

import PageLayout from "../../layouts/PageLayout";
import { RecorrenciaFormSchema, type RecorrenciaForm } from "../../schemas/recorrencia";
import { criarRecorrencia } from "../../api/recorrencias";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { RecorrenciaFormFields } from "./RecorrenciaFormFields";

export function CadastrarRecorrencia() {
  const { contas, isLoading, isError } = useFormularioTransacao();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RecorrenciaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(RecorrenciaFormSchema),
    defaultValues: {
      type: "EXPENSE",
      description: "",
      account_id: "",
      category_id: null,
      category_name: "",
      valorFixo: false,
      default_status: "PENDING",
      frequency: "MONTHLY",
      interval: 1,
      days_of_week: [],
      start_date: new Date().toISOString().slice(0, 10),
      end_date: "",
      active: true,
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: RecorrenciaForm) => criarRecorrencia(data),
    onSuccess: () => {
      alert("Recorrência criada com sucesso!");
      navigate("/recorrencias");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => {
    mutate(data as RecorrenciaForm);
  };

  if (isError) {
    return (
      <PageLayout title="Nova Recorrência" backTo="/recorrencias">
        <div className="alert alert-danger">Erro ao carregar dados necessários.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout loading={isLoading} title="Nova Recorrência" backTo="/recorrencias">
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
                      Salvar Recorrência
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
