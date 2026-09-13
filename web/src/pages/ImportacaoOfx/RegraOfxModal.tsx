import { Modal } from "react-bootstrap";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { SubmitBtn } from "../../components/SubmitBtn";
import { FieldError } from "../../components/FieldError";
import { RegraOfxSchema, type RegraOfxForm } from "../../schemas/ofxImportacao";
import { criarRegraOfx } from "../../api/regrasOfx";
import { defaultFormErrorHandler } from "../../utils/formErrorHandlers";
import type { Categoria } from "../../api/categoria";
import type { Orcamento } from "../../types/orcamento";

type Props = {
  show: boolean;
  onClose: () => void;
  ofxImportId: number;
  categorias: Categoria[];
  orcamentos: Orcamento[];
  valoresIniciais: {
    descricao_contains: string;
    tipo?: "INCOME" | "EXPENSE";
    descricao?: string;
    category_id?: number;
    budget_id?: number;
  };
};

export function RegraOfxModal({ show, onClose, ofxImportId, categorias, orcamentos, valoresIniciais }: Props) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<RegraOfxForm>({
    // @ts-expect-error TS não entende Zod transform string->number
    resolver: zodResolver(RegraOfxSchema),
    values: { aplicar_ao_lote: true, ...valoresIniciais },
  });

  const onSubmit = (dados: unknown) => {
    mutate(dados as RegraOfxForm);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (dados: RegraOfxForm) => criarRegraOfx({ ...dados, ofx_import_id: ofxImportId }),
    onSuccess: (resposta) => {
      queryClient.invalidateQueries({ queryKey: ["importacao-ofx", ofxImportId] });
      alert(
        resposta.itens_aplicados
          ? `Regra criada e aplicada a mais ${resposta.itens_aplicados} transação(ões) desta importação.`
          : "Regra criada com sucesso."
      );
      reset();
      onClose();
    },
    onError: (error: AxiosError) => defaultFormErrorHandler(error, setError),
  });

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Criar regra automática</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          {errors.root && <div className="alert alert-danger">{errors.root.message}</div>}

          <p className="text-muted small">
            Da próxima vez que aparecer uma transação com a mesma descrição, ela já virá preenchida
            automaticamente.
          </p>

          <div className="form-group mb-3">
            <label className="form-label">Quando a descrição do OFX contém</label>
            <input type="text" className="form-control" {...register("descricao_contains")} />
            <FieldError>{errors.descricao_contains?.message}</FieldError>
          </div>

          <div className="form-group mb-3">
            <label className="form-label">Tipo (opcional)</label>
            <select className="form-select" {...register("tipo")}>
              <option value="">Qualquer tipo</option>
              <option value="EXPENSE">Despesa</option>
              <option value="INCOME">Receita</option>
            </select>
          </div>

          <hr />
          <p className="fw-semibold mb-2">Então preencher:</p>

          <div className="form-group mb-3">
            <label className="form-label">Descrição</label>
            <input type="text" className="form-control" {...register("descricao")} />
          </div>

          <div className="form-group mb-3">
            <label className="form-label">Categoria</label>
            <select className="form-select" {...register("category_id")}>
              <option value="">Sem categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group mb-3">
            <label className="form-label">Orçamento</label>
            <select className="form-select" {...register("budget_id")}>
              <option value="">Sem orçamento</option>
              {orcamentos.map((orcamento) => (
                <option key={orcamento.id} value={orcamento.id}>
                  {orcamento.name}
                </option>
              ))}
            </select>
          </div>
          <FieldError>{errors.descricao?.message}</FieldError>

          <div className="form-check form-switch mb-3">
            <input
              type="checkbox"
              role="switch"
              className="form-check-input"
              id="aplicar_ao_lote"
              {...register("aplicar_ao_lote")}
            />
            <label htmlFor="aplicar_ao_lote" className="form-check-label">
              Aplicar às demais transações pendentes desta importação agora
            </label>
          </div>

          <SubmitBtn loading={isPending}>Criar regra</SubmitBtn>
        </form>
      </Modal.Body>
    </Modal>
  );
}
