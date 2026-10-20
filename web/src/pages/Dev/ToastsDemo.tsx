import { useState } from "react";
import PageLayout from "../../layouts/PageLayout";
import { Alerta } from "../../components/Alerta";
import { toast } from "../../utils/toast";
import type { ToastKind } from "../../stores/toast";

const TIPOS: { kind: ToastKind; titulo: string; mensagem?: string }[] = [
  { kind: "success", titulo: "Transação registrada", mensagem: "Despesa de R$ 85,90 adicionada com sucesso." },
  { kind: "error", titulo: "Não foi possível salvar", mensagem: "Ocorreu um erro ao registrar a transação." },
  { kind: "warning", titulo: "Fatura próxima do vencimento", mensagem: "Confira os compromissos previstos." },
  { kind: "info", titulo: "Período alterado", mensagem: "Exibindo movimentações do período selecionado." },
  { kind: "neutral", titulo: "Filtro aplicado." },
  { kind: "loading", titulo: "Gerando relatório..." },
];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Página de teste manual dos toasts e alertas. Só existe em desenvolvimento (/dev/toasts). */
export function ToastsDemo() {
  const [duracao, setDuracao] = useState(5000);
  const [alertaVisivel, setAlertaVisivel] = useState(true);
  const [tentativas, setTentativas] = useState(0);

  const longa = Array.from({ length: 12 }, (_, i) => `Linha ${i + 1} de uma mensagem excepcionalmente longa.`).join("\n");

  return (
    <PageLayout title="Demonstração: toasts e alertas" backTo="/">
      <div className="container-fluid d-flex flex-column gap-4">
        <section>
          <h5>Tipos (padrões de cada um)</h5>
          <div className="d-flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button
                key={t.kind}
                className="btn btn-outline-secondary"
                onClick={() => toast[t.kind](t.titulo, { message: t.mensagem })}
              >
                {t.kind}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h5>Fechamento</h5>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <label className="d-flex align-items-center gap-2">
              Duração (ms)
              <input
                type="number"
                className="form-control form-control-sm"
                style={{ width: 110 }}
                value={duracao}
                onChange={(e) => setDuracao(Number(e.target.value) || 1000)}
              />
            </label>
            <button className="btn btn-outline-primary" onClick={() => toast.info("Automático", { duration: duracao, message: "Passe o mouse ou foque para pausar. Troque de aba: o tempo pausa." })}>
              Automático com duração
            </button>
            <button className="btn btn-outline-primary" onClick={() => toast.success("Persistente", { dismiss: "manual", message: "Só fecha no X." })}>
              Persistente
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => toast.warning("Persistente com redução visual", { dismiss: "manual", fadeWhenIdle: true, message: "Fica discreto após 5s sem interação (em telas com mouse)." })}
            >
              Persistente que "descansa"
            </button>
          </div>
        </section>

        <section>
          <h5>Pilha, fila e deduplicação</h5>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-outline-secondary" onClick={() => Array.from({ length: 6 }, (_, i) => toast.info(`Toast ${i + 1}`, { message: "Só 3 aparecem; os outros esperam na fila." }))}>
              Disparar 6 (fila)
            </button>
            <button className="btn btn-outline-secondary" onClick={() => toast.error("Sem conexão com o servidor", { dedupeKey: "rede", message: "Repetir este botão não empilha." })}>
              Deduplicado
            </button>
            <button className="btn btn-outline-secondary" onClick={() => toast.neutral("Mensagem longa", { message: longa, dismiss: "manual" })}>
              Mensagem longa
            </button>
            <button className="btn btn-outline-danger" onClick={() => toast.dismissAll()}>
              Fechar temporários
            </button>
            <button className="btn btn-outline-danger" onClick={() => toast.dismissAll({ includePersistent: true })}>
              Fechar todos
            </button>
          </div>
        </section>

        <section>
          <h5>Operações assíncronas (um único card)</h5>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-outline-success" onClick={() => toast.promise(esperar(2000), { loading: "Salvando transação...", success: { title: "Transação salva", message: "Confirmada pelo servidor (simulação)." } })}>
              Carregando → sucesso
            </button>
            <button className="btn btn-outline-danger" onClick={() => toast.promise(esperar(1500).then(() => Promise.reject({ isAxiosError: true, response: { data: { message: "Saldo insuficiente (simulação)." } } })), { loading: "Salvando transação...", success: "ok" }).catch(() => {})}>
              Carregando → erro
            </button>
            <button className="btn btn-outline-warning" onClick={() => toast.promise(esperar(1500).then(() => Promise.reject({ isAxiosError: true, code: "ECONNABORTED" })), { loading: "Salvando transação...", success: "ok" }).catch(() => {})}>
              Carregando → resultado desconhecido (timeout)
            </button>
          </div>
        </section>

        <section>
          <h5>Ações</h5>
          <div className="d-flex flex-wrap gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={() =>
                toast.error("Erro ao carregar relatório", {
                  message: "Tente novamente.",
                  action: {
                    label: "Tentar novamente",
                    onClick: async () => {
                      await esperar(1200);
                      setTentativas((n) => n + 1);
                    },
                  },
                })
              }
            >
              Ação assíncrona ({tentativas})
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => toast.success("Fatura marcada como paga", { action: { label: "Ver fatura", to: "/cartoes", closeOnClick: true } })}
            >
              Ação que navega e fecha
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => toast.warning("Falha na ação", { dismiss: "manual", action: { label: "Executar (vai falhar)", onClick: () => Promise.reject(new Error("x")) } })}
            >
              Ação que falha
            </button>
          </div>
        </section>

        <section className="d-flex flex-column gap-2">
          <h5>Alertas inline</h5>
          <Alerta
            tipo="error"
            titulo="Falha ao carregar transações"
            descricao="Não foi possível buscar os dados agora."
            acao={{ rotulo: "Tentar novamente", onClick: () => toast.neutral("Tentando novamente...") }}
          />
          <Alerta tipo="warning" titulo="Alterações não salvas" orientacoes={["Salve antes de sair da página.", "Descartar apaga as edições."]} />
          {alertaVisivel && (
            <Alerta tipo="info" titulo="Fatura fechada" descricao="Novas compras vão para a próxima fatura." onFechar={() => setAlertaVisivel(false)} />
          )}
          <Alerta tipo="success" titulo="Conta sincronizada" />
          <Alerta tipo="loading" titulo="Carregando relatório..." />
        </section>
      </div>
    </PageLayout>
  );
}
