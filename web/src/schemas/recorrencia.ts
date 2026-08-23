import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const RecorrenciaFormSchema = z
  .object({
    description: z.string().min(1, "Descrição é obrigatória"),
    account_id: z.string().min(1, "Conta é obrigatória"),
    category_id: z.string().nullable().optional(),
    category_name: z.string().optional(),
    type: z.enum(["EXPENSE", "INCOME"]),

    valorFixo: z.boolean(),
    amount: z
      .string()
      .optional()
      .transform((val) => convertCurrencyMaskToNumber(val)),

    default_status: z.enum(["PENDING", "PAID"]),

    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.coerce.number().int().min(1, "O intervalo deve ser maior que zero"),
    days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    day_of_month: z.coerce.number().int().min(1).max(31).optional(),
    month_of_year: z.coerce.number().int().min(1).max(12).optional(),

    start_date: z.string().min(1, "Data de início é obrigatória"),
    end_date: z.string().nullable().optional(),

    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.valorFixo && (!data.amount || data.amount <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Informe o valor fixo",
      });
    }

    if (data.default_status === "PAID" && (!data.valorFixo || !data.amount || data.amount <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["default_status"],
        message: "Para nascer paga, a recorrência precisa ter um valor fixo",
      });
    }

    if (data.frequency === "WEEKLY" && (!data.days_of_week || data.days_of_week.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["days_of_week"],
        message: "Selecione pelo menos um dia da semana",
      });
    }

    if ((data.frequency === "MONTHLY" || data.frequency === "YEARLY") && !data.day_of_month) {
      ctx.addIssue({
        code: "custom",
        path: ["day_of_month"],
        message: "Informe o dia do mês",
      });
    }

    if (data.frequency === "YEARLY" && !data.month_of_year) {
      ctx.addIssue({
        code: "custom",
        path: ["month_of_year"],
        message: "Informe o mês",
      });
    }

    if (
      data.end_date &&
      data.start_date &&
      new Date(data.end_date) < new Date(data.start_date)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "A data final não pode ser antes da data de início",
      });
    }
  });

export type RecorrenciaForm = z.infer<typeof RecorrenciaFormSchema>;
