import { z } from "zod";
import { convertCurrencyMaskToNumber } from "../utils";

export const OrcamentoPeriodoSchema = z
  .object({
    start_date: z.string().min(1, "Data de início é obrigatória"),
    end_date: z.string().min(1, "Data final é obrigatória"),
  })
  .refine((periodo) => new Date(periodo.end_date) >= new Date(periodo.start_date), {
    message: "A data final não pode ser antes da data de início",
    path: ["end_date"],
  });

export const OrcamentoFormSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().optional(),
    type: z.enum(["ONE_TIME", "RECURRING"]),

    amount_limit: z
      .string()
      .optional()
      .transform((val) => convertCurrencyMaskToNumber(val)),
    alert_percentage: z.coerce.number().int().min(1).max(100).optional(),
    ignore_pending_installments: z.boolean().default(false),
    active: z.boolean().default(true),

    frequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).optional(),
    interval: z.coerce.number().int().min(1, "O intervalo deve ser maior que zero").default(1),
    start_date: z.string().optional(),

    periodos: z.array(OrcamentoPeriodoSchema).optional(),

    limite_aplicar_a_partir: z.enum(["atual", "proximo"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "RECURRING") {
      if (!data.frequency) {
        ctx.addIssue({ code: "custom", path: ["frequency"], message: "Selecione a frequência" });
      }

      if (!data.start_date) {
        ctx.addIssue({ code: "custom", path: ["start_date"], message: "Informe a data de início" });
      }
    }

    if (data.type === "ONE_TIME" && (!data.periodos || data.periodos.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["periodos"],
        message: "Informe pelo menos um intervalo de datas",
      });
    }

    if (data.alert_percentage && !data.amount_limit) {
      ctx.addIssue({
        code: "custom",
        path: ["alert_percentage"],
        message: "Defina um limite antes de configurar o alerta",
      });
    }
  });

export type OrcamentoForm = z.infer<typeof OrcamentoFormSchema>;
