import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FATURA_ATUAL_OFFSET_MAXIMO, getFaturaAtualDashboard } from "../../../api/dashboard";
import { convertNumberToCurrencyMask } from "../../../utils";
import { PagarFaturaModal } from "../../Cartoes/components/PagarFaturaModal";
import type { FaturaPagavel, StatusFatura } from "../../../types/fatura";

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

export function FaturaAtualCard() {
  const [offset, setOffset] = useState(0);

  const { data, isFetching } = useQuery({
    queryKey: ["dashboard-fatura-atual", offset],
    queryFn: () => getFaturaAtualDashboard(offset),
  });

  const [faturaParaPagar, setFaturaParaPagar] = useState<FaturaPagavel | null>(null);

  // Só não mostra nada quando não há exatamente 1 cartão cadastrado (0, ou 2+, seria ambíguo).
  // Com 1 cartão, a fatura aparece sempre, mesmo zerada.
  if (!data?.fatura || !data.cartao) {
    return null;
  }

  const { cartao, fatura } = data;
  const podeVoltar = offset > -FATURA_ATUAL_OFFSET_MAXIMO;
  const podeAvancar = offset < FATURA_ATUAL_OFFSET_MAXIMO;

  return (
    <div className="container py-2">
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
            <div>
              <span className="text-muted small d-block">
                <i className="bi bi-credit-card me-1"></i>
                {offset === 0 ? "Próximo vencimento" : "Fatura"} · {cartao.name}
              </span>
              <h5 className="mb-0 d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                  aria-label="Fatura anterior"
                  disabled={!podeVoltar || isFetching}
                  onClick={() => setOffset((o) => Math.max(-FATURA_ATUAL_OFFSET_MAXIMO, o - 1))}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>

                {formatarMesAno(fatura.reference_month)}{" "}
                <span className={`badge ${STATUS_BADGE[fatura.status]}`}>
                  {STATUS_LABEL[fatura.status]}
                </span>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                  aria-label="Próxima fatura"
                  disabled={!podeAvancar || isFetching}
                  onClick={() => setOffset((o) => Math.min(FATURA_ATUAL_OFFSET_MAXIMO, o + 1))}
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </h5>
            </div>

            {fatura.pendente > 0 && fatura.id !== null ? (
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => setFaturaParaPagar({ ...fatura, id: fatura.id as number })}
              >
                Pagar fatura
              </button>
            ) : fatura.total > 0 ? (
              <span className="text-success small">
                <i className="bi bi-check-circle me-1"></i>
                Paga
              </span>
            ) : (
              <span className="text-muted small">Nenhuma despesa lançada ainda</span>
            )}
          </div>

          <div className="row g-3">
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">Total</small>
              <span className="fw-semibold">{convertNumberToCurrencyMask(fatura.total)}</span>
            </div>
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">Pago</small>
              <span className="fw-semibold">{convertNumberToCurrencyMask(fatura.pago)}</span>
            </div>
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">Pendente</small>
              <span className="fw-semibold">{convertNumberToCurrencyMask(fatura.pendente)}</span>
            </div>
            <div className="col-6 col-md-3">
              <small className="text-muted d-block">Vencimento</small>
              <span className="fw-semibold">{formatarDataBr(fatura.due_date)}</span>
            </div>
          </div>

          <Link to="/cartoes" className="small d-inline-block mt-3">
            Ver detalhes no cartão
          </Link>
        </div>
      </div>

      {faturaParaPagar && (
        <PagarFaturaModal
          fatura={faturaParaPagar}
          contaNome={cartao.conta_nome}
          onClose={() => setFaturaParaPagar(null)}
        />
      )}
    </div>
  );
}
