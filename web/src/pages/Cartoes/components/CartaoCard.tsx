import { useState } from "react";
import { Dropdown } from "react-bootstrap";
import type { Cartao } from "../../../types/cartao";
import { useNavigate } from "react-router-dom";
import { useConfirmModalStore } from "../../../stores/confirmModal";
import { deletarCartao } from "../../../api/cartao";
import { useMutation } from "@tanstack/react-query";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import { FaturasDoCartao } from "./FaturasDoCartao";

export function CartaoCard({ cartao }: { cartao: Cartao }) {
  const { openModal } = useConfirmModalStore();
  const { invalidateCartoes } = useCacheUtils();
  const [expandido, setExpandido] = useState(false);

  const navigate = useNavigate();

  const { mutate } = useMutation({
    mutationFn: (id: number) => deletarCartao(id),
    onSuccess: () => {
      invalidateCartoes();
      alert("Cartão excluído com sucesso!");
    },
    onError: () => {
      alert("Erro ao excluir cartão. Tente novamente.");
    },
  });

  const handleEdit = (id: number) => {
    navigate(`/cartoes/editar/${id}`);
  };

  return (
    <div className="col-12 mb-3">
      <div className={`card ${!cartao.active ? "opacity-75" : ""}`}>
        <div className="card-body">
          {/* Header com nome e ações */}
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div className="flex-grow-1">
              <h5 className="card-title mb-1" title={cartao.name}>
                <i className="bi bi-credit-card me-1"></i>
                {cartao.name}
              </h5>

              <div className="d-flex flex-wrap gap-3 text-muted small">
                <span>
                  <i className="bi bi-wallet2 me-1"></i>
                  {cartao.conta_nome}
                </span>
                <span>
                  <i className="bi bi-calendar-x me-1"></i>
                  Fecha dia {cartao.closing_day}
                </span>
                <span>
                  <i className="bi bi-calendar-check me-1"></i>
                  Vence dia {cartao.due_day}
                </span>
                <span
                  className={`badge ${cartao.active ? "bg-success" : "bg-secondary"}`}
                >
                  <i className={`bi ${cartao.active ? "bi-check-circle" : "bi-x-circle"} me-1`}></i>
                  {cartao.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => setExpandido((v) => !v)}
              >
                <i className={`bi bi-chevron-${expandido ? "up" : "down"} me-1`}></i>
                {expandido ? "Ocultar faturas" : "Ver faturas"}
              </button>

              <Dropdown>
                <Dropdown.Toggle
                  variant="light"
                  size="sm"
                  id={`dropdown-${cartao.id}`}
                ></Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => handleEdit(cartao.id)}>
                    Editar
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={() =>
                      openModal({
                        callback: () => mutate(cartao.id),
                        message: "Tem certeza que deseja excluir este cartão?",
                        title: "Excluir Cartão",
                        autoClose: true,
                      })
                    }
                  >
                    Excluir
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>

          {expandido && <FaturasDoCartao cartao={cartao} />}
        </div>
      </div>
    </div>
  );
}
