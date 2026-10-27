import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import PageLayout from "../../layouts/PageLayout";
import { criarEmprestimo, previaEmprestimo } from "../../api/emprestimos";
import { getContas } from "../../api/conta";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useInvalidarEmprestimos } from "../../hooks/useInvalidarEmprestimos";
import {
  PASSOS_EMPRESTIMO,
  validarPasso,
  valoresIniciaisEmprestimo,
  type EmprestimoFormValues,
} from "../../schemas/emprestimo";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import { mensagemErroApi } from "../../utils";
import { hojeISO, montarPayload } from "../../utils/emprestimo";
import { toast } from "../../utils/toast";
import { PassoCondicoes, PassoPessoa, PassoVencimentos } from "./PassosEmprestimo";
import { PreviaCronograma } from "./components/PreviaCronograma";

export function CadastrarEmprestimo() {
  const navigate = useNavigate();
  const invalidar = useInvalidarEmprestimos();
  const [passo, setPasso] = useState(0);

  const form = useForm<EmprestimoFormValues>({ defaultValues: valoresIniciaisEmprestimo(hojeISO()) });
  const { handleSubmit, getValues, setError, clearErrors, watch } = form;

  const { data: contas, isLoading: carregandoContas } = useQuery({
    queryKey: ["contas", "active"],
    queryFn: () => getContas({ active: true }),
  });

  // A prévia só roda no último passo e com tudo válido; o debounce evita uma requisição por tecla.
  const valores = watch();
  const tudoValido = [0, 1, 2].every((p) => Object.keys(validarPasso(valores, p)).length === 0);
  const payloadPrevia = useDebouncedValue(tudoValido ? montarPayload(valores) : null);

  const previa = useQuery({
    queryKey: ["emprestimo-previa", payloadPrevia],
    queryFn: ({ signal }) => previaEmprestimo(payloadPrevia!, signal),
    enabled: passo === 2 && payloadPrevia !== null,
    placeholderData: (anterior) => anterior,
    retry: false,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (v: EmprestimoFormValues) => criarEmprestimo(montarPayload(v)),
    onSuccess: (resposta) => {
      invalidar();
      toast.success("Empréstimo registrado", { message: "O cronograma de parcelas já está disponível." });
      navigate(`/emprestimos/${resposta.data.id}`);
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  /** Aplica os erros do passo; devolve true se o passo está válido. */
  const validar = (indice: number) => {
    clearErrors();
    const erros = validarPasso(getValues(), indice);
    Object.entries(erros).forEach(([campo, message]) => setError(campo as keyof EmprestimoFormValues, { message }));
    return Object.keys(erros).length === 0;
  };

  const avancar = () => {
    if (validar(passo)) setPasso(passo + 1);
  };

  const salvar = () => {
    // Se algum passo anterior ficou inválido, volta para ele em vez de falhar no servidor.
    for (const indice of [0, 1, 2]) {
      if (!validar(indice)) {
        setPasso(indice);
        return;
      }
    }
    handleSubmit((v) => mutate(v))();
  };

  const erroPrevia = previa.isError ? mensagemErroApi(previa.error, "Não foi possível calcular o cronograma.") : null;
  const ultimo = passo === PASSOS_EMPRESTIMO.length - 1;

  return (
    <PageLayout title="Novo empréstimo" backTo="/emprestimos" loading={carregandoContas}>
      <div className="container-fluid">
        <div className="container" style={{ maxWidth: 820 }}>
          <ol className="list-unstyled d-flex gap-2 mb-4" aria-label="Etapas do cadastro">
            {PASSOS_EMPRESTIMO.map((p, i) => (
              <li key={p.titulo} className="flex-fill" aria-current={i === passo ? "step" : undefined}>
                <div className={`rounded-pill mb-1 ${i <= passo ? "bg-primary" : "bg-body-secondary"}`} style={{ height: 6 }}></div>
                <small className={i === passo ? "fw-semibold" : "text-muted"}>
                  {i + 1}. {p.titulo}
                </small>
              </li>
            ))}
          </ol>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ultimo) salvar();
              else avancar();
            }}
            noValidate
          >
            {form.formState.errors.root && <div className="alert alert-danger">{form.formState.errors.root.message}</div>}

            {passo === 0 && <PassoPessoa form={form} contas={contas?.data} />}
            {passo === 1 && <PassoCondicoes form={form} />}
            {passo === 2 && (
              <>
                <PassoVencimentos form={form} />
                {valores.modality !== "LIVRE" || tudoValido ? (
                  <section className="mt-4" aria-label="Prévia do cronograma">
                    <h6 className="fw-bold mb-3">Como vai ficar</h6>
                    <PreviaCronograma
                      previa={tudoValido ? previa.data : undefined}
                      carregando={previa.isFetching}
                      erro={erroPrevia}
                    />
                  </section>
                ) : null}
              </>
            )}

            <div className="d-flex gap-2 justify-content-between mt-4">
              <button
                type="button"
                className="btn btn-secondary text-white"
                onClick={() => (passo === 0 ? navigate("/emprestimos") : setPasso(passo - 1))}
                disabled={isPending}
              >
                <i className="bi bi-arrow-left me-2"></i>
                {passo === 0 ? "Cancelar" : "Voltar"}
              </button>

              <button type="submit" className="btn btn-success" disabled={isPending}>
                {isPending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Salvando...
                  </>
                ) : ultimo ? (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Salvar empréstimo
                  </>
                ) : (
                  <>
                    Continuar
                    <i className="bi bi-arrow-right ms-2"></i>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
