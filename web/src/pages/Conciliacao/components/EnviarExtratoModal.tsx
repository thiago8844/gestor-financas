import { useRef, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { enviarExtrato } from "../../../api/conciliacao";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import { useToastStore } from "../../../stores/toast";
import type { ErroConciliacao } from "../../../types/conciliacao";
import type { Conta } from "../../../types";
import { mesAno } from "../conciliacaoUtils";

type Props = {
  contaId?: number;
  mes?: string;
  /** Reenvio para uma conciliação já aberta: conta e mês ficam travados. */
  travado?: boolean;
  onClose: () => void;
};

export function EnviarExtratoModal({ contaId, mes, travado, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);
  const { contas } = useFormularioTransacao();
  const inputRef = useRef<HTMLInputElement>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conta, setConta] = useState(contaId ? String(contaId) : "");
  const [mesEscolhido, setMesEscolhido] = useState(mes ?? "");
  const [lembrar, setLembrar] = useState(true);
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<ErroConciliacao | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      enviarExtrato({
        arquivo: arquivo!,
        conta_id: conta ? Number(conta) : undefined,
        mes: mesEscolhido || undefined,
        lembrar_conta: lembrar && Boolean(conta),
      }),
    onSuccess: (resposta) => {
      queryClient.setQueryData(["conciliacao", resposta.data.conciliacao.id], { data: resposta.data });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-painel"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacoes"] });
      pushToast({ title: "Extrato recebido", message: resposta.message ?? "", severity: "success" });
      onClose();
      navigate(`/conciliacao/${resposta.data.conciliacao.id}`);
    },
    onError: (error: AxiosError<ErroConciliacao>) => {
      setErro(error.response?.data ?? { message: "Erro ao enviar o extrato. Tente novamente." });
    },
  });

  const escolher = (lista: FileList | null) => {
    const f = lista?.[0] ?? null;
    setArquivo(f);
    setErro(null);
  };

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          <i className="bi bi-file-earmark-arrow-up me-2"></i>
          {travado ? "Enviar extrato atualizado" : "Enviar extrato"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && (
          <div className={`alert ${erro.necessita_conta ? "alert-warning" : "alert-danger"} py-2`}>
            {erro.necessita_conta ? (
              <>
                <i className="bi bi-info-circle me-1"></i>
                Não reconhecemos a conta deste extrato
                {erro.banco_detectado?.acct_id && ` (banco ${erro.banco_detectado.bank_id ?? "?"}, conta ${erro.banco_detectado.acct_id})`}.
                Escolha abaixo; o app lembra para as próximas vezes.
              </>
            ) : (
              <>
                {erro.message}
                {erro.conciliacao_id && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 ms-1 align-baseline"
                    onClick={() => {
                      onClose();
                      navigate(`/conciliacao/${erro.conciliacao_id}`);
                    }}
                  >
                    Abrir conciliação
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div
          role="button"
          tabIndex={0}
          className={`border border-2 rounded-3 p-4 text-center mb-3 ${arrastando ? "border-primary bg-primary-subtle" : "bg-body-tertiary"}`}
          style={{ borderStyle: "dashed" }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            escolher(e.dataTransfer.files);
          }}
        >
          <i className={`bi ${arquivo ? "bi-file-earmark-check text-success" : "bi-cloud-arrow-up text-muted"} fs-1 d-block mb-1`}></i>
          {arquivo ? (
            <span className="fw-semibold">{arquivo.name}</span>
          ) : (
            <>
              <div className="fw-semibold">Arraste o OFX da conta aqui</div>
              <div className="small text-muted">ou clique para escolher</div>
            </>
          )}
          <input ref={inputRef} type="file" accept=".ofx,.qfx" className="d-none" onChange={(e) => escolher(e.target.files)} />
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-7">
            <label className="form-label small">Conta</label>
            <select
              className={`form-select ${erro?.necessita_conta && !conta ? "is-invalid" : ""}`}
              value={conta}
              disabled={travado}
              onChange={(e) => setConta(e.target.value)}
            >
              <option value="">Detectar pelo arquivo</option>
              {contas.map((c: Conta) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-5">
            <label className="form-label small">Mês</label>
            <input
              type="month"
              className="form-control"
              value={mesEscolhido}
              disabled={travado}
              onChange={(e) => setMesEscolhido(e.target.value)}
            />
          </div>
        </div>

        <div className="small text-muted mt-2">
          {mesEscolhido ? `Só entram as linhas de ${mesAno(mesEscolhido)}.` : "Sem mês, o app usa o mês com mais lançamentos no arquivo."}{" "}
          Enviar de novo um extrato mais completo só acrescenta as linhas novas.
        </div>

        {!travado && conta && (
          <div className="form-check form-switch mt-3">
            <input id="lembrar-conta" type="checkbox" role="switch" className="form-check-input" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
            <label htmlFor="lembrar-conta" className="form-check-label small">
              Lembrar que este extrato é desta conta
            </label>
          </div>
        )}

        <div className="small text-muted mt-3">
          <i className="bi bi-credit-card me-1"></i>
          Fatura de cartão não entra aqui: ela é conferida pelo débito do pagamento no extrato da conta, e a auditoria da
          fatura em si é feita na tela de Cartões.
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button variant="success" onClick={() => mutate()} disabled={isPending || !arquivo}>
          {isPending ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Conferindo...
            </>
          ) : (
            "Enviar e conferir"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
