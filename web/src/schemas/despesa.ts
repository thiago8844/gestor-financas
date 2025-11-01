import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const DespesaFormSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  account_id: z.string().min(1, "Conta é obrigatória"),
  amount: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((val) => {
      // ✅ VALIDA A STRING ANTES DE TRANSFORMAR
      const numericValue = convertCurrencyMaskToNumber(val) ?? 0;
      return numericValue > 0;
    }, "Valor deve ser maior que zero")
    .transform((val) => convertCurrencyMaskToNumber(val)),
  date: z.string().min(1, "Data é obrigatória"),
  category_id: z.string().nullable().optional(),
  category_name: z.string().optional(),
  type: z.string().default("EXPENSE"),
  paid: z.boolean().default(true),
  budget_id: z.string().nullable().optional(),
});

export type DespesaForm = z.infer<typeof DespesaFormSchema>;
