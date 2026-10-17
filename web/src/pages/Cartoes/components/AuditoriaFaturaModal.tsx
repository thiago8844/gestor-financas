import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { auditarFatura, getAuditoriasFatura } from "../../../api/fatura";
import InputMoeda from "../../../components/InputMoeda";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask } from "../../../utils";
import type { AuditoriaFatura, FaturaParaModal } from "../../../types/fatura";
import { formatarMesAno } from "./faturaUtils";

const moeda = (v: number) => `R$ ${convertNumberToCurrencyMask(v)}`;

type Props = {
  fatura: FaturaParaModal;
  cartaoNome: string;
  onClose: () => void;
  /** Abre o lançamento da diferença já preenchido (despesa se faltou no app, crédito se sobrou). */
  onLancarDiferenca: (tipo: "INCOME" | "EXPENSE", valor: number) => void;
};

export function BadgeAuditoria({ auditoria }: { auditoria?: AuditoriaFatura | null }) {
  if (!auditoria) {
    return (
      <span className="badge text-bg-light border text-muted" title="Fatura ainda não conferida com a do banco">
        <i className="bi bi-shield me-1"></i>Não auditada
      </span>
    );
  }

  if (auditoria.status === "CONFERE") {
    return (
      <span className="badge text-bg-success" title={auditoria.alterada_depois ? "A fatura mudou depois da auditoria, mas o total continua batendo" : undefined}>
        <i className="bi bi-shield-check me-1"></i>Auditada
      </span>
    );
  }

  return (
    <span className="badge text-bg-danger" title="O total do banco é diferente do total do app">
      <i className="bi bi-shield-exclamation me-1"></i>Diferença de {moeda(Math.abs(auditoria.diferenca_atual))}
    </span>
  );
}

/**
 * Auditoria manual da fatura: você compara a fatura do banco com a do app fora do sistema
 * (PDF/planilha) e registra aqui o total que o banco cobrou. O app só compara e sinaliza.
 */
export function AuditoriaFaturaModal({ fatura, cartaoNome, onClose, onLancarDiferenca }: Props) {
  const [totalBanco, setTotalBanco] = useState("");
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const { invalidateFaturas, queryClient } = useCacheUtils();

  const { data: historico } = useQuery({
    queryKey: ["fatura-auditorias", fatura.id],
    queryFn: () => getAuditoriasFatura(fatura.id),
  });

  const { mutate, isPending, data: resultado } = useMutation({
    mutationFn: () => auditarFatura(fatura.id, { bank_total: convertCurrencyMaskToNumber(totalBanco) ?? 0, note: nota || undefined }),
    onSuccess: () => {
      setErro(null);
      invalidateFaturas();
      queryClient.invalidateQueries({ queryKey: ["fatura-auditorias", fatura.id] });
      queryClient.invalidateQueries({ queryKey: ["conciliacao"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-painel"] });
    },
    onError: (error: AxiosError<{ message?: string }>) => setErro(error.response?.data?.message || "Erro ao registrar a auditoria."),
  });

  const auditoria = resultado?.data ?? fatura.auditoria ?? null;
  const diferenca = auditoria?.diferenca_atual ?? 0;
  const lista = historico?.data ?? [];

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          <i className="bi bi-shield-check me-2"></i>
          Auditar fatura {cartaoNome} · {formatarMesAno(fatura.reference_month)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <ol className="small text-muted ps-3">
          <li>Exporte esta fatura do app (botões PDF ou Excel na fatura) e a fatura do banco.</li>
          <li>Compare as duas do jeito que preferir (planilha, IA...).</li>
          <li>Informe abaixo o total que o banco cobrou. Se houver diferença, ajuste a fatura do app.</li>
        </ol>

        <div className="border rounded p-3 bg-body-tertiary mb-3">
          <div className="d-flex justify-content-between">
            <span className="text-muted">Total da fatura no app</span>
            <strong>{moeda(fatura.total)}</strong>
          </div>
          {(fatura.levado_para_proxima ?? 0) > 0 && (
            <div className="d-flex justify-content-between small text-muted">
              <span>Levado para a próxima (pagamento parcial)</span>
              <span>{moeda(fatura.levado_para_proxima ?? 0)}</span>
            </div>
          )}
        </div>

        {erro && <div className="alert alert-danger">{erro}</div>}

        <div className="row g-3">
          <div className="col-12 col-md-5">
            <label className="form-label">Total da fatura no banco</label>
            <InputMoeda value={totalBanco} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotalBanco(e.target.value)} autoFocus />
          </div>
          <div className="col-12 col-md-7">
            <label className="form-label">Observação (opcional)</label>
            <input
              type="text"
              className="form-control"
              value={nota}
              maxLength={2000}
              placeholder="Ex.: conferido com o PDF, IOF lançado"
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
        </div>

        {auditoria && (
          <div className={`alert mt-3 mb-0 ${auditoria.status === "CONFERE" ? "alert-success" : "alert-danger"}`}>
            {auditoria.status === "CONFERE" ? (
              <>
                <i className="bi bi-check-circle me-1"></i>
                A fatura do app confere com a do banco ({moeda(auditoria.bank_total)}).
              </>
            ) : (
              <>
                <div className="mb-2">
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  O banco cobrou {moeda(auditoria.bank_total)} e o app tem {moeda(auditoria.total_atual)}:{" "}
                  <strong>
                    {diferenca > 0 ? `faltam ${moeda(diferenca)} no app` : `sobram ${moeda(Math.abs(diferenca))} no app`}
                  </strong>
                  .
                </div>
                <Button
                  size="sm"
                  variant={diferenca > 0 ? "danger" : "success"}
                  onClick={() => onLancarDiferenca(diferenca > 0 ? "EXPENSE" : "INCOME", Math.abs(diferenca))}
                >
                  {diferenca > 0 ? `Lançar despesa de ${moeda(diferenca)}` : `Lançar crédito de ${moeda(Math.abs(diferenca))}`}
                </Button>
                <span className="small ms-2">ou corrija os lançamentos na fatura.</span>
              </>
            )}
          </div>
        )}

        {lista.length > 0 && (
          <div className="mt-4">
            <div className="small fw-semibold text-muted text-uppercase mb-2">Histórico de auditorias</div>
            <ul className="list-group list-group-flush small">
              {lista.map((a) => (
                <li key={a.id} className="list-group-item px-0 d-flex justify-content-between gap-2">
                  <span>
                    {new Date(a.created_at.replace(" ", "T")).toLocaleString("pt-BR")} · banco {moeda(a.bank_total)} · app{" "}
                    {moeda(a.app_total)}
                    {a.note && <span className="text-muted"> · {a.note}</span>}
                  </span>
                  <span className={a.difference === 0 ? "text-success" : "text-danger"}>
                    {a.difference === 0 ? "conferiu" : `dif. ${moeda(a.difference)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Fechar
        </Button>
        <Button variant="primary" onClick={() => mutate()} disabled={isPending || totalBanco.trim() === ""}>
          {isPending ? "Registrando..." : "Registrar auditoria"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
