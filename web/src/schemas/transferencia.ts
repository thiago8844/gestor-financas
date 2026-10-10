import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const TransferenciaFormSchema = z
  .object({
    from_account_id: z.string().min(1, "Conta de origem é obrigatória"),
    to_account_id: z.string().min(1, "Conta de destino é obrigatória"),
    amount: z
      .string("É preciso definir um valor para a transferência")
      .min(1, "Valor é obrigatório")
      .refine((val) => {
        const numericValue = convertCurrencyMaskToNumber(val) ?? 0;
        return numericValue > 0;
      }, "Valor deve ser maior que zero")
      .transform((val) => convertCurrencyMaskToNumber(val)),
    date: z.string().min(1, "Data é obrigatória"),
    description: z.string().max(255, "Máximo de 255 caracteres").optional(),
  })
  .refine((data) => !data.from_account_id || data.from_account_id !== data.to_account_id, {
    path: ["to_account_id"],
    message: "A conta de destino deve ser diferente da conta de origem",
  });

export type TransferenciaForm = z.infer<typeof TransferenciaFormSchema>;
