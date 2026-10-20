import PageLayout from "../../layouts/PageLayout";
import { useForm } from "react-hook-form";
import { CartaoFormSchema, type CartaoForm } from "../../schemas/cartao";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../components/FieldError";
import { useMutation, useQuery } from "@tanstack/react-query";
import { criarCartao } from "../../api/cartao";
import { getContas } from "../../api/conta";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { AxiosError } from "axios";
import { SubmitBtn } from "../../components/SubmitBtn";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { useNavigate } from "react-router-dom";
import type { Conta } from "../../types/conta";
import { AvisoDiaCartao } from "../../components/Cartao/AvisoDiaCartao";
import { toast } from "../../utils/toast";

export default function Cadastrar() {
  const { invalidateCartoes } = useCacheUtils();
  const navigate = useNavigate();

  const { data: contasData } = useQuery({
    queryKey: ["contas"],
    queryFn: () => getContas({ active: true }),
  });
  const contas: Conta[] = contasData?.data || [];

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<CartaoForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(CartaoFormSchema),
    defaultValues: {
      active: true,
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CartaoForm) => criarCartao(data),
    onSuccess: () => {
      invalidateCartoes();
      navigate("/cartoes");
      toast.success("Cartão criado com sucesso!");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: CartaoForm) => {
    mutate(data);
  };

  return (
    <PageLayout title="Cadastrar Cartão" backTo="/cartoes">
      <div className="container-fluid">
        {/** @ts-expect-error TS não entende Zod transform string->number */}
        <form onSubmit={handleSubmit(onSubmit)} className="container mt-4">
          {errors.root && (
            <div className="alert alert-danger">{errors.root.message}</div>
          )}

          {/* Nome */}
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              Nome do Cartão
            </label>
            <input
              type="text"
              id="name"
              className="form-control"
              {...register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          {/* Conta usada para pagar */}
          <div className="mb-3">
            <label htmlFor="account_id" className="form-label">
              Conta usada para pagar
            </label>
            <select
              id="account_id"
              className="form-select"
              {...register("account_id")}
            >
              <option value="">Selecione uma conta</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.name}
                </option>
              ))}
            </select>
            <FieldError>{errors.account_id?.message}</FieldError>
          </div>

          {/* Dia de fechamento */}
          <div className="mb-3">
            <label htmlFor="closing_day" className="form-label">
              Dia de fechamento
            </label>
            <input
              type="number"
              min={1}
              max={31}
              id="closing_day"
              className="form-control"
              {...register("closing_day")}
            />
            <AvisoDiaCartao dia={watch("closing_day")} />
            <FieldError>{errors.closing_day?.message}</FieldError>
          </div>

          {/* Dia de vencimento */}
          <div className="mb-3">
            <label htmlFor="due_day" className="form-label">
              Dia de vencimento
            </label>
            <input
              type="number"
              min={1}
              max={31}
              id="due_day"
              className="form-control"
              {...register("due_day")}
            />
            <AvisoDiaCartao dia={watch("due_day")} />
            <FieldError>{errors.due_day?.message}</FieldError>
          </div>

          {/* Botão */}
          <SubmitBtn loading={isPending}>Salvar</SubmitBtn>
        </form>
      </div>
    </PageLayout>
  );
}
