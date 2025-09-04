import type { AxiosError } from "axios";
import type { UseFormSetError } from "react-hook-form";

// Tipagem da resposta de erro que a API retorna
export interface ApiValidationError {
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Aplica os erros de validação do servidor nos campos do formulário
 * usando a função setError do react-hook-form
 */
export const applyValidationErrors = (
  serverError: ApiValidationError,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setError: UseFormSetError<any>
): void => {
  if (serverError?.errors) {
    const validationErrors = serverError.errors;

    Object.keys(validationErrors).forEach((key) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError(key as any, { message: validationErrors[key][0] });
    });
  } else if (serverError?.message) {
    setError("root", { message: serverError.message });
  }
};

/**
 * Lida com erros de formulário, aplicando erros de validação
 * ou mensagens genéricas conforme necessário
 */
export const defaultFormErrorHandler = (
  error: AxiosError<unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setError: UseFormSetError<any>
): void => {
  const response = error.response as AxiosError<ApiValidationError>["response"];

  if (!response) {
    setError("root", { message: "Erro de conexão com o servidor." });
    return;
  }

  if (response.status === 422 && response.data) {
    applyValidationErrors(response.data, setError);
  } else {
    console.error(error);
    setError("root", {
      message:
        (response.data as ApiValidationError)?.message ||
        "Erro ao completar a operação.",
    });
  }
};
