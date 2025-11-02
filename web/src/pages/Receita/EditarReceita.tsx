import PageLayout from "../../layouts/PageLayout";
import { useForm, Controller } from "react-hook-form";
import InputMoeda from "../../components/InputMoeda";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../components/FieldError";
import { useMutation, useQuery } from "@tanstack/react-query";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { AxiosError } from "axios";

import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import type { Conta } from "../../types/conta";
import { getTransacao, updateTransacao } from "../../api/transacoes";
import { useNavigate, useParams } from "react-router-dom";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { convertNumberToCurrencyMask } from "../../utils";
import { useEffect } from "react";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";
import { ReceitaFormSchema, type ReceitaForm } from "../../schemas/receita";

export function EditarReceita() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    contas,
    isLoading: isLoadingForm,
    isError: isErrorForm,
  } = useFormularioTransacao();
  const { invalidateFormularios } = useCacheUtils();

  // ✅ BUSCA DADOS DA RECEITA PARA EDITAR
  const {
    data: receita,
    isLoading: isLoadingReceita,
    isError: isErrorReceita,
  } = useQuery({
    queryKey: ["receita", id],
    queryFn: () => getTransacao(Number(id)),
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
  } = useForm<ReceitaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(ReceitaFormSchema),
    defaultValues: {
      description: "",
      account_id: "",
      date: "",
      category_name: "",
      category_id: null,
      budget_id: "",
      type: "INCOME",
      status: 'PAID'
    },
  });

  // ✅ PREENCHE FORMULÁRIO QUANDO CARREGA RECEITA - USANDO RESET
  useEffect(() => {
    if (receita) {
      console.log("🔍 Dados da receita:", receita);
      console.log("🔍 CATEGORIA DA RECEITA:", receita.categoria);

      // ✅ FORMATAÇÃO SIMPLES DA DATA USANDO date_raw
      const dataFormatada = receita.date_raw
        ? receita.date_raw.slice(0, 16)
        : "";

      // ✅ RESET COMPLETO DO FORMULÁRIO COM TODOS OS DADOS (exceto amount)
      const dadosParaReset = {
        description: receita.description || "",
        account_id: receita.account_id?.toString() || "",
        date: dataFormatada,
        category_name: receita.categoria?.name || "",
        category_id: receita.categoria?.id?.toString() || null,
        budget_id: receita.budget_id?.toString() || "",
      };

      reset(dadosParaReset);

      // ✅ FORÇA CATEGORIA NO RHF (setTimeout garante que reset aconteceu primeiro)
      setTimeout(() => {
        if (receita.categoria?.name) {
          setValue("category_name", receita.categoria.name, {
            shouldValidate: true,
          });
          setValue("category_id", receita.categoria.id.toString(), {
            shouldValidate: true,
          });
          console.log(
            "🏷️ FORÇOU CATEGORIA VIA setValue:",
            receita.categoria.name
          );
        }

        // 🚨 FORÇA AMOUNT NO RHF TAMBÉM - CONVERTENDO NUMBER PARA STRING
        if (receita.amount) {
          const valorFormatado = convertNumberToCurrencyMask(receita.amount);
          // @ts-expect-error - RHF espera number mas InputMoeda trabalha com string
          setValue("amount", valorFormatado);
          console.log("💰 FORÇOU AMOUNT VIA setValue:", valorFormatado);
        }
      }, 100);
    }
  }, [receita, reset, setValue]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ReceitaForm) => updateTransacao(Number(id), data),
    onSuccess: () => {
      invalidateFormularios(); // ✅ Atualiza cache
      alert("Receita atualizada com sucesso!");
      navigate("/receitas");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: unknown) => {
    console.log("📋 Editando receita:", data);
    mutate(data as ReceitaForm);
  };

  // ✅ LOADING E ERROR STATES
  const isLoading = isLoadingForm || isLoadingReceita;
  const isError = isErrorForm || isErrorReceita;

  if (isError) {
    return (
      <PageLayout title="Editar Receita" backTo="/receitas">
        <div className="alert alert-danger">
          Erro ao carregar dados necessários.
        </div>
      </PageLayout>
    );
  }

  console.log(errors);

  return (
    <PageLayout
      loading={isLoading}
      title={`Editar Receita ${receita?.description ? `- ${receita.id}` : ""}`}
      backTo="/receitas"
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
                  key={`amount-${receita?.id || "loading"}`}
                  render={({ field }) => (
                    <InputMoeda {...field} placeholder="0,00" />
                  )}
                />
                <FieldError>{errors.amount?.message}</FieldError>
              </div>

              {/* Data da Receita */}
              <div className="mb-3">
                <label htmlFor="date" className="form-label">
                  Data da Receita <span className="text-danger">*</span>
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
                      "🏷️ RECEITA CATEGORIA:",
                      receita?.categoria?.name
                    );
                    return (
                      <CategoriaAutocomplete
                        value={field.value || receita?.categoria?.name || ""}
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

              {/* Informações adicionais */}
              <div className="alert alert-success">
                <h6 className="alert-heading">
                  <i className="bi bi-info-circle me-2"></i>
                  Editando Receita
                </h6>
                <ul className="mb-0 small">
                  <li>
                    <strong>ID:</strong> {receita?.id}
                  </li>
                  <li>
                    <strong>Criada em:</strong>{" "}
                    {receita?.created_at
                      ? new Date(receita.created_at).toLocaleDateString("pt-BR")
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
                  onClick={() => navigate("/receitas")}
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