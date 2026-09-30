import { z } from "zod";

export const CartaoFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  account_id: z.coerce.number({ message: "Conta é obrigatória" }).min(1, "Conta é obrigatória"),
  closing_day: z.coerce
    .number({ message: "Dia de fechamento é obrigatório" })
    .min(1, "Deve ser entre 1 e 31")
    .max(31, "Deve ser entre 1 e 31"),
  due_day: z.coerce
    .number({ message: "Dia de vencimento é obrigatório" })
    .min(1, "Deve ser entre 1 e 31")
    .max(31, "Deve ser entre 1 e 31"),
  active: z.boolean().optional(),
});

export type CartaoForm = z.infer<typeof CartaoFormSchema>;
