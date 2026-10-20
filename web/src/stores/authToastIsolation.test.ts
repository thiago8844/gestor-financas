import { beforeEach, describe, expect, it, vi } from "vitest";

// A store de auth lê localStorage e chama a API: troca por dublês para testar só o isolamento de toasts.
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
vi.mock("../api-client", () => ({ api: { post: () => Promise.resolve({}) } }));
vi.mock("../api/auth", () => ({ getUser: vi.fn() }));

const { useAuthStore } = await import("./auth");
const { useToastStore } = await import("./toast");
const { getUser } = await import("../api/auth");

beforeEach(() => {
  useToastStore.getState().clear();
  useAuthStore.setState({ user: null, token: "t", loading: false });
});

describe("isolamento de toasts entre sessões", () => {
  it("logout limpa avisos visíveis e a fila", () => {
    ["a", "b", "c", "d"].forEach((t) => useToastStore.getState().show({ kind: "error", title: t }));
    expect(useToastStore.getState().toasts).toHaveLength(4);

    useAuthStore.getState().logout();

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("troca de usuário descarta avisos do anterior", async () => {
    useAuthStore.setState({ user: { id: "1" } as never });
    useToastStore.getState().show({ kind: "info", title: "dado do usuário 1" });
    vi.mocked(getUser).mockResolvedValue({ id: "2" } as never);

    await useAuthStore.getState().fetchUser();

    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("mesmo usuário recarregado mantém os avisos", async () => {
    useAuthStore.setState({ user: { id: "1" } as never });
    useToastStore.getState().show({ kind: "info", title: "fica" });
    vi.mocked(getUser).mockResolvedValue({ id: "1" } as never);

    await useAuthStore.getState().fetchUser();

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });
});
