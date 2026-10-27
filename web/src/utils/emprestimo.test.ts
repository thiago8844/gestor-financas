import { describe, expect, it } from "vitest";
import {
  aceitaAjuste,
  diaDaData,
  frasesDeJuros,
  formatarDataBr,
  hojeISO,
  jurosPrimeiroMes,
  montarPayload,
  parseDecimal,
  rotuloTaxa,
  situacaoDaParcela,
} from "./emprestimo";
import { validarPasso, valoresIniciaisEmprestimo, type EmprestimoFormValues } from "../schemas/emprestimo";

const formDeReferencia = (extra: Partial<EmprestimoFormValues> = {}): EmprestimoFormValues => ({
  ...valoresIniciaisEmprestimo("2026-10-20"),
  counterparty: "Fulano",
  principal: "5.000,00",
  rate: "2",
  first_due_date: "2026-11-26",
  installments: "12",
  ...extra,
});

describe("formatação", () => {
  it("converte data ISO sem deslocar por fuso", () => {
    expect(formatarDataBr("2026-11-26")).toBe("26/11/2026");
    expect(formatarDataBr("2026-11-26T00:00:00.000000Z")).toBe("26/11/2026");
    expect(formatarDataBr(null)).toBe("-");
  });

  it("formata hoje em ISO local", () => {
    expect(hojeISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("aceita vírgula ou ponto na taxa", () => {
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal("2.5")).toBe(2.5);
    expect(parseDecimal("")).toBeUndefined();
    expect(parseDecimal("abc")).toBeUndefined();
  });

  it("extrai o dia da data", () => {
    expect(diaDaData("2026-11-26")).toBe(26);
    expect(diaDaData("")).toBeNull();
  });

  it("descreve a taxa em português", () => {
    expect(rotuloTaxa({ rate: 2, rate_period: "MES", interest_type: "SIMPLES" })).toBe("2% a.m. · juros simples");
    expect(rotuloTaxa({ rate: 1.5, rate_period: "ANO", interest_type: "COMPOSTO" })).toBe("1,5% a.a. · juros compostos");
    expect(rotuloTaxa({ rate: 0, rate_period: "MES", interest_type: "SEM_JUROS" })).toBe("sem juros");
  });
});

describe("situacaoDaParcela", () => {
  const base = { due_date: "2026-11-26", overdue: false, days_overdue: 0 };

  it("usa o verbo certo para cada direção quando paga", () => {
    expect(situacaoDaParcela({ ...base, status: "PAGA" }, "TOMADO").texto).toBe("Paga");
    expect(situacaoDaParcela({ ...base, status: "PAGA" }, "CONCEDIDO").texto).toBe("Recebida");
  });

  it("mostra o atraso em texto", () => {
    const atrasada = { ...base, status: "PREVISTA" as const, overdue: true, days_overdue: 3 };
    expect(situacaoDaParcela(atrasada, "TOMADO")).toEqual({ texto: "Atrasada há 3 dias", variante: "danger" });
    expect(situacaoDaParcela({ ...atrasada, days_overdue: 1 }, "TOMADO").texto).toBe("Atrasada há 1 dia");
  });

  it("destaca o vencimento de hoje e o pagamento parcial", () => {
    expect(situacaoDaParcela({ ...base, status: "PREVISTA" }, "TOMADO", "2026-11-26").texto).toBe("Vence hoje");
    expect(situacaoDaParcela({ ...base, status: "PREVISTA" }, "TOMADO", "2026-11-01").texto).toBe("Prevista");
    expect(situacaoDaParcela({ ...base, status: "PARCIAL" }, "TOMADO", "2026-11-01").texto).toBe("Parcial");
  });
});

describe("validação por passo", () => {
  it("aceita o caso de referência em todos os passos", () => {
    const form = formDeReferencia();
    expect(validarPasso(form, 0)).toEqual({});
    expect(validarPasso(form, 1)).toEqual({});
    expect(validarPasso(form, 2)).toEqual({});
  });

  it("cobra só os campos do passo atual", () => {
    const vazio = valoresIniciaisEmprestimo("2026-10-20");
    expect(Object.keys(validarPasso(vazio, 0)).sort()).toEqual(["counterparty", "principal"]);
    expect(Object.keys(validarPasso(vazio, 1))).toEqual(["rate"]);
    expect(Object.keys(validarPasso(vazio, 2)).sort()).toEqual(["first_due_date", "installments"]);
  });

  it("dispensa a taxa sem juros e o número de parcelas em prazo aberto", () => {
    expect(validarPasso(formDeReferencia({ interest_type: "SEM_JUROS", rate: "" }), 1)).toEqual({});
    expect(validarPasso(formDeReferencia({ prazo_aberto: true, installments: "" }), 2)).toEqual({});
  });

  it("exige conta ao movimentar o saldo", () => {
    expect(validarPasso(formDeReferencia({ movimentar_conta: true }), 0)).toHaveProperty("account_id");
    expect(validarPasso(formDeReferencia({ movimentar_conta: true, account_id: "3" }), 0)).toEqual({});
  });

  it("a carência precisa ser menor que o número de parcelas", () => {
    const form = formDeReferencia({ modality: "SAC", installments: "4", grace_installments: "4" });
    expect(validarPasso(form, 2)).toHaveProperty("grace_installments");
  });

  it("parcelas livres precisam fechar com o valor emprestado", () => {
    const parcela = (principal: string) => ({ due_date: "2026-12-01", principal_amount: principal, interest_amount: "" });
    const errado = formDeReferencia({ modality: "LIVRE", custom_installments: [parcela("1.000,00")] });
    const certo = formDeReferencia({ modality: "LIVRE", custom_installments: [parcela("2.500,00"), parcela("2.500,00")] });

    expect(validarPasso(errado, 2)).toHaveProperty("custom_installments");
    expect(validarPasso(certo, 2)).toEqual({});
  });
});

describe("montarPayload", () => {
  it("monta o caso de referência com o dia fixo da primeira data", () => {
    expect(montarPayload(formDeReferencia())).toMatchObject({
      direction: "CONCEDIDO",
      counterparty: "Fulano",
      principal: 5000,
      rate: 2,
      interest_type: "SIMPLES",
      modality: "JUROS_PERIODICOS",
      due_day: 26,
      installments: 12,
      account_id: null,
      movimentar_conta: false,
    });
  });

  it("prazo em aberto não envia número de parcelas", () => {
    expect(montarPayload(formDeReferencia({ prazo_aberto: true })).installments).toBeNull();
  });

  it("frequência não mensal não envia dia fixo", () => {
    expect(montarPayload(formDeReferencia({ frequency: "QUINZENAL" })).due_day).toBeNull();
  });

  it("sem juros zera a taxa mesmo que o campo esteja preenchido", () => {
    expect(montarPayload(formDeReferencia({ interest_type: "SEM_JUROS", rate: "9" })).rate).toBe(0);
  });

  it("converte taxa com vírgula e parcelas livres", () => {
    const payload = montarPayload(
      formDeReferencia({
        rate: "1,5",
        modality: "LIVRE",
        custom_installments: [{ due_date: "2026-12-01", principal_amount: "5.000,00", interest_amount: "50,00" }],
      }),
    );

    expect(payload.rate).toBe(1.5);
    expect(payload.installments).toBeNull();
    expect(payload.custom_installments).toEqual([{ due_date: "2026-12-01", principal_amount: 5000, interest_amount: 50 }]);
  });

  it("envia a conta como número", () => {
    const payload = montarPayload(formDeReferencia({ account_id: "7", movimentar_conta: true }));
    expect(payload.account_id).toBe(7);
    expect(payload.movimentar_conta).toBe(true);
  });
});

describe("jurosPrimeiroMes", () => {
  it("2% ao mês sobre 5.000 rende 100", () => {
    expect(jurosPrimeiroMes(5000, 2, "MES", "SIMPLES")).toBe(100);
  });

  it("converte taxa anual e diária para o mês", () => {
    expect(jurosPrimeiroMes(10000, 24, "ANO", "SIMPLES")).toBe(200);
    expect(jurosPrimeiroMes(10000, 0.1, "DIA", "SIMPLES")).toBe(300);
    expect(jurosPrimeiroMes(10000, 12.682503, "ANO", "COMPOSTO")).toBe(100);
  });

  it("não calcula sem juros, sem taxa ou sem valor", () => {
    expect(jurosPrimeiroMes(5000, 2, "MES", "SEM_JUROS")).toBe(0);
    expect(jurosPrimeiroMes(5000, 0, "MES", "SIMPLES")).toBe(0);
    expect(jurosPrimeiroMes(0, 2, "MES", "SIMPLES")).toBe(0);
  });
});

describe("ajustes do contrato", () => {
  it("amortização só em contratos ativos de modalidades com saldo", () => {
    expect(aceitaAjuste({ modality: "PRICE", status: "ATIVO" }, "AMORTIZACAO")).toBe(true);
    expect(aceitaAjuste({ modality: "PAGAMENTO_UNICO", status: "ATIVO" }, "AMORTIZACAO")).toBe(false);
    expect(aceitaAjuste({ modality: "LIVRE", status: "ATIVO" }, "AUMENTO")).toBe(false);
    expect(aceitaAjuste({ modality: "SAC", status: "CANCELADO" }, "AUMENTO")).toBe(false);
  });

  it("quitado aceita só aumento (reabre o contrato)", () => {
    expect(aceitaAjuste({ modality: "JUROS_PERIODICOS", status: "QUITADO" }, "AUMENTO")).toBe(true);
    expect(aceitaAjuste({ modality: "JUROS_PERIODICOS", status: "QUITADO" }, "AMORTIZACAO")).toBe(false);
  });

  it("descreve economia ou aumento de juros", () => {
    expect(frasesDeJuros(480)).toContain("economiza R$ 480,00");
    expect(frasesDeJuros(-120)).toContain("aumentam R$ 120,00");
    expect(frasesDeJuros(0)).toBe("Os juros restantes não mudam.");
  });
});
