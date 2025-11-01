import PageLayout from "../../layouts/PageLayout";
import { useForm, Controller } from "react-hook-form";
import InputMoeda from "../../components/InputMoeda";
import { DespesaFormSchema, type DespesaForm } from "../../schemas/despesa";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../components/FieldError";
import { useMutation, useQuery } from "@tanstack/react-query";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { AxiosError } from "axios";
import { useFormularioDespesa } from "../../hooks/useFormularioDespesa";
import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import type { Conta } from "../../types/conta";
import { getDespesa, updateDespesa } from "../../api/transacoes";
import { useNavigate, useParams } from "react-router-dom";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { convertNumberToCurrencyMask } from "../../utils";
import { useEffect } from "react";

export function EditarDespesa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    contas,
    isLoading: isLoadingForm,
    isError: isErrorForm,
  } = useFormularioDespesa();
  const { invalidateFormularios } = useCacheUtils();

  // ✅ BUSCA DADOS DA DESPESA PARA EDITAR
  const {
    data: despesa,
    isLoading: isLoadingDespesa,
    isError: isErrorDespesa,
  } = useQuery({
    queryKey: ["despesa", id],
    queryFn: () => getDespesa(Number(id)),
    enabled: !!id,
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
  } = useForm<DespesaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(DespesaFormSchema),
    defaultValues: {
      description: "",
      account_id: "",
      date: "",
      category_name: "",
      category_id: null,
      budget_id: "",
    },
  });

  // ✅ PREENCHE FORMULÁRIO QUANDO CARREGA DESPESA - USANDO RESET
  useEffect(() => {
    if (despesa) {
      console.log("🔍 Dados da despesa:", despesa);
      console.log("🔍 CATEGORIA DA DESPESA:", despesa.categoria);

      // ✅ FORMATAÇÃO SIMPLES DA DATA USANDO date_raw
      const dataFormatada = despesa.date_raw
        ? despesa.date_raw.slice(0, 16)
        : "";

      // ✅ RESET COMPLETO DO FORMULÁRIO COM TODOS OS DADOS (exceto amount)
      const dadosParaReset = {
        description: despesa.description || "",
        account_id: despesa.account_id?.toString() || "",
        date: dataFormatada,
        category_name: despesa.categoria?.name || "",
        category_id: despesa.categoria?.id?.toString() || null,
        budget_id: despesa.budget_id?.toString() || "",
        paid: despesa.status === "PAID",
      };

      console.log("🔄 Resetando formulário com:", dadosParaReset);
      console.log(
        "🏷️ CATEGORIA NAME QUE VAI SER RESETADA:",
        dadosParaReset.category_name
      );
      reset(dadosParaReset);

      // ✅ FORÇA CATEGORIA NO RHF (setTimeout garante que reset aconteceu primeiro)
      setTimeout(() => {
        if (despesa.categoria?.name) {
          setValue("category_name", despesa.categoria.name, {
            shouldValidate: true,
          });
          setValue("category_id", despesa.categoria.id.toString(), {
            shouldValidate: true,
          });
          console.log(
            "🏷️ FORÇOU CATEGORIA VIA setValue:",
            despesa.categoria.name
          );
        }

        // 🚨 FORÇA AMOUNT NO RHF TAMBÉM - CONVERTENDO NUMBER PARA STRING
        if (despesa.amount) {
          const valorFormatado = convertNumberToCurrencyMask(despesa.amount);
          // @ts-expect-error - RHF espera number mas InputMoeda trabalha com string
          setValue("amount", valorFormatado);
          console.log("💰 FORÇOU AMOUNT VIA setValue:", valorFormatado);
        }
      }, 100);
    }
  }, [despesa, reset, setValue]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: DespesaForm) => updateDespesa(Number(id), data),
    onSuccess: () => {
      invalidateFormularios(); // ✅ Atualiza cache
      alert("Despesa atualizada com sucesso!");
      navigate("/despesas");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => {
    console.log("📋 Editando despesa:", data);
    mutate(data as DespesaForm);
  };

  // ✅ LOADING E ERROR STATES
  const isLoading = isLoadingForm || isLoadingDespesa;
  const isError = isErrorForm || isErrorDespesa;

  if (isError) {
    return (
      <PageLayout title="Editar Despesa" backTo="/despesas">
        <div className="alert alert-danger">
          Erro ao carregar dados necessários.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      loading={isLoading}
      title={`Editar Despesa ${despesa?.description ? `- ${despesa.id}` : ""}`}
      backTo="/despesas"
    >
      <div className="container-fluid">
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && (
            <div className="alert alert-danger">{errors.root.message}</div>
          )}

          <div className="row">
            {/* ✅ PRIMEIRA COLUNA */}
            <div className="col-lg-6">
              {/* Descrição */}
              <div className="mb-3">
                <label htmlFor="description" className="form-label">
                  Descrição <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="description"
                  className="form-control"
                  placeholder="Descrição"
                  {...register("description")}
                />
                <FieldError>{errors.description?.message}</FieldError>
              </div>

              {/* Conta */}
              <div className="mb-3">
                <label htmlFor="account_id" className="form-label">
                  Conta <span className="text-danger">*</span>
                </label>
                <select
                  id="account_id"
                  className="form-select"
                  {...register("account_id")}
                >
                  <option value="">Selecione uma conta</option>
                  {contas.map((conta: Conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.name}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.account_id?.message}</FieldError>
              </div>

              {/* Valor */}
              <div className="mb-3">
                <label htmlFor="amount" className="form-label">
                  Valor <span className="text-danger">*</span>
                </label>
                <Controller
                  name="amount"
                  control={control}
                  key={`amount-${despesa?.id || "loading"}`} // 🚨 FORÇA RE-RENDER
                  render={({ field }) => (
                    <InputMoeda {...field} placeholder="0,00" />
                  )}
                />
                <FieldError>{errors.amount?.message}</FieldError>
              </div>

              {/* Data */}
              <div className="mb-3">
                <label htmlFor="date" className="form-label">
                  Data <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  id="date"
                  className="form-control"
                  {...register("date")}
                />
                <FieldError>{errors.date?.message}</FieldError>
              </div>
            </div>

            <div className="col-lg-6">
              {/* Categoria */}
              <div className="mb-3">
                <label htmlFor="category_name" className="form-label">
                  Categoria
                </label>
                <Controller
                  name="category_name"
                  control={control}
                  render={({ field }) => {
                    console.log("🏷️ CATEGORIA FIELD VALUE:", field.value);
                    console.log(
                      "🏷️ DESPESA CATEGORIA:",
                      despesa?.categoria?.name
                    );
                    return (
                      <CategoriaAutocomplete
                        value={field.value || despesa?.categoria?.name || ""}
                        onChange={(categoryName, categoryId) => {
                          field.onChange(categoryName);
                          if (categoryId) {
                            setValue("category_id", categoryId.toString());
                          } else {
                            setValue("category_id", null);
                          }
                        }}
                        placeholder="Digite ou selecione uma categoria..."
                      />
                    );
                  }}
                />
                <FieldError>{errors.category_name?.message}</FieldError>
              </div>

              {/* Orçamento */}
              <div className="mb-3">
                <label htmlFor="budget_id" className="form-label">
                  Orçamento (EM BREVE)
                </label>
                <select
                  id="budget_id"
                  disabled
                  className="form-select"
                  {...register("budget_id")}
                >
                  <option value="">Sem orçamento</option>
                </select>
                <FieldError>{errors.budget_id?.message}</FieldError>
              </div>

              {/* Pago */}
              <div className="mb-3">
                <div className="form-check">
                  <input
                    id="paid"
                    type="checkbox"
                    {...register("paid")}
                    className="form-check-input"
                  />
                  <label htmlFor="paid" className="form-check-label">
                    Pago
                  </label>
                </div>
              </div>

              {/* Informações adicionais */}
              <div className="alert alert-warning">
                <h6 className="alert-heading">
                  <i className="bi bi-info-circle me-2"></i>
                  Editando Despesa
                </h6>
                <ul className="mb-0 small">
                  <li>
                    <strong>ID:</strong> {despesa?.id}
                  </li>
                  <li>
                    <strong>Criada em:</strong>{" "}
                    {despesa?.created_at
                      ? new Date(despesa.created_at).toLocaleDateString("pt-BR")
                      : ""}
                  </li>
                  <li>Alterações serão salvas permanentemente</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ✅ BOTÕES DE AÇÃO */}
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

                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={isPending}
                >
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
