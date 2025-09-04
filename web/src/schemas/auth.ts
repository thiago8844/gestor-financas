import { z } from "zod";

export const cadastroSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.email("Email inválido"),
    password: z.string().min(3, "A senha deve ter pelo menos 3 caracteres"),
    password_confirmation: z.string().min(1, "Confirmação obrigatória"),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "As senhas não conferem",
    path: ["password_confirmation"],
  });

export  const loginSchema = z.object({
    email: z.email("Email inválido"),
    password: z.string().min(3, "A senha deve ter pelo menos 3 caracteres"),
  });

export type RegisterUserRequest = z.infer<typeof cadastroSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;