import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { Listagem } from "../../components/Listagens/Listagem";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { convertNumberToCurrencyMask } from "../../utils";
import { alternarAtivoOrcamento, deletarOrcamento, getOrcamentos } from "../../api/orcamentos";

export function ListagemOrcamento() {
  const queryClient = useQueryClient();
  const { openModal } = useConfirmModalStore();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["orcamentos"],
    queryFn: () => getOrcamentos(),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { mutate: deletar } = useMutation({
    mutationFn: (id: number) => deletarOrcamento(id),
    onSuccess: () => refetch(),
    onError: () => alert("Erro ao excluir orçamento. Tente novamente."),
  });

  const { mutate: alternarAtivo } = useMutation({
    mutationFn: (id: number) => alternarAtivoOrcamento(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orcamentos"] }),
    onError: () => alert("Erro ao alterar status do orçamento. Tente novamente."),
  });

  if (isError) {
    return (
      <div>
        <p>Erro ao buscar orçamentos</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const orcamentos = data?.data || [];

  return (
    <PageLayout title="Orçamentos" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/orcamentos/cadastrar" className="btn btn-success">
              <i className="bi bi-plus-circle me-2"></i>
              Novo Orçamento
            </Link>
          </Listagem.Acoes>
        </Listagem.Header>

        <Listagem.Tabela
          headers={["Nome", "Tipo", "Período atual", "Limite", "Gasto", "Progresso", "Ativo", "Ações"]}
          loading={isLoading || isFetching}
          emptyMessage="Nenhum orçamento cadastrado"
        >
          {orcamentos.map((orcamento) => {
            const resumo = orcamento.resumo;
            const percentual = resumo.percentual_utilizado ?? 0;
            const estourou = percentual >= 100;
            const corBarra = estourou ? "bg-danger" : resumo.alerta_atingido ? "bg-warning" : "bg-success";

            return (
              <tr key={orcamento.id}>
                <td>
                  <Link to={`/orcamentos/${orcamento.id}`}>{orcamento.name}</Link>
                </td>
                <td>
                  {orcamento.type === "ONE_TIME" ? (
                    <span className="badge text-bg-primary">Pontual</span>
                  ) : (
                    <span className="badge text-bg-info">Recorrente</span>
                  )}
                </td>
                <td>
                  {resumo.periodo
                    ? `${resumo.periodo.inicio} a ${resumo.periodo.fim}`
                    : resumo.periodos_pontuais?.map((periodo) => `${periodo.inicio} a ${periodo.fim}`).join(", ")}
                </td>
                <td>
                  {resumo.limite !== null ? (
                    `R$ ${convertNumberToCurrencyMask(resumo.limite)}`
                  ) : (
                    <span className="text-muted">Sem limite</span>
                  )}
                </td>
                <td>R$ {convertNumberToCurrencyMask(resumo.gasto)}</td>
                <td style={{ minWidth: 140 }}>
                  {resumo.limite !== null ? (
                    <div className="progress" style={{ height: "8px" }}>
                      <div
                        className={`progress-bar ${corBarra}`}
                        style={{ width: `${Math.min(percentual, 100)}%` }}
                      ></div>
                    </div>
                  ) : (
                    <span className="text-muted small">—</span>
                  )}
                </td>
                <td>
                  <div className="form-check form-switch">
                    <input
                      type="checkbox"
                      role="switch"
                      className="form-check-input"
                      checked={orcamento.active}
                      onChange={() => alternarAtivo(orcamento.id)}
                      title={orcamento.active ? "Pausar orçamento" : "Reativar orçamento"}
                    />
                  </div>
                </td>
                <td>
                  <div className="d-flex gap-2">
                    <Link to={`/orcamentos/editar/${orcamento.id}`} className="btn btn-sm btn-secondary">
                      <i className="bi bi-pencil"></i>
                    </Link>
                    <button
                      onClick={() =>
                        openModal({
                          callback: () => deletar(orcamento.id),
                          title: "Confirmar Exclusão",
                          message:
                            "Tem certeza que deseja excluir este orçamento? As transações vinculadas não serão apagadas.",
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
            );
          })}
        </Listagem.Tabela>
      </Listagem>
    </PageLayout>
  );
}
