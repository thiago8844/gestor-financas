import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ajustarFechamentoFatura } from "../../../api/fatura";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import { toast } from "../../../utils/toast";
import type { FaturaPagavel } from "../../../types/fatura";
import { formatarDataBr, formatarMesAno } from "./faturaUtils";

type Props = {
  fatura: FaturaPagavel;
  onClose: () => void;
};

/**
 * Para bancos cujo fechamento muda todo mês: informa o fechamento real e as despesas são realocadas
 * entre esta fatura e a seguinte (que passa a abrir no dia depois). O backend valida o limite de
 * 3 dias por fatura e devolve a faixa permitida na mensagem de erro.
 */
export function AjustarFechamentoModal({ fatura, onClose }: Props) {
  const [data, setData] = useState(fatura.closing_date);
  const [erro, setErro] = useState<string | null>(null);
  const { invalidateFaturas } = useCacheUtils();

  const { mutate, isPending } = useMutation({
    mutationFn: (novaData?: string) => ajustarFechamentoFatura(fatura.id, novaData),
    onSuccess: (resposta) => {
      invalidateFaturas();
      toast.success(resposta.message);
      onClose();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      setErro(error.response?.data?.message || "Erro ao ajustar o fechamento.");
    },
  });

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Ajustar fechamento — {formatarMesAno(fatura.reference_month)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && <div className="alert alert-danger">{erro}</div>}

        <p className="small text-muted">
          Fechamento atual: <strong>{formatarDataBr(fatura.closing_date)}</strong>
          {fatura.closing_manual && " (ajustado à mão)"}. As despesas entre o fechamento antigo e o novo mudam de fatura; a
          fatura seguinte passa a abrir no dia depois do novo fechamento, mas não some: precisa ficar com pelo menos 3 dias.
        </p>

        <label htmlFor="novo_fechamento" className="form-label">
          Novo fechamento
        </label>
        <input
          type="date"
          id="novo_fechamento"
          className="form-control"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </Modal.Body>
      <Modal.Footer>
        {fatura.closing_manual && (
          <Button variant="outline-secondary" className="me-auto" onClick={() => mutate(undefined)} disabled={isPending}>
            Voltar à regra do cartão
          </Button>
        )}
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => mutate(data)} disabled={isPending || !data || data === fatura.closing_date}>
          {isPending ? "Ajustando..." : "Ajustar fechamento"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
