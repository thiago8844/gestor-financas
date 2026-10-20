import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILA_PADRAO, useToastStore, type ToastCloseReason } from "./toast";

const store = () => useToastStore.getState();
const ids = (status?: string) => store().toasts.filter((t) => !status || t.status === status).map((t) => t.id);
const titulos = (status: string) => store().toasts.filter((t) => t.status === status).map((t) => t.title);

beforeEach(() => {
  store().clear();
  useToastStore.setState({ maxVisible: 3 });
});

describe("fila FIFO", () => {
  it("mostra até 3 e enfileira o resto, na ordem de criação", () => {
    ["a", "b", "c", "d", "e"].forEach((t) => store().show({ kind: "info", title: t }));

    expect(titulos("visible")).toEqual(["a", "b", "c"]);
    expect(titulos("queued")).toEqual(["d", "e"]);
  });

  it("libera vaga só quando a saída termina e promove o mais antigo da fila", () => {
    const [a] = ["a", "b", "c", "d", "e"].map((t) => store().show({ kind: "info", title: t })!);

    store().dismiss(a);
    expect(titulos("leaving")).toEqual(["a"]);
    expect(titulos("queued")).toEqual(["d", "e"]); // ainda animando: vaga não liberou

    store().finalizeRemoval(a);
    expect(titulos("visible")).toEqual(["b", "c", "d"]);
    expect(titulos("queued")).toEqual(["e"]);
  });

  it("respeita maxVisible menor (mobile / pouca altura)", () => {
    store().setMaxVisible(2);
    ["a", "b", "c"].forEach((t) => store().show({ kind: "info", title: t }));
    expect(titulos("visible")).toEqual(["a", "b"]);
  });

  it("persistentes não são removidos para liberar vaga", () => {
    ["e1", "e2", "e3"].forEach((t) => store().show({ kind: "error", title: t }));
    store().show({ kind: "success", title: "ok" });

    expect(titulos("visible")).toEqual(["e1", "e2", "e3"]);
    expect(titulos("queued")).toEqual(["ok"]);
  });

  it("fila cheia descarta o automático mais antigo da fila; só persistentes na fila descarta o novo", () => {
    ["x1", "x2", "x3"].forEach((t) => store().show({ kind: "error", title: t })); // ocupam as vagas
    for (let i = 0; i < MAX_FILA_PADRAO; i++) store().show({ kind: "info", title: `i${i}` });

    store().show({ kind: "info", title: "novo" });
    const fila = titulos("queued");
    expect(fila).toHaveLength(MAX_FILA_PADRAO);
    expect(fila).not.toContain("i0");
    expect(fila.at(-1)).toBe("novo");

    store().clear();
    ["p1", "p2", "p3"].forEach((t) => store().show({ kind: "error", title: t }));
    for (let i = 0; i < MAX_FILA_PADRAO; i++) store().show({ kind: "error", title: `q${i}` });
    expect(store().show({ kind: "info", title: "descartado" })).toBeNull();
  });
});

describe("deduplicação", () => {
  it("mesma chave não empilha: atualiza o existente", () => {
    const a = store().show({ kind: "error", title: "Sem conexão", dedupeKey: "rede" });
    const b = store().show({ kind: "error", title: "Sem conexão (de novo)", dedupeKey: "rede" });

    expect(b).toBe(a);
    expect(store().toasts).toHaveLength(1);
    expect(store().toasts[0].title).toBe("Sem conexão (de novo)");
  });

  it("repetir o mesmo toast não reinicia o prazo", () => {
    const id = store().show({ kind: "info", title: "x", dedupeKey: "k" })!;
    const epoca = store().toasts[0].timerEpoch;
    store().show({ kind: "info", title: "x", dedupeKey: "k" });

    expect(store().toasts.find((t) => t.id === id)!.timerEpoch).toBe(epoca);
  });
});

describe("atualização por ID", () => {
  it("só texto não reinicia o temporizador", () => {
    const id = store().show({ kind: "info", title: "a" })!;
    const epoca = store().toasts[0].timerEpoch;

    store().update(id, { title: "b", message: "detalhe" });

    const t = store().toasts[0];
    expect(t.title).toBe("b");
    expect(t.timerEpoch).toBe(epoca);
  });

  it("carregando -> sucesso troca o modo (persistente -> 5s auto) e recomeça o prazo", () => {
    const id = store().show({ kind: "loading", title: "Salvando transação..." })!;
    const antes = store().toasts[0];
    expect(antes.dismiss).toBe("manual");

    store().update(id, { kind: "success", title: "Transação salva" });

    const depois = store().toasts[0];
    expect(store().toasts).toHaveLength(1); // mesmo card
    expect(depois.dismiss).toBe("auto");
    expect(depois.duration).toBe(5000);
    expect(depois.timerEpoch).not.toBe(antes.timerEpoch);
  });

  it("valores undefined no patch não apagam o que já existe", () => {
    const id = store().show({ kind: "info", title: "a", message: "m" })!;
    store().update(id, { message: undefined, title: "b" });
    expect(store().toasts[0].message).toBe("m");
  });

  it("não atualiza toast que já está saindo", () => {
    const id = store().show({ kind: "info", title: "a" })!;
    store().dismiss(id);
    store().update(id, { title: "b" });
    expect(store().toasts[0].title).toBe("a");
  });
});

describe("padrões por tipo", () => {
  it.each([
    ["success", "auto", 5000],
    ["info", "auto", 5000],
    ["neutral", "auto", 5000],
    ["warning", "auto", 8000],
    ["error", "manual", 0],
    ["loading", "manual", 0],
  ] as const)("%s -> %s %ims", (kind, dismiss, duration) => {
    store().show({ kind, title: "t" });
    expect(store().toasts[0]).toMatchObject({ dismiss, duration });
  });

  it("aviso pode ser persistente quando exige ação", () => {
    store().show({ kind: "warning", title: "t", dismiss: "manual" });
    expect(store().toasts[0].dismiss).toBe("manual");
  });
});

describe("fechamento", () => {
  it("informa o motivo ao callback, uma única vez", () => {
    const motivos: ToastCloseReason[] = [];
    const id = store().show({ kind: "info", title: "a", onClose: (r) => motivos.push(r) })!;

    store().dismiss(id, "timeout");
    store().dismiss(id, "manual"); // já saindo: ignorado

    expect(motivos).toEqual(["timeout"]);
  });

  it("fechar toast da fila remove na hora", () => {
    ["a", "b", "c"].forEach((t) => store().show({ kind: "info", title: t }));
    const d = store().show({ kind: "info", title: "d" })!;
    store().dismiss(d);
    expect(ids()).not.toContain(d);
  });

  it("dismissAll preserva persistentes, a menos que peçam includePersistent", () => {
    store().show({ kind: "info", title: "temp" });
    store().show({ kind: "error", title: "erro" });

    store().dismissAll();
    expect(store().toasts.filter((t) => t.status === "leaving").map((t) => t.title)).toEqual(["temp"]);

    store().dismissAll({ includePersistent: true });
    expect(store().toasts.every((t) => t.status === "leaving")).toBe(true);
  });

  it("clear descarta tudo (fila inclusive) sem chamar callbacks", () => {
    const onClose = vi.fn();
    ["a", "b", "c", "d"].forEach((t) => store().show({ kind: "info", title: t, onClose }));
    store().clear();

    expect(store().toasts).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("API antiga pushToast", () => {
  it("mapeia severidades e mantém fechamento automático", () => {
    store().pushToast({ title: "t", message: "m", severity: "danger" });
    expect(store().toasts[0]).toMatchObject({ kind: "error", dismiss: "auto", duration: 8000 });

    store().pushToast({ title: "t", message: "m", severity: "success", delay: 3500 });
    expect(store().toasts[1]).toMatchObject({ kind: "success", duration: 3500 });
  });
});
