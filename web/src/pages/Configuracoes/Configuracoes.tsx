import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import PageLayout from "../../layouts/PageLayout";
import { FieldError } from "../../components/FieldError";
import { atualizarConfiguracoes, getConfiguracoes } from "../../api/configuracao";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { CONFIGURACAO_DIAS_MAXIMO, type Configuracao } from "../../types/configuracao";
import { toast } from "../../utils/toast";

const OPCOES_DIAS = Array.from({ length: CONFIGURACAO_DIAS_MAXIMO + 1 }, (_, i) => i);

function labelDias(dias: number) {
  if (dias === 0) return "Desativado";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function descricaoAviso(dias: number) {
  if (dias === 0) return "Você não receberá avisos antes do vencimento.";
  if (dias === 1) return "Você será avisado 1 dia antes e no dia do vencimento.";
  return `Você será avisado todos os dias, de ${dias} dias antes até o dia do vencimento.`;
}

function descricaoUrgencia(dias: number) {
  if (dias === 0) return "Você não receberá alertas de despesas vencidas.";
  if (dias === 1) return "Você será alertado por 1 dia após o vencimento.";
  return `Você será alertado todos os dias, por até ${dias} dias após o vencimento. Depois disso, o sistema para de avisar.`;
}

function ConfiguracoesForm({ configuracao }: { configuracao: Configuracao }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<Configuracao>({ defaultValues: configuracao });

  const { mutate, isPending } = useMutation({
    mutationFn: atualizarConfiguracoes,
    onSuccess: (salvo) => {
      queryClient.setQueryData(["configuracoes"], salvo);
      reset(salvo);
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        mutate({
          notify_upcoming_days: Number(dados.notify_upcoming_days),
          auto_pay_invoices: dados.auto_pay_invoices,
          notify_overdue_days: Number(dados.notify_overdue_days),
        })
      )}
      className="container mt-2"
      style={{ maxWidth: 720 }}
    >
      {errors.root && <div className="alert alert-danger">{errors.root.message}</div>}

      <h5 className="fw-bold mb-3">
        <i className="bi bi-bell me-2 text-primary"></i>
        Notificações
      </h5>

      {/* Aviso: pagamentos a vencer */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <label htmlFor="notify_upcoming_days" className="form-label fw-semibold">
            <i className="bi bi-clock-history me-2 text-warning"></i>
            Avisar sobre pagamentos a vencer
          </label>
          <select
            id="notify_upcoming_days"
            className="form-select"
            {...register("notify_upcoming_days", { valueAsNumber: true })}
          >
            {OPCOES_DIAS.map((dias) => (
              <option key={dias} value={dias}>
                {dias === 0 ? "Desativado" : `${labelDias(dias)} antes`}
              </option>
            ))}
          </select>
          <div className="form-text">{descricaoAviso(Number(watch("notify_upcoming_days")))}</div>
          <FieldError>{errors.notify_upcoming_days?.message}</FieldError>
        </div>
      </div>

      {/* Urgência: despesas vencidas e não pagas */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <label htmlFor="notify_overdue_days" className="form-label fw-semibold">
            <i className="bi bi-exclamation-triangle me-2 text-danger"></i>
            Avisar sobre despesas vencidas e não pagas
          </label>
          <select
            id="notify_overdue_days"
            className="form-select"
            {...register("notify_overdue_days", { valueAsNumber: true })}
          >
            {OPCOES_DIAS.map((dias) => (
              <option key={dias} value={dias}>
                {dias === 0 ? "Desativado" : `Até ${labelDias(dias)} depois`}
              </option>
            ))}
          </select>
          <div className="form-text">{descricaoUrgencia(Number(watch("notify_overdue_days")))}</div>
          <FieldError>{errors.notify_overdue_days?.message}</FieldError>
        </div>
      </div>

      <h5 className="fw-bold mb-3">
        <i className="bi bi-credit-card me-2 text-primary"></i>
        Cartões
      </h5>

      {/* Quitação automática de faturas */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="auto_pay_invoices"
              {...register("auto_pay_invoices")}
            />
            <label className="form-check-label fw-semibold" htmlFor="auto_pay_invoices">
              Quitar faturas de cartão automaticamente
            </label>
          </div>
          <div className="form-text">
            Use se o pagamento das suas faturas é em débito automático: no vencimento, a fatura é marcada como paga
            na conta vinculada ao cartão, sem você precisar quitar manualmente.
          </div>
          <FieldError>{errors.auto_pay_invoices?.message}</FieldError>
        </div>
      </div>

      <button type="submit" className="btn btn-primary w-100" disabled={isPending || !isDirty}>
        {isPending ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        ) : (
          "Salvar configurações"
        )}
      </button>
    </form>
  );
}

export function Configuracoes() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["configuracoes"],
    queryFn: getConfiguracoes,
  });

  return (
    <PageLayout title="Configurações" loading={isLoading}>
      {isError && <div className="alert alert-danger">Erro ao carregar as configurações.</div>}
      {data && <ConfiguracoesForm configuracao={data} />}
    </PageLayout>
  );
}
