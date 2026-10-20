import { beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "../stores/toast";
import { toast } from "./toast";

const primeiro = () => useToastStore.getState().toasts[0];
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => useToastStore.getState().clear());

describe("toast.promise", () => {
  it("reaproveita o mesmo card: carregando -> sucesso", async () => {
    let resolver!: (v: number) => void;
    const p = toast.promise(new Promise<number>((r) => (resolver = r)), {
      loading: "Salvando transação...",
      success: (v) => ({ title: "Transação salva", message: `id ${v}` }),
    });
    expect(primeiro()).toMatchObject({ kind: "loading", title: "Salvando transação..." });

    resolver(7);
    await p;
    await flush();

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(primeiro()).toMatchObject({ kind: "success", title: "Transação salva", message: "id 7", dismiss: "auto" });
  });

  it("erro com resposta do servidor vira erro persistente com a mensagem da API", async () => {
    const erro = { isAxiosError: true, response: { data: { message: "Saldo insuficiente" } } };
    await toast.promise(Promise.reject(erro), { loading: "Salvando...", success: "ok" }).catch(() => {});
    await flush();

    expect(primeiro()).toMatchObject({ kind: "error", message: "Saldo insuficiente", dismiss: "manual" });
  });

  it("falha sem resposta (timeout/rede) NÃO afirma erro: vira resultado não confirmado", async () => {
    const timeout = { isAxiosError: true, code: "ECONNABORTED" };
    await toast.promise(Promise.reject(timeout), { loading: "Salvando...", success: "ok" }).catch(() => {});
    await flush();

    expect(primeiro().kind).toBe("warning");
    expect(primeiro().title).toBe("Resultado não confirmado");
  });
});
