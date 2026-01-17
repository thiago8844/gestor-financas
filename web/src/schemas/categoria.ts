import { z } from "zod";

export const CategoriaFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
});

export type CategoriaForm = z.infer<typeof CategoriaFormSchema>;
