import type { NaturezaGasto, SituacaoGasto } from "../../../types/relatorio";

export const NATUREZAS: NaturezaGasto[] = ["FIXA", "FIXA_VARIAVEL", "VARIAVEL", "PARCELADA"];

export const NATUREZA = {
  FIXA: {
    rotulo: "Fixas",
    singular: "Fixa",
    icone: "bi-pin-angle",
    cor: "#0d6efd",
    descricao: "Recorrências com valor fixo: aluguel, assinaturas, mensalidades. Todo mês o mesmo valor.",
  },
  FIXA_VARIAVEL: {
    rotulo: "Fixas variáveis",
    singular: "Fixa variável",
    icone: "bi-activity",
    cor: "#fd7e14",
    descricao: "Recorrências que vêm todo mês, mas com valor diferente: luz, água, internet por consumo.",
  },
  VARIAVEL: {
    rotulo: "Variáveis (não fixas)",
    singular: "Variável",
    icone: "bi-shuffle",
    cor: "#6f42c1",
    descricao: "Gastos avulsos, sem recorrência: mercado, lazer, restaurantes, compras do dia a dia.",
  },
  PARCELADA: {
    rotulo: "Parceladas",
    singular: "Parcelada",
    icone: "bi-layers",
    cor: "#20c997",
    descricao: "Parcelas de compras já feitas: uma dívida assumida, não um hábito mensal.",
  },
} as const satisfies Record<NaturezaGasto, { rotulo: string; singular: string; icone: string; cor: string; descricao: string }>;

export const SITUACAO = {
  PAGO: { rotulo: "Pago", classe: "text-bg-success" },
  PENDENTE: { rotulo: "A pagar", classe: "text-bg-warning" },
  PREVISTO: { rotulo: "Previsto", classe: "text-bg-info" },
} as const satisfies Record<SituacaoGasto, { rotulo: string; classe: string }>;

export const COR_PAGO = "#198754";
export const COR_PENDENTE = "#ffc107";
export const COR_PREVISTO = "#0dcaf0";
