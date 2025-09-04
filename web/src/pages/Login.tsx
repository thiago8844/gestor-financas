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

  //Mutation para fazer o request
  const { mutate, isPending } = useMutation({
    mutationFn: login,
    onSuccess: (data: LoginResponse) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.token); //Salvar o token no localStorage
      setToken(data.token); //Estado global
      setUser(data.user); //Estado global

      navigate("/"); //Redirecionar para a página inicial
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: LoginRequest) => {
    mutate(data);
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "400px" }}>
      <h2 className="mb-4 text-center">Login</h2>

      {errors.root && (
        <div className="alert alert-danger">{errors.root.message}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Email */}
        <FormGroup label="Email" id="email">
          <input
            {...register("email")}
            type="email"
            className={`form-control ${errors.email ? "is-invalid" : ""}`}
            id="email"
            placeholder="Digite seu email"
          />
          <FieldError>{errors.email?.message}</FieldError>
        </FormGroup>

        {/* Password */}
        <FormGroup label="Senha" id="password">
          <input
            {...register("password")}
            type="password"
            className={`form-control ${errors.password ? "is-invalid" : ""}`}
            id="password"
            placeholder="Digite sua senha"
          />
          <FieldError>{errors.password?.message}</FieldError>
        </FormGroup>

        {/* Submit */}
        <SubmitBtn loading={isPending}>Entrar</SubmitBtn>
        <small className="d-block mb-1">
          Não possui conta? <Link to="/cadastro">Cadastre-se</Link>
        </small>
        {/* <small className="d-block">
          Esqueceu a senha? <Link to="/resetar-senha">Clique aqui</Link>
        </small> */}
      </form>
    </div>
  );
}
