import PageLayout from "../../layouts/PageLayout";
import { useForm, Controller } from "react-hook-form";
import InputMoeda from "../../components/InputMoeda";
import { DespesaFormSchema, type DespesaForm } from "../../schemas/despesa";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../components/FieldError";
import { useMutation } from "@tanstack/react-query";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { AxiosError } from "axios";

import type { Conta } from "../../types/conta";
import { criarDespesa } from "../../api/transacoes";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";

export function CadastrarDespesa() {
  const { contas, isLoading, isError } = useFormularioTransacao();
  const [actionType, setActionType] = useState<"save" | "saveAndNew" | null>(
    null
  );
  const [formKey, setFormKey] = useState(0); // ✅ KEY PARA FORÇAR RE-RENDER

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    reset,
    watch,
    unregister, // ✅ ADICIONA UNREGISTER
    formState: { errors },
  } = useForm<DespesaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(DespesaFormSchema),
    defaultValues: {
      date: new Date().toISOString().slice(0, 16),
      status: "PAID",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: DespesaForm) => criarDespesa(data),
    onSuccess: () => {
      if (actionType === "save") {
        // Salvar e voltar para despesas
        alert("Despesa criada com sucesso!");
        navigate("/despesas");
      } else if (actionType === "saveAndNew") {
        // Salvar e criar outra
        const keepFormChecked = (
          document.getElementById("keepForm") as HTMLInputElement
        )?.checked;

        if (keepFormChecked) {
          alert("Despesa criada! Dados mantidos para nova despesa.");

          unregister("amount");
          unregister("category_name");
          unregister("category_id");
          unregister("description");

          setTimeout(() => {
            setValue("description", "");
            setValue("category_name", "");
            setValue("category_id", null);
          }, 50);
        } else {
          alert("Despesa criada! Formulário limpo para nova despesa.");

          // 🔥 STEP 1: REMOVE OS CAMPOS PROBLEMÁTICOS
          unregister("amount");
          unregister("category_name");
          unregister("category_id");
          unregister("status");

          // 🔥 STEP 2: FORÇA RE-RENDER
          setFormKey((prev) => prev + 1);

          // 🔥 STEP 3: RESET APÓS RE-RENDER
          setTimeout(() => {
            reset({
              date: new Date().toISOString().slice(0, 16),
              account_id: "",
              description: "",
              budget_id: "",
              status: 'PAID'
            });
          }, 100);
        }
      }

      // ✅ LIMPA O ESTADO DA AÇÃO
      setActionType(null);
    },
    onError: (error: AxiosError) => {
      setActionType(null); // ✅ LIMPA ESTADO EM CASO DE ERRO
      defaultFormErrorHandler(error, setError);
    },
  });

  // ✅ FUNÇÃO PARA SUBMETER COM AÇÃO ESPECÍFICA
  const onSubmitWithAction = (action: "save" | "saveAndNew") => {
    return handleSubmit((data) => {
      console.log("📋 Dados da despesa:", data);
      console.log("🎯 Ação:", action);

      setActionType(action); // ✅ DEFINE QUAL AÇÃO EXECUTAR
      mutate(data as unknown as DespesaForm);
    });
  };

  if (isError) {
    return (
      <PageLayout title="Cadastrar Despesa" backTo="/despesas">
        <div className="alert alert-danger">
          Erro ao carregar dados necessários.
        </div>
      </PageLayout>
    );
  }

  console.log('Erros de validação: ', errors);

  const status = watch("status");
  const isPago = status === "PAID";

  return (
    <PageLayout
      loading={isLoading}
      title="Cadastrar Despesa"
      backTo="/despesas"
    >
      <div className="container-fluid">
        <form key={formKey} className="container mt-4">
          {/* ✅ KEY PARA FORÇAR RE-RENDER COMPLETO */}
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
              {/* Achar select com pesquisa */}
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
                  render={({ field }) => (
                    <InputMoeda {...field} placeholder="0,00" />
                  )}
                />
                <FieldError>{errors.amount?.message}</FieldError>
              </div>

              {/* Pago */}
              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    id="paid"
                    type="checkbox"
                    role="switch"
                    className="form-check-input"
                    checked={isPago} // ✅ CONTROLADO PELO STATUS
                    onChange={(e) => {
                      const newStatus = e.target.checked ? "PAID" : "PENDING";
                      setValue("status", newStatus); // ✅ USA setValue AO INVÉS DE register().onChange

                      // ✅ LIMPA O CAMPO QUE NÃO ESTÁ SENDO USADO
                      if (e.target.checked) {
                        // Se marcou como PAGO, limpa vencimento
                        setValue("due_date", "");
                      } else {
                        // Se desmarcou (PENDENTE), limpa data transação
                        setValue("date", "");
                      }
                    }}
                  />
                  <label htmlFor="paid" className="form-check-label">
                    Pago?
                  </label>
                </div>
              </div>

              {/* Data da transação - SÓ SE PAGO */}
              {isPago && (
                <div className="mb-3">
                  <label htmlFor="date" className="form-label">
                    Data da Transação <span className="text-danger">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="date"
                    className="form-control"
                    {...register("date")}
                  />
                  <FieldError>{errors.date?.message}</FieldError>
                </div>
              )}

              {/* Data de Vencimento - SÓ SE NÃO PAGO */}
              {!isPago && (
                <div className="mb-3">
                  <label htmlFor="due_date" className="form-label">
                    Data de Vencimento <span className="text-danger"></span>
                  </label>
                  <input
                    type="datetime-local"
                    id="due_date"
                    className="form-control"
                    {...register("due_date")}
                  />
                  <FieldError>{errors.due_date?.message}</FieldError>
                </div>
              )}
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
                  render={({ field }) => (
                    <CategoriaAutocomplete
                      value={field.value || ""}
                      onChange={(categoryName, categoryId) => {
                        // ✅ ATUALIZA O NOME DA CATEGORIA NO FORM
                        field.onChange(categoryName);

                        // ✅ ATUALIZA O ID DA CATEGORIA SE EXISTIR
                        if (categoryId) {
                          // Se categoria existe, usa o ID
                          setValue("category_id", categoryId.toString());
                        } else {
                          // Se é nova categoria, limpa o ID
                          setValue("category_id", null);
                        }
                      }}
                      placeholder="Digite ou selecione uma categoria..."
                    />
                  )}
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
                  <option value="1">💰 Orçamento Mensal</option>
                  <option value="2">🍽️ Alimentação Outubro</option>
                  <option value="3">🚗 Transporte Q4</option>
                  <option value="4">🏥 Saúde Anual</option>
                </select>
                <FieldError>{errors.budget_id?.message}</FieldError>
              </div>

              {/* ACHAR OUTRO LUGAR PARA ESSAS DICAS 
              INFOS
              <div className="alert alert-info">
                <h6 className="alert-heading">
                  <i className="bi bi-info-circle me-2"></i>
                  Dicas
                </h6>
                <ul className="mb-0 small">
                  <li>Use descrições claras para facilitar a busca</li>
                  <li>Categorias ajudam na organização dos gastos</li>
                  <li>Orçamentos controlam seus limites mensais</li>
                </ul>
              </div>
              */}
            </div>
          </div>

          {/* ✅ BOTÕES DE AÇÃO */}
          <div className="row mt-4">
            <div className="col-12 mb-3">
              <div className="d-flex justify-content-end">
                <div className="form-check">
                  <input
                    type="checkbox"
                    name="keepForm"
                    id="keepForm"
                    className="form-check-input"
                  />
                  <label htmlFor="keepForm" className="form-check-label">
                    Manter dados da despesa antiga preenchidos ao criar uma nova
                  </label>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-secondary text-white"
                  onClick={() => navigate("/despesas")}
                  disabled={isPending}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Cancelar
                </button>

                {/* ✅ SALVAR E CRIAR OUTRA */}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onSubmitWithAction("saveAndNew")}
                  disabled={isPending}
                >
                  {isPending && actionType === "saveAndNew" ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-copy me-2"></i>
                      Salvar e Criar outra
                    </>
                  )}
                </button>

                {/* ✅ SALVAR E VOLTAR */}
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={onSubmitWithAction("save")}
                  disabled={isPending}
                >
                  {isPending && actionType === "save" ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Salvar Despesa
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
