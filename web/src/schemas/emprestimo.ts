import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

const MODALIDADES = ["JUROS_PERIODICOS", "PRICE", "SAC", "PAGAMENTO_UNICO", "LIVRE"] as const;

const parseDecimal = (texto?: string) => {
  if (!texto || texto.trim() === "") return undefined;
  const n = Number(texto.trim().replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

const parcelaLivre = z.object({
  due_date: z.string(),
  principal_amount: z.string(),
  interest_amount: z.string(),
});

export const EmprestimoFormSchema = z
  .object({
    // Passo 1 — quem e quanto
    direction: z.enum(["TOMADO", "CONCEDIDO"]),
    counterparty: z.string().trim().min(1, "Informe com quem é o empréstimo"),
    description: z.string(),
    principal: z.string(),
    contract_date: z.string().min(1, "Informe a data"),
    movimentar_conta: z.boolean(),
    account_id: z.string(),

    // Passo 2 — como funciona
    modality: z.enum(MODALIDADES),
    interest_type: z.enum(["SIMPLES", "COMPOSTO", "SEM_JUROS"]),
    rate: z.string(),
    rate_period: z.enum(["DIA", "MES", "ANO"]),

    // Passo 3 — vencimentos
    frequency: z.enum(["MENSAL", "QUINZENAL", "SEMANAL", "ANUAL"]),
    first_due_date: z.string(),
    due_day_adjustment: z.enum(["ULTIMO_DIA_MES", "PROXIMO_DIA", "ULTIMO_DIA_UTIL"]),
    installments: z.string(),
    prazo_aberto: z.boolean(),
    grace_installments: z.string(),
    custom_installments: z.array(parcelaLivre),
    notes: z.string(),
  })
  .superRefine((f, ctx) => {
    const erro = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

    const principal = convertCurrencyMaskToNumber(f.principal);
    if (!principal || principal <= 0) erro("principal", "Informe o valor emprestado");

    if (f.movimentar_conta && !f.account_id) erro("account_id", "Escolha a conta");

    if (f.interest_type !== "SEM_JUROS") {
      const taxa = parseDecimal(f.rate);
      if (taxa === undefined || taxa < 0) erro("rate", "Informe a taxa de juros");
      else if (taxa > 1000) erro("rate", "Taxa acima do permitido");
    }

    if (f.modality === "LIVRE") {
      validarParcelasLivres(f, principal, erro);
      return;
    }

    if (!f.first_due_date) erro("first_due_date", "Informe a data do primeiro vencimento");

    if (f.modality === "PAGAMENTO_UNICO") return;

    const exigeParcelas = f.modality !== "JUROS_PERIODICOS" || !f.prazo_aberto;
    const parcelas = Number(f.installments);

    if (exigeParcelas && (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 600)) {
      erro("installments", "Informe um número de parcelas entre 1 e 600");
    }

    const carencia = Number(f.grace_installments || 0);
    if (!Number.isInteger(carencia) || carencia < 0) erro("grace_installments", "Carência inválida");
    else if ((f.modality === "PRICE" || f.modality === "SAC") && parcelas > 0 && carencia >= parcelas) {
      erro("grace_installments", "A carência deve ser menor que o número de parcelas");
    }
  });

function validarParcelasLivres(
  f: EmprestimoFormValues,
  principal: number | undefined,
  erro: (path: string, message: string) => void,
) {
  if (f.custom_installments.length === 0) {
    erro("custom_installments", "Adicione ao menos uma parcela");
    return;
  }

  if (f.custom_installments.some((p) => !p.due_date)) {
    erro("custom_installments", "Todas as parcelas precisam de uma data");
    return;
  }

  const soma = f.custom_installments.reduce((total, p) => total + (convertCurrencyMaskToNumber(p.principal_amount) ?? 0), 0);

  if (principal && Math.abs(soma - principal) > 0.009) {
    erro("custom_installments", "A soma do principal das parcelas deve ser igual ao valor emprestado");
  }
}

export type EmprestimoFormValues = z.infer<typeof EmprestimoFormSchema>;

export const PASSOS_EMPRESTIMO = [
  { titulo: "Quem e quanto", campos: ["direction", "counterparty", "description", "principal", "contract_date", "movimentar_conta", "account_id"] },
  { titulo: "Como funciona", campos: ["modality", "interest_type", "rate", "rate_period"] },
  { titulo: "Vencimentos", campos: ["frequency", "first_due_date", "due_day_adjustment", "installments", "prazo_aberto", "grace_installments", "custom_installments", "notes"] },
] as const;

/** Erros (campo -> mensagem) que pertencem ao passo informado (0, 1 ou 2). */
export function validarPasso(valores: EmprestimoFormValues, passo: number): Record<string, string> {
  const resultado = EmprestimoFormSchema.safeParse(valores);
  if (resultado.success) return {};

  const campos: readonly string[] = PASSOS_EMPRESTIMO[passo].campos;
  const erros: Record<string, string> = {};

  for (const issue of resultado.error.issues) {
    const campo = String(issue.path[0]);
    if (campos.includes(campo) && !erros[campo]) erros[campo] = issue.message;
  }

  return erros;
}

export const valoresIniciaisEmprestimo = (hoje: string): EmprestimoFormValues => ({
  direction: "CONCEDIDO",
  counterparty: "",
  description: "",
  principal: "",
  contract_date: hoje,
  movimentar_conta: false,
  account_id: "",
  modality: "JUROS_PERIODICOS",
  interest_type: "SIMPLES",
  rate: "",
  rate_period: "MES",
  frequency: "MENSAL",
  first_due_date: "",
  due_day_adjustment: "ULTIMO_DIA_MES",
  installments: "",
  prazo_aberto: false,
  grace_installments: "0",
  custom_installments: [],
  notes: "",
});
