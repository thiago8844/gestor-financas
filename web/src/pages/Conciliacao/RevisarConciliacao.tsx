import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { mensagemErroApi } from "../../utils";
import { acoesConciliacao, excluirConciliacao, getConciliacao } from "../../api/conciliacao";
import { useImprimirRelatorio } from "../../hooks/useImprimirRelatorio";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { useToastStore } from "../../stores/toast";
import type { ItemConciliacao, RevisaoConciliacao, RevisaoResponse } from "../../types/conciliacao";
import { useAcaoConciliacao } from "./useAcaoConciliacao";
import { dataBr, mesAno, moeda, precisaAtencao } from "./conciliacaoUtils";
import { ItemExtratoCard } from "./components/ItemExtratoCard";
import { LancarItemModal } from "./components/LancarItemModal";
import { VincularItemModal } from "./components/VincularItemModal";
import { PagamentoFaturaModal } from "./components/PagamentoFaturaModal";
import { TransferenciaItemModal } from "./components/TransferenciaItemModal";
import { MotivoModal } from "./components/MotivoModal";
import { FinalizarConciliacaoModal } from "./components/FinalizarConciliacaoModal";
import { EnviarExtratoModal } from "./components/EnviarExtratoModal";
import { SoNoAppLista } from "./components/SoNoAppLista";
import { RelatorioConciliacao } from "./components/RelatorioConciliacao";

type Aba = "atencao" | "so_no_app" | "conferidas" | "ignoradas" | "todas";

// `sequencia`: aberto a partir do "lançar em sequência" — ao resolver, já abre a próxima linha.
type ModalAberto =
  | { tipo: "lancar"; item: ItemConciliacao }
  | { tipo: "vincular"; item: ItemConciliacao }
  | { tipo: "fatura"; item: ItemConciliacao; faturaId?: number; sequencia?: boolean }
  | { tipo: "transferencia"; item: ItemConciliacao; sequencia?: boolean }
  | { tipo: "adiar"; item: ItemConciliacao; sequencia?: boolean }
  | { tipo: "ignorar"; item: ItemConciliacao; sequencia?: boolean }
  | { tipo: "manter"; chaves: string[] }
  | { tipo: "finalizar" }
  | { tipo: "enviar" }
  | null;

const CHAVE_SEQUENCIA = "conciliacao:lancar-em-sequencia";

function lerPreferenciaSequencia() {
  try {
    return localStorage.getItem(CHAVE_SEQUENCIA) !== "0";
  } catch {
    return true;
  }
}

/** Próxima linha sem correspondência e sem sugestão (as que pedem "lançar agora"). */
function proximaParaLancar(revisao: RevisaoConciliacao, atual?: ItemConciliacao) {
  const candidatas = revisao.itens.filter(
    (i) => i.source === "EXTRATO" && i.status === "PENDENTE" && !i.sugestao && i.id !== atual?.id
  );

  if (!atual) return candidatas[0] ?? null;

  return candidatas.find((i) => i.transaction_date >= atual.transaction_date) ?? candidatas[0] ?? null;
}

export function RevisarConciliacao() {
  const { id } = useParams();
  const conciliacaoId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openModal } = useConfirmModalStore();
  const pushToast = useToastStore((s) => s.pushToast);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["conciliacao", conciliacaoId],
    queryFn: () => getConciliacao(conciliacaoId),
    enabled: !!conciliacaoId,
  });

  const revisao = data?.data;
  const { executar, executarComToast, isPending } = useAcaoConciliacao(conciliacaoId);

  const [aba, setAba] = useState<Aba | null>(null);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState<ModalAberto>(null);
  const [emSequencia, setEmSequencia] = useState(lerPreferenciaSequencia);

  const titulo = revisao ? `Conciliação ${revisao.conciliacao.conta?.name ?? ""} — ${mesAno(revisao.conciliacao.reference_month)}` : "Conciliação";
  const { contentRef, imprimir } = useImprimirRelatorio(titulo);

  const grupos = useMemo(() => {
    const itens = revisao?.itens ?? [];
    const extrato = itens.filter((i) => i.source === "EXTRATO");

    return {
      atencao: itens.filter(precisaAtencao),
      conferidas: extrato.filter((i) => i.status === "CONCILIADO" && !i.vinculo_quebrado),
      ignoradas: itens.filter((i) => i.status === "IGNORADO"),
      todas: extrato,
    };
  }, [revisao]);

  if (isError) {
    return (
      <PageLayout title="Conciliação" backTo="/conciliacao">
        <div className="alert alert-danger">{mensagemErroApi(error, "Não foi possível carregar esta conciliação.")}</div>
      </PageLayout>
    );
  }

  if (isLoading || !revisao) {
    return <PageLayout title="Conciliação" backTo="/conciliacao" loading>{null}</PageLayout>;
  }

  const { conciliacao, resumo, saldo, faturas } = revisao;
  const editavel = conciliacao.status === "ABERTA";
  const abaAtual: Aba = aba ?? (grupos.atencao.length > 0 ? "atencao" : resumo.so_no_app > 0 ? "so_no_app" : "conferidas");
  const resolvidas = resumo.conciliadas + resumo.ignoradas;
  const progresso = resumo.linhas > 0 ? Math.round((resolvidas / resumo.linhas) * 100) : 100;
  const saldoBate = saldo.diferenca !== null && Math.abs(saldo.diferenca) < 0.005;

  const termo = busca.trim().toLowerCase();
  const filtrar = (lista: ItemConciliacao[]) =>
    termo === ""
      ? lista
      : lista.filter((i) => (i.description ?? "").toLowerCase().includes(termo) || moeda(i.amount).includes(termo));

  const listaDaAba = abaAtual === "so_no_app" ? [] : filtrar(grupos[abaAtual]);

  // Fecha só se ainda for o mesmo modal: quando a ação já abriu a próxima linha da sequência,
  // o onClose que o modal chama depois de salvar não pode fechá-la.
  const fechar = (alvo: ModalAberto) => setModal((atual) => (atual === alvo ? null : atual));

  /** Executa a ação do modal e, se veio da sequência, abre a próxima linha para lançar. */
  const resolver = async (alvo: ModalAberto, fn: () => Promise<RevisaoResponse>) => {
    const resposta = await executar(fn);

    if (alvo && "sequencia" in alvo && alvo.sequencia && emSequencia) {
      const proxima = proximaParaLancar(resposta.data, alvo.item);
      setModal(proxima ? { tipo: "lancar", item: proxima } : null);
    }

    return resposta;
  };

  const mudarSequencia = (v: boolean) => {
    setEmSequencia(v);
    try {
      localStorage.setItem(CHAVE_SEQUENCIA, v ? "1" : "0");
    } catch {
      /* preferência só local */
    }
  };

  const excluir = () =>
    openModal({
      title: "Excluir conciliação",
      message:
        "A conciliação deste mês e as decisões tomadas nela serão apagadas. <strong>Os lançamentos do app não mudam</strong> (inclusive os que você lançou por aqui). Continuar?",
      autoClose: true,
      callback: async () => {
        await excluirConciliacao(conciliacaoId);
        queryClient.invalidateQueries({ queryKey: ["conciliacao-painel"] });
        queryClient.invalidateQueries({ queryKey: ["conciliacoes"] });
        pushToast({ title: "Conciliação", message: "Conciliação excluída.", severity: "success" });
        navigate(`/conciliacao?mes=${conciliacao.reference_month}`);
      },
    });

  const abas: { chave: Aba; rotulo: string; qtd: number; cor: string }[] = [
    { chave: "atencao", rotulo: "Precisa de atenção", qtd: grupos.atencao.length, cor: "warning" },
    { chave: "so_no_app", rotulo: "Só no app", qtd: resumo.so_no_app, cor: "orange" },
    { chave: "conferidas", rotulo: "Conferidas", qtd: grupos.conferidas.length, cor: "success" },
    { chave: "ignoradas", rotulo: "Ignoradas", qtd: grupos.ignoradas.length, cor: "secondary" },
    { chave: "todas", rotulo: "Todas", qtd: grupos.todas.length, cor: "secondary" },
  ];

  return (
    <PageLayout backTo={`/conciliacao?mes=${conciliacao.reference_month}`}>
      {/* Cabeçalho */}
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h2 className="mb-1">
            {conciliacao.conta?.name} · {mesAno(conciliacao.reference_month)}
            <span className={`badge fs-6 ms-2 align-middle ${editavel ? "text-bg-warning" : "text-bg-success"}`}>
              {editavel ? "Em andamento" : "Finalizada"}
            </span>
          </h2>
          <div className="text-muted small">
            <i className="bi bi-file-earmark-text me-1"></i>
            {conciliacao.original_filename ?? "Extrato"} · {dataBr(conciliacao.period_start)} a {dataBr(conciliacao.period_end)}
            {editavel ? (
              <span className="ms-2 text-success">
                <i className="bi bi-cloud-check me-1"></i>Tudo é salvo na hora — pode sair e continuar depois
              </span>
            ) : (
              conciliacao.finalized_at && (
                <span className="ms-2">
                  <i className="bi bi-lock me-1"></i>Finalizada em {new Date(conciliacao.finalized_at.replace(" ", "T")).toLocaleString("pt-BR")}
                </span>
              )
            )}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          {editavel && (
            <>
              <button type="button" className="btn btn-sm btn-outline-primary" disabled={isPending} onClick={() => executarComToast(() => acoesConciliacao.reconferir(conciliacaoId))}>
                <i className="bi bi-arrow-repeat me-1"></i>Reconferir
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModal({ tipo: "enviar" })}>
                <i className="bi bi-file-earmark-arrow-up me-1"></i>Extrato atualizado
              </button>
            </>
          )}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => imprimir()}>
            <i className="bi bi-file-earmark-pdf me-1"></i>Relatório
          </button>
          {editavel ? (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={excluir}>
              <i className="bi bi-trash"></i>
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-outline-warning" disabled={isPending} onClick={() => executarComToast(() => acoesConciliacao.reabrir(conciliacaoId))}>
              <i className="bi bi-unlock me-1"></i>Reabrir
            </button>
          )}
        </div>
      </div>

      {/* Números do mês */}
      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3">
          <div className="border rounded p-2 h-100 bg-body-tertiary">
            <div className="text-muted small">Saldo no banco {saldo.banco !== null && `(${dataBr(saldo.data)})`}</div>
            <div className="fw-bold fs-6">{saldo.banco !== null ? moeda(saldo.banco) : <span className="text-muted fw-normal small">não veio no extrato</span>}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="border rounded p-2 h-100 bg-body-tertiary">
            <div className="text-muted small">Saldo no app ({dataBr(saldo.data)})</div>
            <div className="fw-bold fs-6">{moeda(saldo.app)}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className={`border rounded p-2 h-100 ${saldo.diferenca === null ? "bg-body-tertiary" : saldoBate ? "border-success bg-success-subtle" : "border-danger bg-danger-subtle"}`}>
            <div className="text-muted small">Diferença</div>
            <div className="fw-bold fs-6">
              {saldo.diferenca === null ? "-" : saldoBate ? (
                <span className="text-success"><i className="bi bi-check-circle me-1"></i>Bate</span>
              ) : (
                <span className="text-danger">{moeda(saldo.diferenca)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="border rounded p-2 h-100 bg-body-tertiary">
            <div className="text-muted small">Linhas resolvidas</div>
            <div className="fw-bold fs-6">
              {resolvidas} / {resumo.linhas}
            </div>
            <div className="progress mt-1" style={{ height: 5 }}>
              <div className="progress-bar bg-success" style={{ width: `${progresso}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Avisos que pedem um clique */}
      {editavel && resumo.vinculos_quebrados > 0 && (
        <div className="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
          <span>
            <i className="bi bi-exclamation-octagon me-1"></i>
            {resumo.vinculos_quebrados} linha(s) conferida(s) mudaram no app depois (valor, data ou exclusão).
          </span>
          <button type="button" className="btn btn-sm btn-danger" disabled={isPending} onClick={() => executarComToast(() => acoesConciliacao.reconferir(conciliacaoId))}>
            Reconferir agora
          </button>
        </div>
      )}
      {!editavel && resumo.vinculos_quebrados > 0 && (
        <div className="alert alert-warning py-2">
          <i className="bi bi-exclamation-triangle me-1"></i>
          {resumo.vinculos_quebrados} lançamento(s) conferido(s) foram alterados depois de finalizar. Reabra para revisar.
        </div>
      )}
      {editavel && resumo.sugestoes > 0 && (
        <div className="alert alert-info d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
          <span>
            <i className="bi bi-lightbulb me-1"></i>
            <strong>{resumo.sugestoes}</strong> linha(s) têm um lançamento com o mesmo valor e data próxima no app.
          </span>
          <button type="button" className="btn btn-sm btn-primary" disabled={isPending} onClick={() => executarComToast(() => acoesConciliacao.aceitarSugestoes(conciliacaoId))}>
            <i className="bi bi-check2-all me-1"></i>Aceitar todas as sugestões
          </button>
        </div>
      )}

      {/* Abas + busca */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <ul className="nav nav-pills flex-wrap gap-1">
          {abas.map((a) => (
            <li key={a.chave} className="nav-item">
              <button type="button" className={`nav-link py-1 px-3 ${abaAtual === a.chave ? "active" : ""}`} onClick={() => setAba(a.chave)}>
                {a.rotulo}
                <span className={`badge rounded-pill ms-2 ${abaAtual === a.chave ? "text-bg-light" : a.qtd > 0 && (a.chave === "atencao" || a.chave === "so_no_app") ? "text-bg-warning" : "text-bg-secondary"}`}>
                  {a.qtd}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {abaAtual !== "so_no_app" && (
          <div className="input-group input-group-sm ms-md-auto" style={{ maxWidth: 280 }}>
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input type="search" className="form-control" placeholder="Buscar descrição ou valor" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}
        {editavel && abaAtual === "atencao" && proximaParaLancar(revisao) && (
          <button type="button" className="btn btn-sm btn-success" onClick={() => setModal({ tipo: "lancar", item: proximaParaLancar(revisao)! })}>
            <i className="bi bi-lightning-charge me-1"></i>Lançar em sequência
          </button>
        )}
      </div>

      {/* Conteúdo da aba */}
      {abaAtual === "so_no_app" ? (
        <SoNoAppLista
          entradas={revisao.so_no_app}
          editavel={editavel}
          ocupado={isPending}
          onManter={(chaves) => setModal({ tipo: "manter", chaves })}
          onPendente={(chave) => executarComToast(() => acoesConciliacao.soNoAppPendente(conciliacaoId, chave))}
        />
      ) : listaDaAba.length === 0 ? (
        <div className="text-center text-muted py-5">
          {abaAtual === "atencao" && termo === "" ? (
            <>
              <i className="bi bi-check2-circle fs-1 d-block mb-2 text-success"></i>
              Todas as linhas do extrato estão resolvidas.
              {resumo.so_no_app > 0 ? (
                <div className="mt-2">
                  Falta decidir {resumo.so_no_app} lançamento(s){" "}
                  <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => setAba("so_no_app")}>
                    só no app
                  </button>
                  .
                </div>
              ) : (
                editavel && <div className="mt-2">Pode finalizar o mês.</div>
              )}
            </>
          ) : (
            "Nada por aqui."
          )}
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {listaDaAba.map((item) => (
            <ItemExtratoCard
              key={item.id}
              item={item}
              faturas={faturas}
              editavel={editavel}
              ocupado={isPending}
              onAceitarSugestao={() => item.sugestao && executarComToast(() => acoesConciliacao.vincular(conciliacaoId, item.id, { chave: item.sugestao!.chave }))}
              onLancar={() => setModal({ tipo: "lancar", item })}
              onVincular={() => setModal({ tipo: "vincular", item })}
              onPagamentoFatura={(faturaId) => setModal({ tipo: "fatura", item, faturaId })}
              onTransferencia={() => setModal({ tipo: "transferencia", item })}
              onAdiar={() => setModal({ tipo: "adiar", item })}
              onIgnorar={() => setModal({ tipo: "ignorar", item })}
              onDesfazer={() => executarComToast(() => acoesConciliacao.desfazer(conciliacaoId, item.id))}
            />
          ))}
        </div>
      )}

      {/* Barra de fechamento */}
      <div className="card shadow-sm mt-4 position-sticky bottom-0" style={{ zIndex: 5 }}>
        <div className="card-body py-2 d-flex flex-wrap gap-2 justify-content-between align-items-center">
          {editavel ? (
            <>
              <div className="small">
                {revisao.pode_finalizar ? (
                  <span className="text-success">
                    <i className="bi bi-check-circle me-1"></i>Tudo resolvido. Finalize para registrar a auditoria do mês.
                  </span>
                ) : (
                  <span className="text-muted">
                    <i className="bi bi-hourglass-split me-1"></i>
                    Para finalizar: {revisao.motivos_bloqueio.join(" · ")}. Pode parar e voltar depois.
                  </span>
                )}
              </div>
              <button type="button" className="btn btn-success" disabled={!revisao.pode_finalizar || isPending} onClick={() => setModal({ tipo: "finalizar" })}>
                <i className="bi bi-lock me-1"></i>Finalizar mês
              </button>
            </>
          ) : (
            <div className="small text-muted d-flex flex-wrap gap-3">
              <span>
                <i className="bi bi-shield-check text-success me-1"></i>Auditoria registrada
              </span>
              {conciliacao.summary && (
                <>
                  <span>{conciliacao.summary.conciliadas_automaticamente + conciliacao.summary.conciliadas_manualmente} conferidas</span>
                  <span>{conciliacao.summary.ignoradas} ignoradas</span>
                  {conciliacao.summary.faturas.length > 0 && (
                    <span>
                      Faturas: {conciliacao.summary.faturas.map((f) => `${f.cartao} ${f.referencia} (${f.auditoria === "CONFERE" ? "auditada" : f.auditoria === "DIVERGENTE" ? "com diferença" : "não auditada"})`).join(", ")}
                    </span>
                  )}
                </>
              )}
              {conciliacao.note && <span>Obs.: {conciliacao.note}</span>}
              <Link to={`/conciliacao?mes=${conciliacao.reference_month}`}>Voltar ao fechamento do mês</Link>
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      {modal?.tipo === "lancar" && (
        <LancarItemModal
          key={modal.item.id}
          item={modal.item}
          restantes={revisao.itens.filter((i) => i.source === "EXTRATO" && i.status === "PENDENTE" && !i.sugestao && i.id !== modal.item.id).length}
          emSequencia={emSequencia}
          podeSerFatura={faturas.length > 0 && modal.item.type === "EXPENSE"}
          onSequenciaChange={mudarSequencia}
          onTrocar={(tipo) => setModal({ tipo, item: modal.item, sequencia: true })}
          onClose={() => fechar(modal)}
          onLancar={async (dados) => {
            const resposta = await executar(() => acoesConciliacao.lancar(conciliacaoId, modal.item.id, dados));
            const proxima = emSequencia ? proximaParaLancar(resposta.data, modal.item) : null;
            setModal(proxima ? { tipo: "lancar", item: proxima } : null);
            return resposta;
          }}
        />
      )}

      {modal?.tipo === "vincular" && (
        <VincularItemModal item={modal.item} onClose={() => fechar(modal)} onVincular={(dados) => executar(() => acoesConciliacao.vincular(conciliacaoId, modal.item.id, dados))} />
      )}

      {modal?.tipo === "fatura" && (
        <PagamentoFaturaModal
          item={modal.item}
          faturas={faturas}
          faturaInicialId={modal.faturaId}
          onClose={() => fechar(modal)}
          onConfirmar={(dados) => resolver(modal, () => acoesConciliacao.pagamentoFatura(conciliacaoId, modal.item.id, dados))}
        />
      )}

      {modal?.tipo === "transferencia" && (
        <TransferenciaItemModal
          item={modal.item}
          contaAtualId={conciliacao.account_id}
          contaAtualNome={conciliacao.conta?.name}
          onClose={() => fechar(modal)}
          onConfirmar={(dados) => resolver(modal, () => acoesConciliacao.transferencia(conciliacaoId, modal.item.id, dados))}
        />
      )}

      {modal?.tipo === "adiar" && (
        <MotivoModal
          titulo="Lançar depois"
          descricao="A linha fica marcada como adiada e o mês não fecha até você resolvê-la. Você recebe um lembrete semanal. Quando lançar pelas telas normais, use Reconferir aqui que ela casa sozinha."
          rotulo="Lembrete (opcional)"
          placeholder="Ex.: esperar a nota fiscal, perguntar pra esposa..."
          confirmar="Adiar"
          variante="info"
          onClose={() => fechar(modal)}
          onConfirmar={(nota) => resolver(modal, () => acoesConciliacao.adiar(conciliacaoId, modal.item.id, nota || undefined))}
        />
      )}

      {modal?.tipo === "ignorar" && (
        <MotivoModal
          titulo="Ignorar esta linha"
          descricao="A linha não entra no app e não segura o fechamento. O motivo fica registrado na auditoria do mês."
          rotulo="Motivo"
          obrigatorio
          confirmar="Ignorar"
          variante="secondary"
          sugestoes={["Cobrança contestada no banco", "Estornado pelo banco no mesmo mês", "Já lançado em outra conta", "Movimentação entre aplicações"]}
          onClose={() => fechar(modal)}
          onConfirmar={(nota) => resolver(modal, () => acoesConciliacao.ignorar(conciliacaoId, modal.item.id, nota))}
        />
      )}

      {modal?.tipo === "manter" && (
        <MotivoModal
          titulo={modal.chaves.length > 1 ? `Confirmar ${modal.chaves.length} lançamentos` : "Confirmar lançamento"}
          descricao="Está pago no app mas não aparece no extrato deste mês. Confirme só se estiver certo — o motivo fica registrado."
          rotulo="Por que está certo?"
          obrigatorio
          confirmar="Confirmar"
          variante="success"
          sugestoes={["O banco debita no mês seguinte", "Pago em dinheiro dessa conta", "Ajuste manual de saldo"]}
          onClose={() => setModal(null)}
          onConfirmar={(nota) => executar(() => acoesConciliacao.manterSoNoApp(conciliacaoId, modal.chaves, nota))}
        />
      )}

      {modal?.tipo === "finalizar" && (
        <FinalizarConciliacaoModal revisao={revisao} onClose={() => setModal(null)} onFinalizar={(obs) => executar(() => acoesConciliacao.finalizar(conciliacaoId, obs))} />
      )}

      {modal?.tipo === "enviar" && (
        <EnviarExtratoModal contaId={conciliacao.account_id} mes={conciliacao.reference_month} travado onClose={() => setModal(null)} />
      )}

      <RelatorioConciliacao revisao={revisao} contentRef={contentRef} titulo={titulo} />
    </PageLayout>
  );
}
