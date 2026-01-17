import React from "react";
import { Modal } from "react-bootstrap";
import { SubmitBtn } from "../../../components/SubmitBtn";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { criarCategoria } from "../../../api/categoria";
import { useForm } from "react-hook-form";
import {
  CategoriaFormSchema,
  type CategoriaForm,
} from "../../../schemas/categoria";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../../components/FieldError";
import { defaultFormErrorHandler } from "../../../utils/formErrorHandlers";
import type { AxiosError } from "axios";

export function CriarCategoriaModal({
  show,
  setShow,
}: {
  show: boolean;
  setShow: (state: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<CategoriaForm>({
    resolver: zodResolver(CategoriaFormSchema),
  });
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: (name: string) => criarCategoria(name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["categorias_usuario"],
      });
      alert("Categoria cadastrada com sucesso");
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  const onSubmit = (data: CategoriaForm) => {
    mutate(data.name);
  };

  const closeModal = () => {
    reset();
    setShow(false);
  };

  return (
    <Modal show={show} onHide={closeModal}>
      <Modal.Header closeButton>
        <Modal.Title>Cadastrar Nova Categoria</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          {errors.root && (
            <div className="alert alert-danger">{errors.root.message}</div>
          )}
          <div className="form-group mb-3">
            <label className="form-label" htmlFor="nova_categoria">
              Nome da Categoria
            </label>
            <input
              type="text"
              className="form-control text-uppercase"
              id="nova_categoria"
              {...register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <SubmitBtn loading={isPending}>Cadastrar</SubmitBtn>
        </form>
      </Modal.Body>
    </Modal>
  );
}
