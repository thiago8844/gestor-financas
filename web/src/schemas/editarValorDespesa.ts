import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const EditarValorDespesaSchema = z.object({
  amount: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((val) => (convertCurrencyMaskToNumber(val) ?? 0) > 0, "Valor deve ser maior que zero")
    .transform((val) => convertCurrencyMaskToNumber(val) as number),
});

export type EditarValorDespesaForm = z.infer<typeof EditarValorDespesaSchema>;
