import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const DespesaFormSchema = z
  .object({
    description: z.string().min(1, "Descrição é obrigatória"),
    account_id: z.string().min(1, "Conta é obrigatória"),
    amount: z
      .string('É preciso definir um valor pra despesa')
      .min(1, "Valor é obrigatório")
      .refine((val) => {
        // ✅ VALIDA A STRING ANTES DE TRANSFORMAR
        const numericValue = convertCurrencyMaskToNumber(val) ?? 0;
        return numericValue > 0;
      }, "Valor deve ser maior que zero")
      .transform((val) => convertCurrencyMaskToNumber(val)),
    date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    category_id: z.string().nullable().optional(),
    category_name: z.string().optional(),
    type: z.string().default("EXPENSE"),
    status: z.enum(["PAID", "PENDING"]).default("PENDING"),
    budget_id: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // Se PAGO, data_transacao é obrigatório
      if (data.status === "PAID") {
        return !!data.date;
      }
      return true;
    },
    {
      message: "Data da transação é obrigatória quando está pago",
      path: ["date"],
    }
  )
  .refine(
    (data) => {
      // Se NÃO PAGO, data_vencimento é obrigatório
      if (data.status === "PENDING") {
        return !!data.due_date;
      }
      return true;
    },
    {
      message: "Data de vencimento é obrigatória quando não está pago",
      path: ["due_date"],
    }
  );

export type DespesaForm = z.infer<typeof DespesaFormSchema>;
