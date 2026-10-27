import { useState } from "react";
import { Modal } from "react-bootstrap";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import {
  atualizarEmprestimo,
  cancelarEmprestimo,
  deletarEmprestimo,
  encerrarEmprestimo,
  getEmprestimo,
  getHistoricoEmprestimo,
  registrarNaoPaga,
  reverterParcela,
} from "../../api/emprestimos";
import { getContas } from "../../api/conta";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { useInvalidarEmprestimos } from "../../hooks/useInvalidarEmprestimos";
import { mensagemErroApi } from "../../utils";
import { formatarDataBr, formatarMoeda, hojeISO, resumoContrato, rotuloDirecao, rotuloModalidade } from "../../utils/emprestimo";
import { toast } from "../../utils/toast";
import { BaixaParcelaModal } from "./components/BaixaParcelaModal";
import { ParcelasLista } from "./components/ParcelasLista";
import { SituacaoBadge } from "./components/SituacaoBadge";
import { AjustarContrato } from "./components/AjustarContrato";
import { LancamentosEmprestimo } from "./components/LancamentosEmprestimo";
import type { Conta } from "../../types/conta";
import type { Emprestimo, ParcelaEmprestimo } from "../../types/emprestimo";

type Aba = "parcelas" | "lancamentos" | "ajustar" | "historico" | "ajustes";
type FiltroParcelas = "ABERTAS" | "PAGAS" | "TODAS";

export function DetalheEmprestimo() {
  const { id } = useParams();
  const emprestimoId = Number(id);
  const navigate = useNavigate();
  const invalidar = useInvalidarEmprestimos();
  const { openModal } = useConfirmModalStore();

  const [aba, setAba] = useState<Aba>("parcelas");
  const [filtro, setFiltro] = useState<FiltroParcelas>("ABERTAS");
  const [baixando, setBaixando] = useState<ParcelaEmprestimo | null>(null);
  const [naoPaga, setNaoPaga] = useState<ParcelaEmprestimo | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const { data: emprestimo, isLoading, isError } = useQuery({
    queryKey: ["emprestimo", emprestimoId],
    queryFn: () => getEmprestimo(emprestimoId),
    enabled: Number.isFinite(emprestimoId),
  });

  const reverter = useMutation({
    mutationFn: (parcela: ParcelaEmprestimo) => reverterParcela(emprestimoId, parcela.id),
    onSuccess: () => {
      invalidar();
      toast.success("Pagamento desfeito", { message: "O lançamento foi removido da conta." });
    },
    onError: (e) => toast.error("Não foi possível desfazer", { message: mensagemErroApi(e, "Tente novamente.") }),
  });

  const excluir = useMutation({
    mutationFn: () => deletarEmprestimo(emprestimoId),
    onSuccess: () => {
      invalidar();
      toast.success("Empréstimo excluído");
      navigate("/emprestimos");
    },
    onError: (e) => toast.error("Erro ao excluir", { message: mensagemErroApi(e, "Tente novamente.") }),
  });

  if (isError) {
    return (
      <PageLayout title="Empréstimo" backTo="/emprestimos">
        <div className="alert alert-danger">Não foi possível carregar este empréstimo.</div>
      </PageLayout>
    );
  }

  if (isLoading || !emprestimo) return <PageLayout title="Empréstimo" backTo="/emprestimos" loading>{null}</PageLayout>;

  const tomado = emprestimo.direction === "TOMADO";
  const todas = emprestimo.parcelas ?? [];
  const parcelas = todas.filter((p) =>
    filtro === "TODAS" ? true : filtro === "PAGAS" ? p.status === "PAGA" : p.status === "PREVISTA" || p.status === "PARCIAL",
  );
  const proxima = emprestimo.next_installment;

  const pedirReversao = (parcela: ParcelaEmprestimo) =>
    openModal({
      title: "Desfazer pagamento",
      message: `Isso remove da conta ${parcela.paid_amount > 0 ? formatarMoeda(parcela.paid_amount) : "o lançamento"} lançados na parcela ${parcela.number} e volta a parcela para "Prevista". Deseja continuar?`,
      callback: () => reverter.mutate(parcela),
    });

  const pedirExclusao = () =>
    openModal({
      title: "Excluir empréstimo",
      message: "O empréstimo, todas as parcelas e todos os lançamentos gerados por ele (pagamentos e valor emprestado) serão removidos. Essa ação não pode ser desfeita.",
      callback: () => excluir.mutate(),
    });

  return (
    <PageLayout backTo="/emprestimos">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <span className={`badge text-bg-${tomado ? "danger" : "success"} me-2`}>{rotuloDirecao(emprestimo.direction)}</span>
          {emprestimo.status !== "ATIVO" && (
            <span className="badge text-bg-secondary">{emprestimo.status === "QUITADO" ? "Quitado" : "Cancelado"}</span>
          )}
          <h2 className="mt-2 mb-1">{emprestimo.counterparty}</h2>
          <p className="text-muted mb-0">
            {resumoContrato(emprestimo)} · {rotuloModalidade(emprestimo.modality)}
          </p>
          {emprestimo.description && <p className="text-muted mb-0">{emprestimo.description}</p>}
        </div>
      </div>

      {emprestimo.status === "CANCELADO" && (
        <div className="alert alert-secondary">
          <i className="bi bi-slash-circle me-2"></i>
          Este empréstimo foi cancelado. As parcelas em aberto não serão cobradas; o histórico e os lançamentos já feitos continuam disponíveis.
        </div>
      )}

      <div className="row g-3 mb-4">
        {[
          { titulo: tomado ? "Falta pagar" : "Falta receber", valor: formatarMoeda(emprestimo.principal_balance), detalhe: "valor emprestado em aberto" },
          { titulo: tomado ? "Já pago" : "Já recebido", valor: formatarMoeda(emprestimo.paid_total), detalhe: `${emprestimo.installments_paid ?? 0} ${emprestimo.open_term ? "parcelas" : `de ${emprestimo.installments_total ?? 0} parcelas`}` },
          { titulo: "Juros previstos", valor: formatarMoeda(emprestimo.interest_total), detalhe: emprestimo.open_term ? "nas parcelas geradas até agora" : "no contrato todo" },
          { titulo: "Ainda a vencer", valor: formatarMoeda(emprestimo.remaining_total), detalhe: "principal e juros restantes" },
        ].map((c) => (
          <div key={c.titulo} className="col-6 col-lg-3">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body">
                <small className="text-muted d-block">{c.titulo}</small>
                <span className="fs-5 fw-semibold d-block">{c.valor}</span>
                <small className="text-muted">{c.detalhe}</small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {emprestimo.status === "ATIVO" && proxima && (
        <div className={`card shadow-sm mb-4 border-2 ${proxima.overdue ? "border-danger" : "border-primary"}`}>
          <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <small className="text-muted d-block">Próxima parcela</small>
              <span className="fs-5 fw-semibold me-2">
                Parcela {proxima.number} · {formatarMoeda(proxima.remaining_amount)}
              </span>
              <SituacaoBadge parcela={proxima} direcao={emprestimo.direction} />
              <small className="text-muted d-block">Vence em {formatarDataBr(proxima.due_date)}</small>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-success" onClick={() => setBaixando(proxima)}>
                <i className="bi bi-check2-circle me-2"></i>
                {tomado ? "Marcar como paga" : "Marcar como recebida"}
              </button>
              {proxima.overdue && (
                <button type="button" className="btn btn-outline-secondary" onClick={() => setNaoPaga(proxima)}>
                  <i className="bi bi-x-circle me-2"></i>
                  Não foi {tomado ? "paga" : "paga pelo devedor"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ul className="nav nav-tabs mb-3" role="tablist">
        {([
          ["parcelas", "Parcelas"],
          ["lancamentos", "Lançamentos"],
          ["ajustar", "Amortizar / Aumentar"],
          ["historico", "Histórico"],
          ["ajustes", "Ajustes"],
        ] as [Aba, string][]).map(([chave, label]) => (
          <li key={chave} className="nav-item" role="presentation">
            <button type="button" role="tab" aria-selected={aba === chave} className={`nav-link ${aba === chave ? "active" : ""}`} onClick={() => setAba(chave)}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      {aba === "parcelas" && (
        <>
          <div className="btn-group btn-group-sm mb-3" role="group" aria-label="Filtrar parcelas">
            {([
              ["ABERTAS", "Em aberto"],
              ["PAGAS", tomado ? "Pagas" : "Recebidas"],
              ["TODAS", "Todas"],
            ] as [FiltroParcelas, string][]).map(([chave, label]) => (
              <button key={chave} type="button" aria-pressed={filtro === chave} className={`btn ${filtro === chave ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFiltro(chave)}>
                {label}
              </button>
            ))}
          </div>

          {parcelas.length === 0 ? (
            <p className="text-muted">Nenhuma parcela neste filtro.</p>
          ) : (
            <ParcelasLista emprestimo={emprestimo} parcelas={parcelas} onBaixar={setBaixando} onReverter={pedirReversao} onNaoPaga={setNaoPaga} />
          )}
        </>
      )}

      {aba === "lancamentos" && <LancamentosEmprestimo emprestimoId={emprestimoId} />}

      {aba === "ajustar" && <AjustarContrato emprestimo={emprestimo} onConcluido={() => setAba("parcelas")} />}

      {aba === "historico" && <Historico emprestimoId={emprestimoId} />}

      {aba === "ajustes" && <Ajustes emprestimo={emprestimo} onExcluir={pedirExclusao} onCancelar={() => setCancelando(true)} />}

      <BaixaParcelaModal emprestimo={baixando ? emprestimo : null} parcela={baixando} onClose={() => setBaixando(null)} />
      <NaoPagaModal emprestimoId={emprestimoId} parcela={naoPaga} onClose={() => setNaoPaga(null)} />
      <CancelarModal emprestimoId={emprestimoId} aberto={cancelando} onClose={() => setCancelando(false)} />
    </PageLayout>
  );
}

function Historico({ emprestimoId }: { emprestimoId: number }) {
  const { data, isLoading } = useQuery({ queryKey: ["emprestimo", emprestimoId, "historico"], queryFn: () => getHistoricoEmprestimo(emprestimoId) });

  if (isLoading) return <p className="text-muted">Carregando...</p>;
  if (!data?.length) return <p className="text-muted">Nenhum evento registrado.</p>;

  return (
    <ul className="list-group">
      {data.map((e) => (
        <li key={e.id} className="list-group-item d-flex justify-content-between gap-3">
          <span>{e.message}</span>
          <small className="text-muted text-nowrap">{new Date(e.created_at).toLocaleString("pt-BR")}</small>
        </li>
      ))}
    </ul>
  );
}

function Ajustes({ emprestimo, onExcluir, onCancelar }: { emprestimo: Emprestimo; onExcluir: () => void; onCancelar: () => void }) {
  const invalidar = useInvalidarEmprestimos();
  const [counterparty, setCounterparty] = useState(emprestimo.counterparty);
  const [description, setDescription] = useState(emprestimo.description ?? "");
  const [notes, setNotes] = useState(emprestimo.notes ?? "");
  const [accountId, setAccountId] = useState(emprestimo.account_id ? String(emprestimo.account_id) : "");
  const [encerramento, setEncerramento] = useState(hojeISO());

  const { data: contas } = useQuery({ queryKey: ["contas", "active"], queryFn: () => getContas({ active: true }) });

  const salvar = useMutation({
    mutationFn: () =>
      atualizarEmprestimo(emprestimo.id, {
        counterparty,
        description: description || null,
        notes: notes || null,
        account_id: accountId ? Number(accountId) : null,
      }),
    onSuccess: () => {
      invalidar();
      toast.success("Empréstimo atualizado");
    },
    onError: (e) => toast.error("Erro ao salvar", { message: mensagemErroApi(e, "Tente novamente.") }),
  });

  const encerrar = useMutation({
    mutationFn: () => encerrarEmprestimo(emprestimo.id, encerramento),
    onSuccess: () => {
      invalidar();
      toast.success("Encerramento definido", { message: `O valor emprestado volta em ${formatarDataBr(encerramento)}.` });
    },
    onError: (e) => toast.error("Não foi possível definir o encerramento", { message: mensagemErroApi(e, "Tente novamente.") }),
  });

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-7">
        <h6 className="fw-bold">Dados do empréstimo</h6>
        <p className="text-muted small">
          Valor, taxa e prazo não podem ser editados depois de criados, para não bagunçar os lançamentos. Para mudar, exclua e registre de novo.
        </p>
        <div className="mb-3">
          <label className="form-label" htmlFor="ajCounterparty">{emprestimo.direction === "TOMADO" ? "Quem emprestou" : "Quem recebeu"}</label>
          <input id="ajCounterparty" className="form-control" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="ajDescription">Descrição</label>
          <input id="ajDescription" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="ajConta">Conta padrão dos pagamentos</label>
          <select id="ajConta" className="form-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Nenhuma</option>
            {(contas?.data ?? []).map((c: Conta) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="ajNotes">Observações</label>
          <textarea id="ajNotes" rows={3} className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" disabled={!counterparty.trim() || salvar.isPending} onClick={() => salvar.mutate()}>
          {salvar.isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      <div className="col-12 col-lg-5">
        {emprestimo.open_term && emprestimo.status === "ATIVO" && (
          <div className="border rounded p-3 mb-4">
            <h6 className="fw-bold">Definir encerramento</h6>
            <p className="text-muted small">
              Este contrato não tem prazo final. Informe quando o valor emprestado será devolvido: as parcelas de juros depois dessa data são canceladas.
            </p>
            <input type="date" className="form-control mb-2" aria-label="Data de encerramento" value={encerramento} onChange={(e) => setEncerramento(e.target.value)} />
            <button type="button" className="btn btn-outline-primary" disabled={!encerramento || encerrar.isPending} onClick={() => encerrar.mutate()}>
              Definir encerramento
            </button>
          </div>
        )}

        {emprestimo.status === "ATIVO" && (
          <div className="border border-warning rounded p-3 mb-4">
            <h6 className="fw-bold">Cancelar empréstimo</h6>
            <p className="text-muted small">
              Encerra o contrato sem cobrar o que falta (perdão, desistência, acordo). As parcelas em aberto são canceladas, mas o histórico e o que já foi lançado nas contas continuam.
            </p>
            <button type="button" className="btn btn-outline-warning" onClick={onCancelar}>
              <i className="bi bi-slash-circle me-2"></i>
              Cancelar empréstimo
            </button>
          </div>
        )}

        <div className="border border-danger rounded p-3">
          <h6 className="fw-bold text-danger">Excluir empréstimo</h6>
          <p className="text-muted small">Apaga o contrato, as parcelas e também os lançamentos que ele criou nas contas, como se nunca tivesse existido. Para só encerrar, use "Cancelar".</p>
          <button type="button" className="btn btn-outline-danger" onClick={onExcluir}>
            <i className="bi bi-trash me-2"></i>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function NaoPagaModal({ emprestimoId, parcela, onClose }: { emprestimoId: number; parcela: ParcelaEmprestimo | null; onClose: () => void }) {
  const invalidar = useInvalidarEmprestimos();
  const [nota, setNota] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => registrarNaoPaga(emprestimoId, parcela!.id, nota || undefined),
    onSuccess: () => {
      invalidar();
      setNota("");
      toast.info("Ocorrência registrada", { message: "A parcela continua em aberto e atrasada até ser baixada." });
      onClose();
    },
    onError: (e) => toast.error("Erro ao registrar", { message: mensagemErroApi(e, "Tente novamente.") }),
  });

  return (
    <Modal show={!!parcela} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">Registrar que não foi paga</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Isso só guarda a ocorrência no histórico. Nenhum valor é lançado: a parcela {parcela?.number} continua em aberto e você ainda pode marcá-la como paga depois.
        </p>
        <label className="form-label" htmlFor="notaNaoPaga">Anotação <small className="text-muted">(opcional)</small></label>
        <textarea id="notaNaoPaga" rows={2} maxLength={255} className="form-control" placeholder="Ex.: pediu mais uma semana" value={nota} onChange={(e) => setNota(e.target.value)} />
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-secondary text-white" onClick={onClose} disabled={isPending}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={() => mutate()} disabled={isPending}>Registrar</button>
      </Modal.Footer>
    </Modal>
  );
}

function CancelarModal({ emprestimoId, aberto, onClose }: { emprestimoId: number; aberto: boolean; onClose: () => void }) {
  const invalidar = useInvalidarEmprestimos();
  const [motivo, setMotivo] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => cancelarEmprestimo(emprestimoId, motivo.trim() || undefined),
    onSuccess: () => {
      invalidar();
      setMotivo("");
      toast.success("Empréstimo cancelado", { message: "As parcelas em aberto não serão mais cobradas." });
      onClose();
    },
    onError: (e) => toast.error("Não foi possível cancelar", { message: mensagemErroApi(e, "Tente novamente.") }),
  });

  return (
    <Modal show={aberto} onHide={isPending ? undefined : onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">Cancelar empréstimo</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          As parcelas em aberto serão canceladas e o empréstimo deixa de aparecer nos vencimentos e avisos. Os lançamentos já feitos nas contas e o histórico são mantidos. Não dá para desfazer.
        </p>
        <label className="form-label" htmlFor="motivoCancelamento">Motivo <small className="text-muted">(opcional)</small></label>
        <input id="motivoCancelamento" maxLength={200} className="form-control" placeholder="Ex.: perdoei o restante" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-secondary text-white" onClick={onClose} disabled={isPending}>Voltar</button>
        <button type="button" className="btn btn-warning" onClick={() => mutate()} disabled={isPending}>
          {isPending ? "Cancelando..." : "Cancelar empréstimo"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
