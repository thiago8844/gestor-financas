import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { Listagem } from "../../components/Listagens/Listagem";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { convertNumberToCurrencyMask } from "../../utils";
import {
  alternarAtivoRecorrencia,
  deletarRecorrencia,
  getRecorrencias,
} from "../../api/recorrencias";
import { formatarFrequencia } from "./formatarFrequencia";

export function ListagemRecorrencia() {
  const queryClient = useQueryClient();
  const { openModal } = useConfirmModalStore();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["recorrencias"],
    queryFn: () => getRecorrencias(),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { mutate: deletar } = useMutation({
    mutationFn: (id: number) => deletarRecorrencia(id),
    onSuccess: () => refetch(),
    onError: () => alert("Erro ao excluir recorrência. Tente novamente."),
  });

  const { mutate: alternarAtivo } = useMutation({
    mutationFn: (id: number) => alternarAtivoRecorrencia(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recorrencias"] }),
    onError: () => alert("Erro ao alterar status da recorrência. Tente novamente."),
  });

  if (isError) {
    return (
      <div>
        <p>Erro ao buscar recorrências</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const recorrencias = data?.data || [];

  return (
    <PageLayout title="Transações Recorrentes" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/recorrencias/cadastrar" className="btn btn-success">
              <i className="bi bi-plus-circle me-2"></i>
              Nova Recorrência
            </Link>
          </Listagem.Acoes>
        </Listagem.Header>

        <Listagem.Tabela
          headers={[
            "Descrição",
            "Tipo",
            "Valor",
            "Frequência",
            "Próxima geração",
            "Nasce como",
            "Ativa",
            "Ações",
          ]}
          loading={isLoading || isFetching}
          emptyMessage="Nenhuma recorrência cadastrada"
        >
          {recorrencias.map((recorrencia) => (
            <tr key={recorrencia.id}>
              <td>{recorrencia.description}</td>
              <td>
                {recorrencia.type === "EXPENSE" ? (
                  <span className="badge text-bg-danger">Despesa</span>
                ) : (
                  <span className="badge text-bg-success">Receita</span>
                )}
              </td>
              <td>
                {recorrencia.amount !== null ? (
                  `R$ ${convertNumberToCurrencyMask(recorrencia.amount)}`
                ) : (
                  <span className="text-muted">Variável</span>
                )}
              </td>
              <td>{formatarFrequencia(recorrencia)}</td>
              <td>{recorrencia.active ? recorrencia.next_run_date : "-"}</td>
              <td>
                {recorrencia.default_status === "PAID" ? (
                  <span className="badge text-bg-success">Paga</span>
                ) : (
                  <span className="badge text-bg-secondary">Pendente</span>
                )}
              </td>
              <td>
                <div className="form-check form-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    className="form-check-input"
                    checked={recorrencia.active}
                    onChange={() => alternarAtivo(recorrencia.id)}
                    title={recorrencia.active ? "Pausar recorrência" : "Reativar recorrência"}
                  />
                </div>
              </td>
              <td>
                <div className="d-flex gap-2">
                  <Link
                    to={`/recorrencias/editar/${recorrencia.id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    <i className="bi bi-pencil"></i>
                  </Link>
                  <button
                    onClick={() =>
                      openModal({
                        callback: () => deletar(recorrencia.id),
                        title: "Confirmar Exclusão",
                        message:
                          "Tem certeza que deseja excluir esta recorrência? As transações já geradas por ela não serão apagadas.",
                        autoClose: true,
                      })
                    }
                    className="btn btn-sm btn-danger"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Listagem.Tabela>
      </Listagem>
    </PageLayout>
  );
}
