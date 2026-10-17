import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { pagarFatura } from "../../../api/fatura";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask } from "../../../utils";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import InputMoeda from "../../../components/InputMoeda";
import { useToastStore } from "../../../stores/toast";
import type { FaturaPagavel } from "../../../types/fatura";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarMesAno(dataStr: string, somarMeses = 0) {
  const [ano, mes] = dataStr.split("-").map(Number);
  const data = new Date(ano, mes - 1 + somarMeses, 1);
  return `${MESES[data.getMonth()]}/${data.getFullYear()}`;
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
  const [valorPago, setValorPago] = useState(convertNumberToCurrencyMask(Math.max(fatura.pendente, 0)));
  const [erro, setErro] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { invalidateContas } = useCacheUtils();
  const pushToast = useToastStore((s) => s.pushToast);

  const pendente = fatura.pendente;
  const valor = convertCurrencyMaskToNumber(valorPago) ?? 0;
  const parcial = pendente > 0 && valor < pendente - 0.004;
  const restante = Math.round((pendente - valor) * 100) / 100;
  const maiorQuePendente = valor > pendente + 0.004 && pendente > 0;

  const { mutate, isPending } = useMutation({
    mutationFn: () => pagarFatura(fatura.id, date, parcial ? valor : undefined),
    onSuccess: (resposta) => {
      queryClient.invalidateQueries({ queryKey: ["cartao", fatura.card_id, "faturas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-fatura-atual"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-indicadores"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacao"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-painel"] });
      invalidateContas();
      pushToast({ title: "Fatura", message: resposta.message, severity: "success" });
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
          <label className="form-label">Valor pago</label>
          {pendente > 0 ? (
            <InputMoeda value={valorPago} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValorPago(e.target.value)} />
          ) : (
            <input type="text" className="form-control" value={convertNumberToCurrencyMask(pendente)} disabled />
          )}
          <small className="text-muted">
            Pendente na fatura: R$ {convertNumberToCurrencyMask(pendente)}. Pagou menos? Informe o valor que saiu da conta.
          </small>
        </div>

        {parcial && (
          <div className="alert alert-info py-2 small">
            <i className="bi bi-arrow-return-right me-1"></i>
            Pagamento parcial: <strong>R$ {convertNumberToCurrencyMask(restante)}</strong> vão para a fatura de{" "}
            <strong>{formatarMesAno(fatura.reference_month, 1)}</strong> como "Saldo restante". A conta é debitada só de
            R$ {convertNumberToCurrencyMask(valor)}. Juros e encargos do banco você lança depois na fatura seguinte.
          </div>
        )}

        {maiorQuePendente && (
          <div className="alert alert-warning py-2 small">
            O valor é maior que o pendente. Se o banco cobrou mais, lance a diferença na fatura antes de pagar.
          </div>
        )}

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
        <Button variant="success" onClick={() => mutate()} disabled={isPending || maiorQuePendente || valor < 0}>
          {isPending ? "Pagando..." : parcial ? "Confirmar pagamento parcial" : "Confirmar pagamento"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
