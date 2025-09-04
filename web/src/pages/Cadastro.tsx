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
    onSuccess: () => {
      //Disparar notificação de usuário cadastrado com sucesso
      navigate("/login");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: RegisterUserRequest) => {
    mutate(data);
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "400px" }}>
      <h2 className="mb-4 text-center">Cadastro</h2>

      {errors.root && (
        <div className="alert alert-danger">{errors.root.message}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormGroup label="Nome" id="name">
          <input
            {...register("name")}
            type="text"
            className={`form-control ${errors.name ? "is-invalid" : ""}`}
            id="name"
            placeholder="Digite seu nome"
          />
          <FieldError>{errors.name?.message}</FieldError>
        </FormGroup>

        <FormGroup label="Email" id="email">
          <input
            {...register("email")}
            type="text"
            className={`form-control ${errors.email ? "is-invalid" : ""}`}
            id="email"
            placeholder="Digite seu email"
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
            placeholder="Confirme sua senha"
          />
          <FieldError>{errors.password_confirmation?.message}</FieldError>
        </FormGroup>

        <SubmitBtn loading={isPending}>Cadastrar</SubmitBtn>
        <small>
          Já possui conta ? faça <Link to="/login">login</Link>
        </small>
      </form>
    </div>
  );
}
