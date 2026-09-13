import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const ParcelaSchema = z
  .object({
    number: z.number(),
    amount: z
      .string()
      .min(1, "Valor é obrigatório")
      .refine((val) => (convertCurrencyMaskToNumber(val) ?? 0) > 0, "Valor deve ser maior que zero")
      .transform((val) => convertCurrencyMaskToNumber(val) as number),
    date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    status: z.enum(["PENDING", "PAID"]),
  })
  .refine((parcela) => parcela.status !== "PAID" || !!parcela.date, {
    message: "Data da transação é obrigatória quando a parcela está paga",
    path: ["date"],
  });

export const ParcelamentoFormSchema = z
  .object({
    description: z.string().min(1, "Descrição é obrigatória"),
    account_id: z.string().min(1, "Conta é obrigatória"),
    category_id: z.string().nullable().optional(),
    category_name: z.string().optional(),
    budget_id: z.string().nullable().optional(),
    type: z.enum(["EXPENSE", "INCOME"]),
    installment_total: z
      .number()
      .min(2, "O parcelamento deve ter pelo menos 2 parcelas")
      .max(60, "O parcelamento não pode ter mais que 60 parcelas"),
    parcelas: z.array(ParcelaSchema).min(2, "Gere as parcelas antes de salvar"),
  })
  .refine((data) => data.parcelas.length === data.installment_total, {
    message: "A quantidade de parcelas geradas não bate com o número de parcelas informado",
    path: ["parcelas"],
  });

export type ParcelamentoForm = z.infer<typeof ParcelamentoFormSchema>;
