import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import { useMutation, useQuery } from "@tanstack/react-query";
import InputMoeda from "../../../components/InputMoeda";
import { baixarParcela } from "../../../api/emprestimos";
import { getContas } from "../../../api/conta";
import { useInvalidarEmprestimos } from "../../../hooks/useInvalidarEmprestimos";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask, mensagemErroApi } from "../../../utils";
import { formatarDataBr, formatarMoeda, hojeISO } from "../../../utils/emprestimo";
import { toast } from "../../../utils/toast";
import type { Conta } from "../../../types/conta";
import type { Emprestimo, ParcelaEmprestimo } from "../../../types/emprestimo";

type Props = {
  emprestimo: Emprestimo | null;
  parcela: ParcelaEmprestimo | null;
  onClose: () => void;
};

/**
 * Registra o pagamento (eu devo) ou o recebimento (me devem) de uma parcela. Vem tudo
 * preenchido: na maioria dos casos basta confirmar.
 */
export function BaixaParcelaModal({ emprestimo, parcela, onClose }: Props) {
  const invalidar = useInvalidarEmprestimos();
  const aberto = !!emprestimo && !!parcela;
  const recebe = emprestimo?.direction === "CONCEDIDO";

  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [contaId, setContaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data: contas } = useQuery({
    queryKey: ["contas", "active"],
    queryFn: () => getContas({ active: true }),
    enabled: aberto,
  });

  // Reinicia o formulário toda vez que o modal abre para outra parcela.
  useEffect(() => {
    if (!emprestimo || !parcela) return;
    setValor(convertNumberToCurrencyMask(parcela.remaining_amount));
    setData(hojeISO());
    setContaId(emprestimo.account_id ? String(emprestimo.account_id) : "");
    setErro(null);
  }, [emprestimo, parcela]);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      baixarParcela(emprestimo!.id, parcela!.id, {
        amount: convertCurrencyMaskToNumber(valor),
        paid_at: data,
        account_id: contaId ? Number(contaId) : null,
      }),
    onSuccess: (resultado) => {
      invalidar();
      toast.success(recebe ? "Recebimento registrado" : "Pagamento registrado", {
        message: resultado.status === "PAGA" ? `Parcela ${parcela!.number} quitada.` : "Pagamento parcial lançado.",
      });
      onClose();
    },
    onError: (e) => setErro(mensagemErroApi(e, "Não foi possível registrar o pagamento.")),
  });

  const valorNumerico = convertCurrencyMaskToNumber(valor) ?? 0;
  const parcial = !!parcela && valorNumerico > 0 && valorNumerico < parcela.remaining_amount;
  const podeSalvar = valorNumerico > 0 && !!data && !!contaId && !isPending;

  return (
    <Modal show={aberto} onHide={isPending ? undefined : onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">
          {recebe ? "Marcar como recebida" : "Marcar como paga"}
        </Modal.Title>
      </Modal.Header>

      {emprestimo && parcela && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (podeSalvar) mutate();
          }}
        >
          <Modal.Body>
            <p className="text-muted small mb-3">
              Parcela {parcela.number} · {emprestimo.counterparty} · vence em {formatarDataBr(parcela.due_date)} ·{" "}
              <strong>{formatarMoeda(parcela.remaining_amount)}</strong>
            </p>

            {erro && <div className="alert alert-danger py-2">{erro}</div>}

            <div className="mb-3">
              <label className="form-label" htmlFor="baixaValor">{recebe ? "Valor recebido" : "Valor pago"}</label>
              <InputMoeda id="baixaValor" value={valor} onChange={(e) => setValor(e.target.value)} />
              {parcial && (
                <small className="text-warning-emphasis">
                  Pagamento parcial: ainda ficarão {formatarMoeda(parcela.remaining_amount - valorNumerico)} em aberto.
                </small>
              )}
            </div>

            <div className="row g-3">
              <div className="col-6">
                <label className="form-label" htmlFor="baixaData">Data</label>
                <input id="baixaData" type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="baixaConta">{recebe ? "Entrou na conta" : "Saiu da conta"}</label>
                <select id="baixaConta" className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
                  <option value="">Selecione</option>
                  {(contas?.data ?? []).map((c: Conta) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <small className="text-muted d-block mt-3">
              Isso cria {recebe ? "uma receita" : "uma despesa"} já {recebe ? "recebida" : "paga"} nessa conta.
            </small>
          </Modal.Body>

          <Modal.Footer>
            <button type="button" className="btn btn-secondary text-white" onClick={onClose} disabled={isPending}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-success" disabled={!podeSalvar}>
              {isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Confirmar
                </>
              )}
            </button>
          </Modal.Footer>
        </form>
      )}
    </Modal>
  );
}
