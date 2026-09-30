import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFaturasDoCartao, reverterPagamentoFatura } from "../../../api/fatura";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { Fatura, FaturaPagavel, StatusFatura } from "../../../types/fatura";
import { PagarFaturaModal } from "./PagarFaturaModal";
import { useConfirmModalStore } from "../../../stores/confirmModal";
import { useCacheUtils } from "../../../hooks/useCacheUtils";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(dataStr: string) {
  const [ano, mes] = dataStr.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

function formatarDataBr(dataStr: string) {
  const [ano, mes, dia] = dataStr.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");
}

const STATUS_BADGE: Record<StatusFatura, string> = {
  ABERTA: "bg-secondary",
  FECHADA: "bg-warning text-dark",
  VENCIDA: "bg-danger",
  PAGA: "bg-success",
};

const STATUS_LABEL: Record<StatusFatura, string> = {
  ABERTA: "Aberta",
  FECHADA: "Fechada",
  VENCIDA: "Vencida",
  PAGA: "Paga",
};

type Props = {
  cartaoId: number;
  contaNome?: string | null;
};

export function FaturasDoCartao({ cartaoId, contaNome }: Props) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["cartao", cartaoId, "faturas"],
    queryFn: () => getFaturasDoCartao(cartaoId),
  });

  const [faturaExpandidaId, setFaturaExpandidaId] = useState<number | null>(null);
  const [faturaParaPagar, setFaturaParaPagar] = useState<FaturaPagavel | null>(null);
  const { openModal } = useConfirmModalStore();
  const queryClient = useQueryClient();
  const { invalidateContas } = useCacheUtils();

  const { mutate: reverter } = useMutation({
    mutationFn: (faturaId: number) => reverterPagamentoFatura(faturaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartao", cartaoId, "faturas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-fatura-atual"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-indicadores"] });
      invalidateContas();
      alert("Pagamento revertido com sucesso!");
    },
    onError: () => {
      alert("Erro ao reverter pagamento. Tente novamente.");
    },
  });

  const faturas: Fatura[] = data?.data || [];

  if (isPending) {
    return <div className="text-muted small py-2">Carregando faturas...</div>;
  }

  if (isError) {
    return <div className="text-danger small py-2">Erro ao carregar as faturas desse cartão.</div>;
  }

  if (faturas.length === 0) {
    return (
      <div className="text-muted small py-2">
        Nenhuma fatura ainda. As faturas aparecem aqui conforme você lança despesas nesse cartão.
      </div>
    );
  }

  return (
    <div className="mt-2">
      {faturas.map((fatura) => {
        const expandida = faturaExpandidaId === fatura.id;

        return (
          <div key={fatura.id} className="border rounded mb-2">
            <div
              className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-2"
              role="button"
              onClick={() => setFaturaExpandidaId(expandida ? null : fatura.id)}
            >
              <div className="d-flex align-items-center gap-2">
                <i className={`bi bi-chevron-${expandida ? "down" : "right"}`}></i>
                <strong>{formatarMesAno(fatura.reference_month)}</strong>
                <span className={`badge ${STATUS_BADGE[fatura.status]}`}>{STATUS_LABEL[fatura.status]}</span>
                <small className="text-muted">vence {formatarDataBr(fatura.due_date)}</small>
              </div>

              <div className="d-flex align-items-center gap-3">
                <span className="fw-medium">{convertNumberToCurrencyMask(fatura.total)}</span>
                {fatura.pendente > 0 && fatura.id !== null ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFaturaParaPagar({ ...fatura, id: fatura.id as number });
                    }}
                  >
                    Pagar fatura
                  </button>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <span className="text-success small">
                      <i className="bi bi-check-circle me-1"></i>
                      Paga
                    </span>
                    {fatura.id !== null && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal({
                            callback: () => reverter(fatura.id as number),
                            title: "Reverter pagamento da fatura",
                            message: `Tem certeza que deseja reverter todos os pagamentos da fatura de ${formatarMesAno(fatura.reference_month)}? Todas as despesas dela voltarão a ficar pendentes.`,
                            autoClose: true,
                          });
                        }}
                      >
                        Reverter pagamento
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {expandida && (
              <div className="table-responsive border-top">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Compra</th>
                      <th>Parcela</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fatura.parcelas.map((parcela) => (
                      <tr key={parcela.id}>
                        <td>{parcela.description}</td>
                        <td>{parcela.categoria?.name ?? "-"}</td>
                        <td>{parcela.purchase_date ? formatarDataBr(parcela.purchase_date) : "-"}</td>
                        <td>
                          {parcela.installment_total
                            ? `${parcela.installment_number}/${parcela.installment_total}`
                            : "Única"}
                        </td>
                        <td>{convertNumberToCurrencyMask(parcela.amount ?? 0)}</td>
                        <td>
                          <span className={`badge ${parcela.status === "PAID" ? "bg-success" : "bg-secondary"}`}>
                            {parcela.status === "PAID" ? "Paga" : "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {faturaParaPagar && (
        <PagarFaturaModal
          fatura={faturaParaPagar}
          contaNome={contaNome}
          onClose={() => setFaturaParaPagar(null)}
        />
      )}
    </div>
  );
}
