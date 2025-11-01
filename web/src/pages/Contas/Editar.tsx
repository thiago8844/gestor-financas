import PageLayout from "../../layouts/PageLayout";
import { useForm, Controller } from "react-hook-form"; // ← Adicione Controller
import InputMoeda from "../../components/InputMoeda";
import { ContaFormSchema, type ContaForm } from "../../schemas/conta";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../components/FieldError";
import { useMutation, useQuery } from "@tanstack/react-query";
import { buscarConta, editarConta } from "../../api/conta";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { AxiosError } from "axios";
import { SubmitBtn } from "../../components/SubmitBtn";
import { useParams } from "react-router-dom";
import { useEffect } from "react";

export default function Editar() {
  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors },
  } = useForm<ContaForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(ContaFormSchema),
    defaultValues: {
      include_in_networth: true,
    },
  });

  //Pegar o ID da conta da rota
  const { id } = useParams<{ id: string }>();

  //Pega os dados da conta a ser editada
  //TODO: Abstrair para um hook separado
  const {
    data: conta,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["conta", id],
    queryFn: () => buscarConta(id!),
    enabled: id !== undefined,
  });

  //CARREGA OS VALORES NO FORMULÁRIO
  useEffect(() => {
    console.log("useEffect chamado");
    console.log("Conta recebida:", conta);
    console.log("ID atual:", id);

    if (conta) {
      // ✅ SÓ CARREGA CAMPOS BASEADO NO TIPO
      if (conta.type === "EXPENSE") {

        const formData = {
          name: conta.name || "",
          type: conta.type,
          currency: conta.currency || "BRL",
        };
        console.log("Carregando dados de DESPESA:", formData);
        reset(formData);
      } else {
        const dataFormatada = conta.data_saldo_inicial
          ? new Date(conta.data_saldo_inicial).toISOString().slice(0, 16)
          : "";

        const formData = {
          name: conta.name || "",
          type: conta.type,
          role: conta.role || "",
          include_in_networth: conta.include_in_networth ? true : false,
          currency: conta.currency || "BRL",
          instituicao: conta.instituicao || "",
          saldo_inicial: String(conta.saldo_inicial),
          data_saldo_inicial: dataFormatada,
        };
        // @ts-expect-error TS NÃO ENTENDE QUE O CAMPO É STRING E USA TRANSFORM PRA VIRAR NUMBER
        reset(formData);
      }

    }
  }, [conta, reset, id]);

  const isReceita = conta?.type === "INCOME";

  //Edição da conta
  const { mutate, isPending } = useMutation({
    mutationFn: (data: ContaForm) => editarConta(Number(id), data),
    onSuccess: () => {
      alert("Conta editada com sucesso!");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  console.log(errors);

  const onSubmit = (data: ContaForm) => {
    // Se for despesa, remove os campos que não se aplicam
    if (data.type === "EXPENSE") {
      delete data.role;
      delete data.instituicao;
      delete data.saldo_inicial;
      delete data.data_saldo_inicial;
      delete data.include_in_networth;
    }

    mutate(data);
  };

  // TODO: MUDAR PARA BOTÕES TENTAR NOVAMENTE
  if (isLoading) {
    return (
      <div>
        Carregando ... <button onClick={() => refetch()}>refetch</button>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        Erro ao carregar conta.{" "}
        <button onClick={() => refetch()}>refetch</button>
      </div>
    );
  }

  return (
    <PageLayout title="Editar Conta">
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
          <div className="mb-3">
            <label htmlFor="type" className="form-label">
              Tipo
            </label>
            <select
              disabled={true}
              {...register("type")}
              id="type"
              className="form-select"
            >
              <option value="EXPENSE">Despesa</option>
              <option value="INCOME">Receita</option>
            </select>
            <FieldError>{errors.type?.message}</FieldError>
          </div>

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
                type="datetime-local"
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
