import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const DespesaCartaoFormSchema = z.object({
  card_id: z.coerce.number({ message: "Cartão é obrigatório" }).min(1, "Cartão é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((val) => (convertCurrencyMaskToNumber(val) ?? 0) > 0, "Valor deve ser maior que zero")
    .transform((val) => convertCurrencyMaskToNumber(val) as number),
  purchase_date: z.string().min(1, "Data da compra é obrigatória"),
  installment_total: z.coerce
    .number()
    .min(1, "Deve ser pelo menos 1")
    .max(60, "Não pode ter mais que 60 parcelas")
    .default(1),
  category_id: z.string().nullable().optional(),
  category_name: z.string().optional(),
  budget_id: z.string().nullable().optional(),
  modo_centavos: z.enum(["ultima", "primeira", "espalhar"]).optional(),
  // Valores exatos de cada parcela (já editados pelo usuário). A soma precisa fechar com o total.
  parcelas: z.array(z.object({ amount: z.number().min(0.01, "Cada parcela deve ter pelo menos R$ 0,01") })).optional(),
});

export type DespesaCartaoForm = z.infer<typeof DespesaCartaoFormSchema>;
