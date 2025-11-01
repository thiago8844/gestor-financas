import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const ContaFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["EXPENSE", "INCOME"]),
  include_in_networth: z.boolean().optional(),
  currency: z.string(),
  role: z.string().optional(),
  instituicao: z.string().optional(),
  saldo_inicial: z
    .string()
    .optional()
    .transform((val) => convertCurrencyMaskToNumber(val)), // Transforma a máscara em float quando passar pro schema
  data_saldo_inicial: z.string().optional().nullable(),
});

export type ContaForm = z.infer<typeof ContaFormSchema>;
