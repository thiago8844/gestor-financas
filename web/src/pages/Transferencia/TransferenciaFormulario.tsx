import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";

import InputMoeda from "../../components/InputMoeda";
import { FieldError } from "../../components/FieldError";
import PageLayout from "../../layouts/PageLayout";
import { getContas } from "../../api/conta";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { TransferenciaFormSchema, type TransferenciaForm } from "../../schemas/transferencia";
import type { Conta } from "../../types/conta";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { toast } from "../../utils/toast";

type Props = {
  title: string;
  salvar: (data: TransferenciaForm) => Promise<unknown>;
  mensagemSucesso: string;
  // Valores já no formato do formulário (amount como máscara de moeda), usados na edição.
  valoresIniciais?: Partial<Record<keyof TransferenciaForm, string>>;
  loading?: boolean;
};

export function TransferenciaFormulario({
  title,
  salvar,
  mensagemSucesso,
  valoresIniciais,
  loading,
}: Props) {
  const navigate = useNavigate();
  const { invalidateContas, invalidateFormularios } = useCacheUtils();

  const {
    data: contas = [],
    isLoading: isLoadingContas,
    isError,
  } = useQuery<Conta[]>({
    queryKey: ["contas", "active", "transferencia"],
    queryFn: async () => (await getContas({ active: true, per_page: 100 })).data,
    refetchOnMount: true,
  });

  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors },
  } = useForm<TransferenciaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(TransferenciaFormSchema),
    defaultValues: {
      from_account_id: "",
      to_account_id: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
    },
  });

  useEffect(() => {
    if (valoresIniciais) {
      // @ts-expect-error amount é string (máscara) no formulário e number depois do transform
      reset(valoresIniciais);
    }
  }, [valoresIniciais, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: salvar,
    onSuccess: () => {
      // Muda o saldo das duas contas, então o cache de contas/dashboard precisa recarregar.
      invalidateContas();
      invalidateFormularios();
      toast.success(mensagemSucesso);
      navigate("/transferencias");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => mutate(data as TransferenciaForm);

  if (isError) {
    return (
      <PageLayout title={title} backTo="/transferencias">
        <div className="alert alert-danger">Erro ao carregar dados necessários.</div>
      </PageLayout>
    );
  }

  const opcoesContas = contas.map((conta) => (
    <option key={conta.id} value={conta.id}>
      {conta.name}
    </option>
  ));

  return (
    <PageLayout loading={isLoadingContas || loading} title={title} backTo="/transferencias">
      <div className="container-fluid">
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && <div className="alert alert-danger">{errors.root.message}</div>}

          <div className="row">
            <div className="col-lg-6">
              <div className="mb-3">
                <label htmlFor="from_account_id" className="form-label">
                  Conta de origem <span className="text-danger">*</span>
                </label>
                <select
                  id="from_account_id"
                  className="form-select"
                  {...register("from_account_id")}
                >
                  <option value="">Selecione a conta de origem</option>
                  {opcoesContas}
                </select>
                <FieldError>{errors.from_account_id?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label htmlFor="to_account_id" className="form-label">
                  Conta de destino <span className="text-danger">*</span>
                </label>
                <select id="to_account_id" className="form-select" {...register("to_account_id")}>
                  <option value="">Selecione a conta de destino</option>
                  {opcoesContas}
                </select>
                <FieldError>{errors.to_account_id?.message}</FieldError>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="mb-3">
                <label htmlFor="amount" className="form-label">
                  Valor <span className="text-danger">*</span>
                </label>
                <Controller
                  name="amount"
                  control={control}
                  render={({ field }) => (
                    <InputMoeda {...field} id="amount" value={field.value ?? ""} placeholder="0,00" />
                  )}
                />
                <FieldError>{errors.amount?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label htmlFor="date" className="form-label">
                  Data <span className="text-danger">*</span>
                </label>
                <input type="date" id="date" className="form-control" {...register("date")} />
                <FieldError>{errors.date?.message}</FieldError>
              </div>
            </div>

            <div className="col-12">
              <div className="mb-3">
                <label htmlFor="description" className="form-label">
                  Descrição
                </label>
                <input
                  type="text"
                  id="description"
                  className="form-control"
                  placeholder="Ex.: Reserva de emergência"
                  {...register("description")}
                />
                <FieldError>{errors.description?.message}</FieldError>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 justify-content-end mt-4">
            <button
              type="button"
              className="btn btn-secondary text-white"
              onClick={() => navigate("/transferencias")}
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
                  Salvar Transferência
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}

