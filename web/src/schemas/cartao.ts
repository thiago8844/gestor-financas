import { z } from "zod";

export const CartaoFormSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    account_id: z.coerce.number({ message: "Conta é obrigatória" }).min(1, "Conta é obrigatória"),
    closing_rule: z.enum(["FIXED_DAY", "DAYS_BEFORE_DUE"]),
    closing_day: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number({ message: "Dia de fechamento é obrigatório" }).min(1, "Deve ser entre 1 e 31").max(31, "Deve ser entre 1 e 31").optional()
    ),
    closing_days_before_due: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number({ message: "Informe os dias" }).min(1, "Deve ser entre 1 e 28").max(28, "Deve ser entre 1 e 28").optional()
    ),
    due_day: z.coerce
      .number({ message: "Dia de vencimento é obrigatório" })
      .min(1, "Deve ser entre 1 e 31")
      .max(31, "Deve ser entre 1 e 31"),
    active: z.boolean().optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.closing_rule === "FIXED_DAY" && dados.closing_day === undefined) {
      ctx.addIssue({ code: "custom", path: ["closing_day"], message: "Dia de fechamento é obrigatório" });
    }

    if (dados.closing_rule === "DAYS_BEFORE_DUE" && dados.closing_days_before_due === undefined) {
      ctx.addIssue({ code: "custom", path: ["closing_days_before_due"], message: "Informe quantos dias antes do vencimento" });
    }
  });

export type CartaoForm = z.infer<typeof CartaoFormSchema>;
