import { Dropdown } from "react-bootstrap";
import type { Conta } from "../../../types/conta";
import { convertNumberToCurrencyMask } from "../../../utils";
import { useNavigate } from "react-router-dom";
import { useConfirmModalStore } from "../../../stores/confirmModal";
import { deletarConta } from "../../../api/conta";
import { useMutation } from "@tanstack/react-query";
import { useCacheUtils } from "../../../hooks/useCacheUtils"; // ✅ NOVO

export function ContaCard({ conta }: { conta: Conta }) {
  const { openModal } = useConfirmModalStore();
  const { invalidateFormularios } = useCacheUtils(); // ✅ NOVO

  const navigate = useNavigate();

  const { mutate } = useMutation({
    mutationFn: (id: number) => deletarConta(id),
    onSuccess: () => {
      invalidateFormularios(); // ✅ Atualiza TODOS os formulários
      alert("Conta excluída com sucesso!");
    },
    onError: () => {
      alert("Erro ao excluir conta. Tente novamente.");
    },
  });

  // const handleToggleStatus = () => {
  //   // TODO: Implementar toggle de status ativo/inativo
  //   console.log("Toggle status da conta:", conta.id);
  // };

  const handleEdit = (id: number) => {
    navigate(`/contas/editar/${id}`);
  };

  const getTipoBadge = (type: string) => {
    return type === "INCOME" ? (
      <span className="badge bg-success">📈 Receita</span>
    ) : (
      <span className="badge bg-danger">💰 Despesa</span>
    );
  };

  const isReceita = conta.type === "INCOME";

  return (
    <div className="col-12 col-md-6 col-lg-4 mb-3">
      <div className={`card h-100 ${!conta.active ? "opacity-75" : ""}`}>
        <div className="card-body d-flex flex-column">
          {/* Header com nome, tipo e ações */}
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div className="flex-grow-1">
              <h5 className="card-title mb-1 text-truncate" title={conta.name}>
                {conta.name}
              </h5>
              {getTipoBadge(conta.type)}
            </div>

            <Dropdown>
              <Dropdown.Toggle
                variant="light"
                size="sm"
                id={`dropdown-${conta.id}`}
              ></Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Item onClick={() => handleEdit(conta.id)}>
                  Editar
                </Dropdown.Item>
                {/* TODO: IMPLEMENTAR DESATIVAÇÃO MAIS TARDE */}
                {/* <Dropdown.Item>Desativar</Dropdown.Item> */}
                <Dropdown.Item
                  onClick={() =>
                    openModal({
                      callback: () => mutate(conta.id),
                      message: "Tem certeza que deseja excluir esta conta?",
                      title: "Excluir Conta",
                      autoClose: true,
                    })
                  }
                >
                  Excluir
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {/* Informações organizadas */}
          <div className="mb-3 flex-grow-1">
            {/* Rótulo/Função */}
            {isReceita && (
              <div className="mb-2">
                <small className="text-muted d-block">
                  <i className="bi bi-tag me-1"></i>Rótulo
                </small>
                <span className="fw-medium">{conta.role}</span>
              </div>
            )}

            {/* Moeda */}
            <div className="mb-2">
              <small className="text-muted d-block">
                <i className="bi bi-currency-exchange me-1"></i>Moeda
              </small>
              <span className="text-uppercase fw-medium">{conta.currency}</span>
            </div>

            {/* Instituição */}
            {conta.instituicao && (
              <div className="mb-2">
                <small className="text-muted d-block">
                  <i className="bi bi-building me-1"></i>Instituição
                </small>
                <span>{conta.instituicao}</span>
              </div>
            )}

            {/* Status badges */}
            <div className="d-flex gap-2 flex-wrap mt-3">
              <span
                className={`badge ${
                  conta.active ? "bg-success" : "bg-secondary"
                }`}
              >
                <i
                  className={`bi ${
                    conta.active ? "bi-check-circle" : "bi-x-circle"
                  } me-1`}
                ></i>
                {conta.active ? "Ativa" : "Inativa"}
              </span>

              {conta.include_in_networth && isReceita && (
                <span className="badge bg-info">
                  <i className="bi bi-graph-up me-1"></i>Patrimônio
                </span>
              )}
            </div>
          </div>

          {/* Saldo destacado no rodapé */}
          <div className="border-top pt-3 mt-auto">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <small className="text-muted d-block">Saldo Atual</small>
                <h4 className="mb-0 text-primary fw-bold">
                  {convertNumberToCurrencyMask(conta.saldo)}
                </h4>
              </div>
              <div className="text-end">
                <small className="text-muted d-block">ID: {conta.id}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
