import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToastStore, type ToastItem } from "../../stores/toast";
import { Countdown } from "../../utils/countdown";
import { VISUAL_POR_TIPO } from "./toastVisual";

const INATIVIDADE_MS = 5000;
const SAIDA_MS = 300;

const prefereMenosMovimento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const temHover = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover)").matches;

export function ToastCard({ toast }: { toast: ToastItem }) {
  const navigate = useNavigate();
  const dismiss = useToastStore((s) => s.dismiss);
  const finalizeRemoval = useToastStore((s) => s.finalizeRemoval);

  const visual = VISUAL_POR_TIPO[toast.kind];
  const saindo = toast.status === "leaving";
  const automatico = toast.dismiss === "auto" && toast.duration > 0;

  // Motivos de pausa ativos (hover, foco, aba oculta, ação em andamento). Qualquer um pausa o prazo.
  const pausas = useRef(new Set<string>());
  const countdown = useRef<Countdown | null>(null);
  const [pausado, setPausado] = useState(false);
  const [interagindo, setInteragindo] = useState(false);
  const [ocioso, setOcioso] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [acaoFalhou, setAcaoFalhou] = useState(false);

  const sincronizarPausa = useCallback(() => {
    const deveFicarPausado = pausas.current.size > 0;
    setPausado(deveFicarPausado);
    if (deveFicarPausado) countdown.current?.pause();
    else countdown.current?.resume();
  }, []);

  const pausar = useCallback(
    (motivo: string, ativo: boolean) => {
      if (ativo) pausas.current.add(motivo);
      else pausas.current.delete(motivo);
      sincronizarPausa();
    },
    [sincronizarPausa]
  );

  // Prazo automático: só corre enquanto o toast está visível. Recomeça apenas quando timerEpoch muda.
  useEffect(() => {
    if (toast.status !== "visible" || !automatico) return;

    const contagem = new Countdown(toast.duration, () => dismiss(toast.id, "timeout"));
    countdown.current = contagem;
    if (pausas.current.size === 0) contagem.start();

    return () => {
      contagem.dispose();
      countdown.current = null;
    };
  }, [toast.id, toast.status, toast.timerEpoch, toast.duration, automatico, dismiss]);

  // Aba oculta pausa o prazo; ao voltar, continua do tempo restante.
  useEffect(() => {
    const aoMudarVisibilidade = () => pausar("aba", document.hidden);
    aoMudarVisibilidade();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, [pausar]);

  // Persistente com redução visual: discreto após 5s sem interação (só em dispositivos com hover).
  useEffect(() => {
    if (!toast.fadeWhenIdle || automatico || !temHover()) return;
    if (interagindo || ocupado) {
      setOcioso(false);
      return;
    }
    const timer = setTimeout(() => setOcioso(true), INATIVIDADE_MS);
    return () => clearTimeout(timer);
  }, [toast.fadeWhenIdle, automatico, interagindo, ocupado]);

  // Saída: espera a animação (ou remove na hora com movimento reduzido) e libera a vaga.
  useEffect(() => {
    if (!saindo) return;
    const timer = setTimeout(() => finalizeRemoval(toast.id), prefereMenosMovimento() ? 0 : SAIDA_MS);
    return () => clearTimeout(timer);
  }, [saindo, toast.id, finalizeRemoval]);

  const executarAcao = async () => {
    const acao = toast.action;
    if (!acao || ocupado) return;

    setOcupado(true);
    setAcaoFalhou(false);
    pausar("acao", true);
    try {
      await acao.onClick?.();
      if (acao.to) navigate(acao.to);
      if (acao.closeOnClick) dismiss(toast.id, "action");
    } catch {
      setAcaoFalhou(true);
    } finally {
      setOcupado(false);
      pausar("acao", false);
    }
  };

  const classes = ["toast-slot", saindo ? "is-leaving" : ""].join(" ");
  const classesCard = ["toast-card", ocioso ? "is-idle" : ""].join(" ");

  return (
    <div className={classes}>
      <div className="toast-slot__inner">
        <div
          className={classesCard}
          style={{ ["--toast-accent" as string]: visual.cor }}
          role={toast.kind === "error" ? "alert" : "status"}
          aria-busy={toast.kind === "loading" || undefined}
          data-kind={toast.kind}
          onMouseEnter={() => {
            pausar("hover", true);
            setInteragindo(true);
          }}
          onMouseLeave={() => {
            pausar("hover", false);
            setInteragindo(false);
          }}
          onFocus={() => {
            pausar("foco", true);
            setInteragindo(true);
          }}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            pausar("foco", false);
            setInteragindo(false);
          }}
        >
          <span className="toast-card__icon" aria-hidden="true">
            {toast.kind === "loading" ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <i className={`bi ${visual.icone}`}></i>
            )}
          </span>

          <div className="toast-card__content">
            <div className="toast-card__title">{toast.title}</div>
            {toast.message && <div className="toast-card__message">{toast.message}</div>}
            {acaoFalhou && <div className="toast-card__message text-danger">Não foi possível concluir a ação.</div>}

            {toast.action && (
              <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={executarAcao} disabled={ocupado}>
                {ocupado && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}
                {toast.action.label}
              </button>
            )}
          </div>

          <button
            type="button"
            className="toast-card__close"
            aria-label="Fechar aviso"
            onClick={() => dismiss(toast.id, "manual")}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>

          {automatico && (
            <span
              key={toast.timerEpoch}
              className="toast-card__progress"
              aria-hidden="true"
              style={{ animationDuration: `${toast.duration}ms`, animationPlayState: pausado ? "paused" : "running" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
