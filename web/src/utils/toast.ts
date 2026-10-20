import { useToastStore, type ToastOptions } from "../stores/toast";
import { mensagemErroApi } from "./index";

/**
 * API pública dos toasts. Uso em qualquer módulo:
 *
 *   toast.success("Conta atualizada", { message: "As alterações foram salvas." });
 *   const id = toast.loading("Salvando transação...");
 *   toast.update(id, { kind: "success", title: "Transação salva" });
 *
 * Nunca afirme sucesso de operação financeira antes da confirmação real do servidor.
 */

type Extras = Omit<ToastOptions, "kind" | "title">;
type Texto = { title: string; message?: string };

const mostrar = (kind: ToastOptions["kind"]) => (title: string, extras: Extras = {}) =>
  useToastStore.getState().show({ ...extras, kind, title });

/** Erro sem resposta do servidor (rede/timeout): não dá para afirmar que a operação falhou. */
function resultadoDesconhecido(erro: unknown): boolean {
  const e = erro as { response?: unknown; code?: string } | null;
  return !!e && typeof e === "object" && "isAxiosError" in e && e.response === undefined;
}

export const toast = {
  success: mostrar("success"),
  error: mostrar("error"),
  warning: mostrar("warning"),
  info: mostrar("info"),
  neutral: mostrar("neutral"),
  loading: mostrar("loading"),

  update: (id: string, patch: Partial<Omit<ToastOptions, "id" | "dedupeKey">>) =>
    useToastStore.getState().update(id, patch),

  dismiss: (id: string) => useToastStore.getState().dismiss(id, "programmatic"),

  /** Fecha os temporários. Persistentes (erros, carregando) só saem com includePersistent. */
  dismissAll: (options?: { includePersistent?: boolean }) => useToastStore.getState().dismissAll(options),

  /**
   * Liga um toast ao ciclo de uma Promise: carregando -> sucesso | erro. Reaproveita o mesmo card.
   * Falha sem resposta do servidor (timeout/rede) vira "resultado não confirmado", não "erro".
   * Devolve a própria Promise para o chamador continuar tratando.
   */
  promise<T>(
    promessa: Promise<T>,
    textos: {
      loading: string | Texto;
      success: string | Texto | ((valor: T) => string | Texto);
      error?: string | Texto | ((erro: unknown) => string | Texto);
    },
    extras: Extras = {}
  ): Promise<T> {
    const normaliza = (t: string | Texto): Texto => (typeof t === "string" ? { title: t } : t);
    const carregando = normaliza(textos.loading);
    const id = useToastStore.getState().show({ ...extras, kind: "loading", ...carregando });

    promessa.then(
      (valor) => {
        if (id === null) return;
        const t = normaliza(typeof textos.success === "function" ? textos.success(valor) : textos.success);
        useToastStore.getState().update(id, { kind: "success", message: "", ...t });
      },
      (erro) => {
        if (id === null) return;
        if (resultadoDesconhecido(erro)) {
          useToastStore.getState().update(id, {
            kind: "warning",
            title: "Resultado não confirmado",
            message: "Não foi possível confirmar se a operação foi concluída. Confira antes de tentar novamente.",
          });
          return;
        }
        const t = textos.error
          ? normaliza(typeof textos.error === "function" ? textos.error(erro) : textos.error)
          : { title: "Não foi possível concluir", message: mensagemErroApi(erro, "Tente novamente.") };
        useToastStore.getState().update(id, { kind: "error", ...t });
      }
    );

    return promessa;
  },
};

/** Mensagem de erro da API, só texto (nunca HTML), para usar em toast.error. */
export { mensagemErroApi };
