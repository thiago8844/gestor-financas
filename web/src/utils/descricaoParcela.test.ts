import { describe, expect, it } from "vitest";
import { rotuloParcela, textoComParcela } from "./descricaoParcela";

describe("rotuloParcela", () => {
  it("mostra x/y em compra parcelada", () => {
    expect(rotuloParcela({ installment_number: 2, installment_total: 7 })).toBe("2/7");
  });

  it("não mostra nada em compra à vista ou com uma parcela só", () => {
    expect(rotuloParcela({ installment_number: null, installment_total: null })).toBeNull();
    expect(rotuloParcela({ installment_number: 1, installment_total: 1 })).toBeNull();
  });
});

describe("textoComParcela", () => {
  it("junta a descrição com o rótulo da parcela", () => {
    expect(textoComParcela("Notebook", "1/7")).toBe("Notebook 1/7");
  });

  it("devolve só a descrição quando não há parcela", () => {
    expect(textoComParcela("Mercado", null)).toBe("Mercado");
  });
});
