import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../api/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cadastroSchema, type RegisterUserRequest } from "../schemas/auth";
import { SubmitBtn } from "../components/SubmitBtn";
import { FieldError } from "../components/FieldError";
import { defaultFormErrorHandler } from "../utils/formErrorHandlers";
import type { AxiosError } from "axios";
import { FormGroup } from "../components/FormGroup";
import "../styles/auth.scss";

export function Cadastro() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterUserRequest>({
    resolver: zodResolver(cadastroSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: registerUser,
    onSuccess: () => navigate("/login"),
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/images/logo.svg" alt="Logo" className="auth-logo" />
        <h2 className="auth-title">Criar conta</h2>
        <p className="auth-subtitle">Comece a controlar suas finanças hoje</p>

        {errors.root && (
          <div className="alert alert-danger py-2 small">
            {errors.root.message}
          </div>
        )}

        <form onSubmit={handleSubmit((data) => mutate(data))}>
          <FormGroup label="Nome" id="name">
            <input
              {...register("name")}
              type="text"
              className={`form-control ${errors.name ? "is-invalid" : ""}`}
              id="name"
              placeholder="Seu nome completo"
              autoComplete="name"
            />
            <FieldError>{errors.name?.message}</FieldError>
          </FormGroup>

          <FormGroup label="Email" id="email">
            <input
              {...register("email")}
              type="email"
              className={`form-control ${errors.email ? "is-invalid" : ""}`}
              id="email"
              placeholder="seu@email.com"
              autoComplete="email"
            />
            <FieldError>{errors.email?.message}</FieldError>
          </FormGroup>

          <FormGroup label="Senha" id="password">
            <input
              {...register("password")}
              type="password"
              className={`form-control ${errors.password ? "is-invalid" : ""}`}
              id="password"
              placeholder="Crie uma senha"
              autoComplete="new-password"
            />
            <FieldError>{errors.password?.message}</FieldError>
          </FormGroup>

          <FormGroup label="Confirmar senha" id="password_confirmation">
            <input
              {...register("password_confirmation")}
              type="password"
              className={`form-control ${
                errors.password_confirmation ? "is-invalid" : ""
              }`}
              id="password_confirmation"
              placeholder="Repita a senha"
              autoComplete="new-password"
            />
            <FieldError>{errors.password_confirmation?.message}</FieldError>
          </FormGroup>

          <SubmitBtn loading={isPending}>Cadastrar</SubmitBtn>
        </form>

        <p className="auth-footer">
          Já possui conta? <Link to="/login">Faça login</Link>
        </p>
      </div>
    </div>
  );
}
