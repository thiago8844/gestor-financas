import { z } from "zod";

export const RegraOfxSchema = z
  .object({
    descricao_contains: z.string().min(1, "Informe o texto que a descrição do OFX deve conter"),
    tipo: z.enum(["INCOME", "EXPENSE"]).optional(),
    descricao: z.string().optional(),
    category_id: z.coerce.number().optional(),
    budget_id: z.coerce.number().optional(),
    aplicar_ao_lote: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (!data.descricao && !data.category_id && !data.budget_id) {
      ctx.addIssue({
        code: "custom",
        path: ["descricao"],
        message: "Defina ao menos uma ação: descrição, categoria ou orçamento",
      });
    }
  });

export type RegraOfxForm = z.infer<typeof RegraOfxSchema>;

export const ItemOfxEditSchema = z.object({
  descricao: z.string().optional(),
  account_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  budget_id: z.coerce.number().optional(),
});

export type ItemOfxEditForm = z.infer<typeof ItemOfxEditSchema>;
