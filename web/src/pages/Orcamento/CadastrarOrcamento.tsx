import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";

import PageLayout from "../../layouts/PageLayout";
import { OrcamentoFormSchema, type OrcamentoForm } from "../../schemas/orcamento";
import { criarOrcamento } from "../../api/orcamentos";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { OrcamentoFormFields } from "./OrcamentoFormFields";

export function CadastrarOrcamento() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrcamentoForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(OrcamentoFormSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "ONE_TIME",
      ignore_pending_installments: false,
      active: true,
      interval: 1,
      periodos: [{ start_date: "", end_date: "" }],
      start_date: new Date().toISOString().slice(0, 10),
      frequency: "MONTHLY",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: OrcamentoForm) => criarOrcamento(data),
    onSuccess: () => {
      alert("Orçamento criado com sucesso!");
      navigate("/orcamentos");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => {
    mutate(data as OrcamentoForm);
  };

  return (
    <PageLayout title="Novo Orçamento" backTo="/orcamentos">
      <div className="container-fluid">
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && <div className="alert alert-danger">{errors.root.message}</div>}

          <OrcamentoFormFields
            register={register}
            control={control}
            errors={errors}
            watch={watch}
            setValue={setValue}
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
                      Salvar Orçamento
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
