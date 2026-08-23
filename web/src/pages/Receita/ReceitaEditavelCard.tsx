import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import InputMoeda from "../../components/InputMoeda";
import { FieldError } from "../../components/FieldError";
import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import { ReceitaFormSchema, type ReceitaForm } from "../../schemas/receita";
import { getTransacao, updateTransacao } from "../../api/transacoes";
import { convertNumberToCurrencyMask } from "../../utils";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { Conta } from "../../types/conta";
import type { TransacaoEditavelCardHandle } from "../Despesa/DespesaEditavelCard";

type Props = {
  id: number;
  contas: Conta[];
};

export const ReceitaEditavelCard = forwardRef<TransacaoEditavelCardHandle, Props>(
  function ReceitaEditavelCard({ id, contas }, ref) {
    const {
      data: receita,
      isLoading,
      isError,
    } = useQuery({
      queryKey: ["receita-editavel", id],
      queryFn: () => getTransacao(id),
      select: (response) => response.data,
    });

    const {
      register,
      handleSubmit,
      setError,
      control,
      setValue,
      reset,
      formState: { errors },
    } = useForm<ReceitaForm>({
      // @ts-expect-error TS não entende Zod transform string->number
      resolver: zodResolver(ReceitaFormSchema),
    });

    useEffect(() => {
      if (receita) {
        const dataFormatada = receita.date_raw ? receita.date_raw.slice(0, 16) : "";

        reset({
          description: receita.description || "",
          account_id: receita.account_id?.toString() || "",
          date: dataFormatada,
          category_name: receita.categoria?.name || "",
          category_id: receita.categoria?.id?.toString() || null,
        });

        setTimeout(() => {
          if (receita.amount) {
            const valorFormatado = convertNumberToCurrencyMask(receita.amount);
            // @ts-expect-error - RHF espera number mas InputMoeda trabalha com string
            setValue("amount", valorFormatado);
          }
        }, 100);
      }
    }, [receita, reset, setValue]);

    const { mutate, isPending, isSuccess } = useMutation({
      mutationFn: (data: ReceitaForm) => updateTransacao(id, data),
      onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
    });

    const submeter = () =>
      new Promise<void>((resolve, reject) => {
        handleSubmit(
          (data) => {
            mutate(data as unknown as ReceitaForm, {
              onSuccess: () => resolve(),
              onError: (error) => reject(error),
            });
          },
          () => reject(new Error("Formulário inválido"))
        )();
      });

    useImperativeHandle(ref, () => ({ submeter }));

    if (isLoading) {
      return (
        <div className="card mb-3">
          <div className="card-body text-center py-4 text-muted">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Carregando receita #{id}...
          </div>
        </div>
      );
    }

    if (isError || !receita) {
      return (
        <div className="card mb-3 border-danger">
          <div className="card-body text-danger">Erro ao carregar a receita #{id}.</div>
        </div>
      );
    }

    return (
      <div className={`card mb-3 ${isSuccess ? "border-success" : ""}`}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <span>
            <strong>#{id}</strong> — {receita.description}
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
            </div>

            <div className="col-lg-6">
              <div className="mb-3">
                <label className="form-label">
                  Data da Receita <span className="text-danger">*</span>
                </label>
                <input type="datetime-local" className="form-control" {...register("date")} />
                <FieldError>{errors.date?.message}</FieldError>
              </div>

              <div className="mb-3">
                <label className="form-label">Categoria</label>
                <Controller
                  name="category_name"
                  control={control}
                  render={({ field }) => (
                    <CategoriaAutocomplete
                      value={field.value || receita.categoria?.name || ""}
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

              {receita.is_installment && (
                <div className="alert alert-info py-2 small mb-0">
                  <i className="bi bi-info-circle me-1"></i>
                  Parcela {receita.installment_number}/{receita.installment_total} — as demais
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
