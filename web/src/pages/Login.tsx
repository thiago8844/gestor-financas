import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import type { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginRequest } from "../schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormGroup } from "../components/FormGroup";
import { FieldError } from "../components/FieldError";
import { SubmitBtn } from "../components/SubmitBtn";
import { defaultFormErrorHandler } from "../utils/formErrorHandlers";
import type { LoginResponse } from "../types/auth";
import { useAuthStore } from "../stores/auth";
import { ACCESS_TOKEN_KEY } from "../config/config";
import "../styles/auth.scss";

export function Login() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  const { mutate, isPending } = useMutation({
    mutationFn: login,
    onSuccess: (data: LoginResponse) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      navigate("/");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/images/logo.svg" alt="Logo" className="auth-logo" />
        <h2 className="auth-title">Bem-vindo de volta</h2>
        <p className="auth-subtitle">Entre na sua conta para continuar</p>

        {errors.root && (
          <div className="alert alert-danger py-2 small">
            {errors.root.message}
          </div>
        )}

        <form onSubmit={handleSubmit((data) => mutate(data))}>
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
              placeholder="Digite sua senha"
              autoComplete="current-password"
            />
            <FieldError>{errors.password?.message}</FieldError>
          </FormGroup>

          <SubmitBtn loading={isPending}>Entrar</SubmitBtn>
        </form>

        <p className="auth-footer">
          Não possui conta? <Link to="/cadastro">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
