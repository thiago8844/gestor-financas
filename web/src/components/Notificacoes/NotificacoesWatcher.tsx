import { useEffect, useRef } from "react";
import { useNotificacoes } from "../../hooks/useNotificacoes";
import { useToastStore } from "../../stores/toast";
import { useNotificacaoDigestStore } from "../../stores/notificacaoDigest";
import type { Notificacao } from "../../types/notificacao";

const LIMIAR_DIGEST = 5;

const TITULOS_DIGEST: Record<string, string> = {
  fatura_vencida: "Faturas vencidas",
};

/**
 * Componente invisível: fica de olho nas notificações não lidas e decide, quando
 * aparecem novas, se mostra um toast por notificação ou (5+ novas do mesmo tipo
 * numa mesma checagem) um único modal-resumo. Deve ser montado uma única vez.
 */
export function NotificacoesWatcher() {
  const { notificacoes } = useNotificacoes();
  const pushToast = useToastStore((state) => state.pushToast);
  const abrirDigest = useNotificacaoDigestStore((state) => state.abrir);
  const idsConhecidosRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    const idsConhecidos = idsConhecidosRef.current;

    if (idsConhecidos === null) {
      idsConhecidosRef.current = new Set(notificacoes.map((notificacao) => notificacao.id));
      return;
    }

    const novas = notificacoes.filter((notificacao) => !idsConhecidos.has(notificacao.id));
    idsConhecidosRef.current = new Set(notificacoes.map((notificacao) => notificacao.id));

    if (novas.length === 0) {
      return;
    }

    const porTipo = new Map<string, Notificacao[]>();
    novas.forEach((notificacao) => {
      const grupo = porTipo.get(notificacao.type) ?? [];
      grupo.push(notificacao);
      porTipo.set(notificacao.type, grupo);
    });

    porTipo.forEach((grupo, tipo) => {
      if (grupo.length >= LIMIAR_DIGEST) {
        abrirDigest(TITULOS_DIGEST[tipo] ?? grupo[0].title, grupo);
      } else {
        grupo.forEach((notificacao) => {
          pushToast({
            title: notificacao.title,
            message: notificacao.message,
            severity: notificacao.severity,
          });
        });
      }
    });
  }, [notificacoes, pushToast, abrirDigest]);

  return null;
}
