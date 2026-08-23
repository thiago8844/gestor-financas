import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import InputMoeda from "../../components/InputMoeda";
import { FieldError } from "../../components/FieldError";
import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import { DespesaFormSchema, type DespesaForm } from "../../schemas/despesa";
import { getDespesa, updateDespesa } from "../../api/transacoes";
import { convertNumberToCurrencyMask } from "../../utils";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { Conta } from "../../types/conta";

export type TransacaoEditavelCardHandle = {
  submeter: () => Promise<void>;
};

type Props = {
  id: number;
  contas: Conta[];
};

export const DespesaEditavelCard = forwardRef<TransacaoEditavelCardHandle, Props>(
  function DespesaEditavelCard({ id, contas }, ref) {
    const {
      data: despesa,
      isLoading,
      isError,
    } = useQuery({
      queryKey: ["despesa-editavel", id],
      queryFn: () => getDespesa(id),
      select: (response) => response.data,
    });

    const {
      register,
      handleSubmit,
      setError,
      control,
      setValue,
      watch,
      reset,
      formState: { errors },
    } = useForm<DespesaForm>({
      // @ts-expect-error TS não entende Zod transform string->number
      resolver: zodResolver(DespesaFormSchema),
    });

    useEffect(() => {
      if (despesa) {
        const dataFormatada = despesa.date_raw ? despesa.date_raw.slice(0, 16) : "";
        const dataVencimentoFormatada = despesa.due_date_raw
          ? despesa.due_date_raw.slice(0, 16)
          : "";

        reset({
          description: despesa.description || "",
          account_id: despesa.account_id?.toString() || "",
          date: dataFormatada,
          due_date: dataVencimentoFormatada,
          category_name: despesa.categoria?.name || "",
          category_id: despesa.categoria?.id?.toString() || null,
          status: despesa.status,
        });

        setTimeout(() => {
          if (despesa.amount) {
            const valorFormatado = convertNumberToCurrencyMask(despesa.amount);
            // @ts-expect-error - RHF espera number mas InputMoeda trabalha com string
            setValue("amount", valorFormatado);
          }
        }, 100);
      }
    }, [despesa, reset, setValue]);

    const {
      mutate,
      isPending,
      isSuccess,
    } = useMutation({
      mutationFn: (data: DespesaForm) => updateDespesa(id, data),
      onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
    });

    const submeter = () =>
      new Promise<void>((resolve, reject) => {
        handleSubmit(
          (data) => {
            mutate(data as unknown as DespesaForm, {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            });
          },
          () => reject(new Error("Formulário inválido"))
        )();
      });

    useImperativeHandle(ref, () => ({ submeter }));

    const status = watch("status");
    const isPago = status === "PAID";

    if (isLoading) {
      return (
        <div className="card mb-3">
          <div className="card-body text-center py-4 text-muted">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Carregando despesa #{id}...
          </div>
        </div>
      );
    }

    if (isError || !despesa) {
      return (
        <div className="card mb-3 border-danger">
          <div className="card-body text-danger">
            Erro ao carregar a despesa #{id}.
          </div>
        </div>
      );
    }

    return (
      <div className={`card mb-3 ${isSuccess ? "border-success" : ""}`}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>
            <strong>#{id}</strong> — {despesa.description}
          </span>
          {isSuccess && (
            <span className="badge text-bg-success">
              <i className="bi bi-check-circle me-1"></i>
              Salvo
            </span>
          )}
        </div>

        <div className="card-body">
          {errors.root && (
            <div className="alert alert-danger py-2 small">{errors.root.message}</div>
          )}

          <div className="row">
            <div className="col-lg-6">
              <div className="mb-3">
                <label className="form-label">
                  Descrição <span className="text-danger">*</span>
                </label>
                <input type="text" className="form-control" {...register("description")} />
                <FieldError>{errors.description?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Conta <span className="text-danger">*</span>
                </label>
                <select className="form-select" {...register("account_id")}>
                  <option value="">Selecione uma conta</option>
                  {contas.map((conta: Conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.name}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.account_id?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label className="form-label">
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
                <div className="form-check form-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    className="form-check-input"
                    checked={isPago}
                    onChange={(e) => {
                      const newStatus = e.target.checked ? "PAID" : "PENDING";
                      setValue("status", newStatus);
                      if (!e.target.checked) {
                        setValue("date", "");
                      }
                    }}
                  />
                  <label className="form-check-label">Pago?</label>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="mb-3">
                <label className="form-label">Data da Transação</label>
                <input
                  disabled={!isPago}
                  type="datetime-local"
                  className="form-control"
                  {...register("date")}
                />
                <FieldError>{errors.date?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label className="form-label">Data de Vencimento</label>
                <input type="datetime-local" className="form-control" {...register("due_date")} />
                <FieldError>{errors.due_date?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label className="form-label">Categoria</label>
                <Controller
                  name="category_name"
                  control={control}
                  render={({ field }) => (
                    <CategoriaAutocomplete
                      value={field.value || despesa.categoria?.name || ""}
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

              {despesa.is_installment && (
                <div className="alert alert-info py-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Parcela {despesa.installment_number}/{despesa.installment_total} — as demais
                  parcelas são editadas separadamente.
                </div>
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={() => submeter()}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-1"></i>
                  Salvar somente essa
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
);
