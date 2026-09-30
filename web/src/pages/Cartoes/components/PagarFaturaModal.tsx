import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { pagarFatura } from "../../../api/fatura";
import { convertNumberToCurrencyMask } from "../../../utils";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import type { FaturaPagavel } from "../../../types/fatura";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(dataStr: string) {
  const [ano, mes] = dataStr.split("-").map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  fatura: FaturaPagavel;
  contaNome?: string | null;
  onClose: () => void;
};

export function PagarFaturaModal({ fatura, contaNome, onClose }: Props) {
  const [date, setDate] = useState(hoje());
  const [erro, setErro] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { invalidateContas } = useCacheUtils();

  const { mutate, isPending } = useMutation({
    mutationFn: () => pagarFatura(fatura.id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartao", fatura.card_id, "faturas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-fatura-atual"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-indicadores"] });
      invalidateContas();
      alert("Fatura paga com sucesso!");
      onClose();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      setErro(error.response?.data?.message || "Erro ao pagar fatura.");
    },
  });

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Pagar fatura de {formatarMesAno(fatura.reference_month)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && <div className="alert alert-danger">{erro}</div>}

        <div className="mb-3">
          <label className="form-label">Conta</label>
          <input type="text" className="form-control" value={contaNome ?? ""} disabled />
        </div>

        <div className="mb-3">
          <label className="form-label">Valor a pagar</label>
          <input
            type="text"
            className="form-control"
            value={convertNumberToCurrencyMask(fatura.pendente)}
            disabled
          />
          <small className="text-muted">
            Por enquanto só é possível pagar a fatura inteira.
          </small>
        </div>

        <div className="mb-3">
          <label htmlFor="data_pagamento" className="form-label">
            Data do pagamento
          </label>
          <input
            type="date"
            id="data_pagamento"
            className="form-control"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button variant="success" onClick={() => mutate()} disabled={isPending}>
          {isPending ? "Pagando..." : "Confirmar pagamento"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
