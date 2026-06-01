//TODO: CRIAR TOAST
//TODO: CRIAR DATA PRO SALDO INICIAL ESCOLHER MELHOR BIBLIOTECA DE CALENDÁRIO
//TODO: CRIAR EDIÇÃO DE CONTA, DESATIVAR E EXCLUIR

import PageLayout from "../../layouts/PageLayout";
import { useForm, Controller } from "react-hook-form"; // ← Adicione Controller
import InputMoeda from "../../components/InputMoeda";
import { ContaFormSchema, type ContaForm } from "../../schemas/conta";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../components/FieldError";
import { useMutation } from "@tanstack/react-query";
import { criarConta } from "../../api/conta";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { AxiosError } from "axios";
import { SubmitBtn } from "../../components/SubmitBtn";
import { getBrazilDateTime } from "../../utils";
import { useCacheUtils } from "../../hooks/useCacheUtils"; // ✅ NOVO
import { useNavigate } from "react-router-dom";

export default function Cadastrar() {
  const { invalidateFormularios } = useCacheUtils(); // ✅ NOVO
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    formState: { errors },
  } = useForm<ContaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(ContaFormSchema),
    defaultValues: {
      include_in_networth: true,
      type: "INCOME",
      data_saldo_inicial: getBrazilDateTime(), //Pega a data de hoje como padrão
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ContaForm) => criarConta(data),
    onSuccess: () => {
      invalidateFormularios(); // ✅ Atualiza TODOS os formulários
      navigate("/contas");
      alert("Conta criada com sucesso!");

    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: ContaForm) => {
    mutate(data);
  };

  const tipoSelecionado = watch("type");
  const isReceita = tipoSelecionado === "INCOME";

  return (
    <PageLayout title="Cadastrar Conta"  backTo="/contas">
      <div className="container-fluid">
        {/** @ts-expect-error TS não entende Zod transform string->number */}
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && (
            <div className="alert alert-danger">{errors.root.message}</div>
          )}

          {/* Nome */}
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              Nome da Conta
            </label>
            <input
              type="text"
              id="name"
              className="form-control"
              {...register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          {/* Tipo */}
          {/* <div className="mb-3">
            <label htmlFor="type" className="form-label">
              Tipo
            </label>
            <select {...register("type")} id="type" className="form-select">
              <option value="EXPENSE">Despesa</option>
              <option  value="INCOME">Receita</option>
            </select>
            <FieldError>{errors.type?.message}</FieldError>
          </div> */}

          {/* Incluir no Patrimônio */}
          {isReceita && (
            <div className="form-check mb-3">
              <input
                {...register("include_in_networth")}
                type="checkbox"
                id="include_in_networth"
                className="form-check-input"
              />
              <label className="form-check-label" htmlFor="include_in_networth">
                Incluir no Patrimônio
              </label>
              <FieldError>{errors.include_in_networth?.message}</FieldError>
            </div>
          )}
          {/* Moeda */}
          <div className="mb-3">
            <label htmlFor="currency" className="form-label">
              Moeda
            </label>
            <select
              {...register("currency")}
              id="currency"
              className="form-select"
            >
              <option value="BRL">BRL (R$)</option>
            </select>
            <FieldError>{errors.currency?.message}</FieldError>
          </div>

          {/* Rótulo */}
          {isReceita && (
            <div className="mb-3">
              <label htmlFor="type" className="form-label">
                Rótulo
              </label>
              <select {...register("role")} id="role" className="form-select">
                <option value="">Selecione...</option>
                <option value="dinheiro">Cofre</option>
                <option value="banco">Banco</option>
                <option value="cartão de crédito">Cartão de Crédito</option>
                <option value="conta corrente">Conta Corrente</option>
                <option value="poupança">Poupança</option>
                <option value="investimento">Investimento</option>
                <option value="investimento">Outro</option>
              </select>
              <FieldError>{errors.role?.message}</FieldError>
            </div>
          )}

          {/* Instituição */}
          {isReceita && (
            <div className="mb-3">
              <label htmlFor="instituicao" className="form-label">
                Instituição
              </label>
              <input
                {...register("instituicao")}
                type="text"
                id="instituicao"
                className="form-control"
              />
              <FieldError>{errors.instituicao?.message}</FieldError>
            </div>
          )}

          {/* Saldo Inicial - SÓ ESSA PARTE MUDA */}
          {isReceita && (
            <div className="mb-3">
              <label htmlFor="saldo_inicial" className="form-label">
                Saldo Inicial
              </label>
              <Controller
                name="saldo_inicial"
                control={control}
                render={({ field }) => <InputMoeda {...field} />}
              />

              <FieldError>{errors.saldo_inicial?.message}</FieldError>
            </div>
          )}

          {/* Data do Saldo Inicial */}
          {isReceita && (
            <div className="mb-3">
              <label htmlFor="data_saldo_inicial" className="form-label">
                Data do Saldo Inicial
              </label>
              <input
                type="date"
                id="data_saldo_inicial"
                className="form-control"
                {...register("data_saldo_inicial")}
              />
              <FieldError>{errors.data_saldo_inicial?.message}</FieldError>
            </div>
          )}
          {/* Botão */}
          <SubmitBtn loading={isPending}>Salvar</SubmitBtn>
        </form>
      </div>
    </PageLayout>
  );
}
