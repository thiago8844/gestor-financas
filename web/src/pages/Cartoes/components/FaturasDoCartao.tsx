import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFaturasDoCartao, reverterPagamentoFatura } from "../../../api/fatura";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { Fatura, FaturaPagavel } from "../../../types/fatura";
import type { Cartao } from "../../../types/cartao";
import { PagarFaturaModal } from "./PagarFaturaModal";
import { FaturaModal } from "./FaturaModal";
import { useConfirmModalStore } from "../../../stores/confirmModal";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import {
  MESES_A_FRENTE,
  STATUS_BADGE,
  STATUS_COR,
  STATUS_LABEL,
  agruparFaturas,
  chaveMes,
  chaveMesAtual,
  formatarDataBr,
  formatarMesAno,
} from "./faturaUtils";

const moeda = (v: number) => `R$ ${convertNumberToCurrencyMask(v)}`;

type CardProps = {
  fatura: Fatura;
  atual: boolean;
  onAbrir: () => void;
  onPagar: () => void;
};

function FaturaCard({ fatura, atual, onAbrir, onPagar }: CardProps) {
  const percentual = fatura.total > 0 ? Math.round((fatura.pago / fatura.total) * 100) : 0;
  const pagavel = fatura.id !== null && fatura.pendente > 0;

  return (
    <div className="col-12 col-md-6 col-xl-4">
      <div
        className={`card h-100 shadow-sm ${atual ? "border-primary" : ""}`}
        style={{ borderLeft: `5px solid ${STATUS_COR[fatura.status]}` }}
      >
        <div className="card-body d-flex flex-column gap-2">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div className="fw-bold">{formatarMesAno(fatura.reference_month)}</div>
              {atual && <span className="badge text-bg-primary">Fatura atual</span>}
            </div>
            <span className={`badge ${STATUS_BADGE[fatura.status]}`}>{STATUS_LABEL[fatura.status]}</span>
          </div>

          <div className="fs-4 fw-bold lh-1">{moeda(fatura.total)}</div>

          <div className="progress" style={{ height: "6px" }} title={`${percentual}% pago`}>
            <div className="progress-bar bg-success" style={{ width: `${percentual}%` }}></div>
          </div>

          <div className="small text-muted d-flex justify-content-between">
            <span>
              <i className="bi bi-calendar-x me-1"></i>Fecha {formatarDataBr(fatura.closing_date)}
            </span>
            <span>
              <i className="bi bi-calendar-check me-1"></i>Vence {formatarDataBr(fatura.due_date)}
            </span>
          </div>

          <div className="d-flex gap-2 mt-auto pt-1">
            <button type="button" className="btn btn-sm btn-outline-primary flex-grow-1" onClick={onAbrir}>
              <i className="bi bi-arrows-fullscreen me-1"></i>
              Ver fatura
            </button>
            {pagavel && (
              <button type="button" className="btn btn-sm btn-success" onClick={onPagar}>
                Pagar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  cartao: Cartao;
};

export function FaturasDoCartao({ cartao }: Props) {
  const cartaoId = cartao.id;
  const { data, isPending, isError } = useQuery({
    queryKey: ["cartao", cartaoId, "faturas"],
    queryFn: () => getFaturasDoCartao(cartaoId),
  });

  const [mostrarAnteriores, setMostrarAnteriores] = useState(false);
  const [mostrarPosteriores, setMostrarPosteriores] = useState(false);
  const [faturaAbertaMes, setFaturaAbertaMes] = useState<string | null>(null);
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

  const { anteriores, principais, posteriores } = agruparFaturas(faturas);
  const mesAtual = chaveMesAtual();
  const faturaAberta = faturas.find((f) => f.reference_month === faturaAbertaMes) ?? null;

  const pedirPagamento = (f: Fatura) => setFaturaParaPagar({ ...f, id: f.id as number });
  const pedirReversao = (f: Fatura) =>
    openModal({
      callback: () => reverter(f.id as number),
      title: "Reverter pagamento da fatura",
      message: `Tem certeza que deseja reverter todos os pagamentos da fatura de ${formatarMesAno(f.reference_month)}? Todas as despesas dela voltarão a ficar pendentes.`,
      autoClose: true,
    });

  const renderCards = (lista: Fatura[]) => (
    <div className="row g-3">
      {lista.map((f) => (
        <FaturaCard
          key={f.reference_month}
          fatura={f}
          atual={chaveMes(f.reference_month) === mesAtual}
          onAbrir={() => setFaturaAbertaMes(f.reference_month)}
          onPagar={() => pedirPagamento(f)}
        />
      ))}
    </div>
  );

  const BotaoMostrar = ({
    aberto,
    onClick,
    rotulo,
    icone,
  }: {
    aberto: boolean;
    onClick: () => void;
    rotulo: string;
    icone: string;
  }) => (
    <button type="button" className="btn btn-sm btn-light border w-100 my-3" onClick={onClick}>
      <i className={`bi ${icone} me-2`}></i>
      {aberto ? "Ocultar" : "Mostrar"} {rotulo}
    </button>
  );

  return (
    <div className="mt-3">
      {anteriores.length > 0 && (
        <>
          <BotaoMostrar
            aberto={mostrarAnteriores}
            onClick={() => setMostrarAnteriores((v) => !v)}
            rotulo={`${anteriores.length} ${anteriores.length === 1 ? "fatura anterior" : "faturas anteriores"}`}
            icone={mostrarAnteriores ? "bi-chevron-up" : "bi-clock-history"}
          />
          {mostrarAnteriores && <div className="mb-3">{renderCards(anteriores)}</div>}
        </>
      )}

      {principais.length > 0 ? (
        renderCards(principais)
      ) : (
        <div className="text-muted small py-2">Nenhuma fatura a partir do mês atual.</div>
      )}

      {posteriores.length > 0 && (
        <>
          <BotaoMostrar
            aberto={mostrarPosteriores}
            onClick={() => setMostrarPosteriores((v) => !v)}
            rotulo={`${posteriores.length} ${posteriores.length === 1 ? "fatura" : "faturas"} após ${MESES_A_FRENTE} meses`}
            icone={mostrarPosteriores ? "bi-chevron-up" : "bi-calendar-plus"}
          />
          {mostrarPosteriores && renderCards(posteriores)}
        </>
      )}

      {faturaAberta && (
        <FaturaModal
          fatura={faturaAberta}
          cartao={cartao}
          onClose={() => setFaturaAbertaMes(null)}
          onPagar={pedirPagamento}
          onReverter={pedirReversao}
        />
      )}

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
