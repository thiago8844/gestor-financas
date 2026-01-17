import { Modal } from "react-bootstrap";
import { SubmitBtn } from "../../../components/SubmitBtn";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editarCategoria, type Categoria } from "../../../api/categoria";
import { useForm } from "react-hook-form";
import {
  CategoriaFormSchema,
  type CategoriaForm,
} from "../../../schemas/categoria";
import { zodResolver } from "@hookform/resolvers/zod";
import { FieldError } from "../../../components/FieldError";
import { defaultFormErrorHandler } from "../../../utils/formErrorHandlers";
import type { AxiosError } from "axios";

export function EditarCategoriaModal({
  show,
  setShow,
  categoria,
}: {
  show: boolean;
  setShow: (state: boolean) => void;
  categoria: Categoria;
}) {
  //Formulário
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<CategoriaForm>({
    resolver: zodResolver(CategoriaFormSchema),
    defaultValues: {
      name: categoria.name,
    },
  });

  const queryClient = useQueryClient();

  //Edição
  const { mutate, isPending } = useMutation({
    mutationFn: (name: string) => editarCategoria(categoria.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["categorias_usuario"],
      });
      alert("Categoria editada com sucesso");
      setShow(false);
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
        <Modal.Title>Editar Categoria {categoria.name}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          {errors.root && (
            <div className="alert alert-danger">{errors.root.message}</div>
          )}
          <div className="form-group mb-3">
            <label className="form-label" htmlFor="nova_categoria">
              Novo Nome da Categoria
            </label>
            <input
              type="text"
              className="form-control text-uppercase"
              id="editar_categoria"
              {...register("name")}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <SubmitBtn loading={isPending}>Editar</SubmitBtn>
        </form>
      </Modal.Body>
    </Modal>
  );
}
