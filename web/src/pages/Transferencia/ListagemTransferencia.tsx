import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { Listagem } from "../../components/Listagens/Listagem";
import { Paginator } from "../../components/Listagens/Paginator";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { convertNumberToCurrencyMask } from "../../utils";
import { deletarTransferencia, getTransferencias } from "../../api/transferencias";

export function ListagemTransferencia() {
  const [page, setPage] = useState(1);
  const { openModal } = useConfirmModalStore();
  const { invalidateContas, invalidateFormularios } = useCacheUtils();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["transferencias", page],
    queryFn: () => getTransferencias({ page }),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { mutate: deletar } = useMutation({
    mutationFn: (id: number) => deletarTransferencia(id),
    onSuccess: () => {
      invalidateContas();
      invalidateFormularios();
      refetch();
    },
    onError: () => alert("Erro ao excluir transferência. Tente novamente."),
  });

  if (isError) {
    return (
      <div>
        <p>Erro ao buscar transferências</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const transferencias = data?.data || [];
  const meta = data?.meta;

  return (
    <PageLayout title="Transferências" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/transferencias/cadastrar" className="btn btn-success">
              <i className="bi bi-plus-circle me-2"></i>
              Nova Transferência
            </Link>
          </Listagem.Acoes>
        </Listagem.Header>

        <Listagem.Tabela
          headers={["Data", "Descrição", "Origem", "Destino", "Valor", "Ações"]}
          loading={isLoading || isFetching}
          emptyMessage="Nenhuma transferência cadastrada"
        >
          {transferencias.map((transferencia) => (
            <tr key={transferencia.id}>
              <td>{transferencia.date}</td>
              <td>{transferencia.description || "-"}</td>
              <td>{transferencia.conta_origem?.name ?? "-"}</td>
              <td>{transferencia.conta_destino?.name ?? "-"}</td>
              <td>R$ {convertNumberToCurrencyMask(Number(transferencia.amount))}</td>
              <td>
                <div className="d-flex gap-2">
                  <Link
                    to={`/transferencias/editar/${transferencia.id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    <i className="bi bi-pencil"></i>
                  </Link>
                  <button
                    onClick={() =>
                      openModal({
                        callback: () => deletar(transferencia.id),
                        title: "Confirmar Exclusão",
                        message:
                          "Tem certeza que deseja excluir esta transferência? O valor volta para a conta de origem e sai da conta de destino.",
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

        {meta && (
          <Listagem.Paginacao>
            <Paginator meta={meta} onPageChange={setPage} />
          </Listagem.Paginacao>
        )}
      </Listagem>
    </PageLayout>
  );
}
