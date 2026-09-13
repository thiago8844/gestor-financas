import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AxiosError } from "axios";
import PageLayout from "../../layouts/PageLayout";
import { Listagem } from "../../components/Listagens/Listagem";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { desfazerImportacaoOfx, getImportacoesOfx } from "../../api/ofxImportacoes";
import type { OfxDesfazerBloqueadoError, OfxImportStatus } from "../../types/ofx";

const badgeStatus: Record<OfxImportStatus, { texto: string; classe: string }> = {
  STAGED: { texto: "Em revisão", classe: "text-bg-warning" },
  CONFIRMED: { texto: "Confirmada", classe: "text-bg-success" },
  UNDONE: { texto: "Desfeita", classe: "text-bg-secondary" },
};

export function HistoricoImportacoesOfx() {
  const queryClient = useQueryClient();
  const { openModal } = useConfirmModalStore();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["importacoes-ofx"],
    queryFn: () => getImportacoesOfx(),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { mutate: desfazer } = useMutation({
    mutationFn: ({ id, forcar }: { id: number; forcar?: boolean }) => desfazerImportacaoOfx(id, forcar),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["importacoes-ofx"] }),
    onError: (error: AxiosError<OfxDesfazerBloqueadoError>, variaveis) => {
      if (error.response?.status === 409 && !variaveis.forcar) {
        openModal({
          title: "Transações editadas depois da importação",
          message:
            "Algumas transações desta importação foram alteradas depois de importadas. Desfazer mesmo assim vai apagá-las junto com as demais. Continuar?",
          callback: () => desfazer({ id: variaveis.id, forcar: true }),
          autoClose: true,
        });
      } else {
        alert("Erro ao desfazer importação. Tente novamente.");
      }
    },
  });

  if (isError) {
    return (
      <div>
        <p>Erro ao buscar importações</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const importacoes = data?.data || [];

  return (
    <PageLayout title="Importar Extrato (OFX)" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/importacoes-ofx/nova" className="btn btn-success">
              <i className="bi bi-file-earmark-arrow-up me-2"></i>
              Nova Importação
            </Link>
          </Listagem.Acoes>
        </Listagem.Header>

        <Listagem.Tabela
          headers={["Arquivo", "Período", "Status", "Total", "Importadas", "Duplicadas", "Ignoradas", "Ações"]}
          loading={isLoading || isFetching}
          emptyMessage="Nenhuma importação realizada ainda"
        >
          {importacoes.map((importacao) => {
            const badge = badgeStatus[importacao.status];

            return (
              <tr key={importacao.id}>
                <td>{importacao.original_filename}</td>
                <td>
                  {importacao.period_start && importacao.period_end
                    ? `${importacao.period_start} a ${importacao.period_end}`
                    : "-"}
                </td>
                <td>
                  <span className={`badge ${badge.classe}`}>{badge.texto}</span>
                </td>
                <td>{importacao.total_transactions}</td>
                <td>{importacao.imported_transactions}</td>
                <td>{importacao.duplicate_transactions}</td>
                <td>{importacao.ignored_transactions}</td>
                <td>
                  <div className="d-flex gap-2">
                    {importacao.status === "STAGED" && (
                      <Link
                        to={`/importacoes-ofx/${importacao.id}`}
                        className="btn btn-sm btn-primary"
                      >
                        <i className="bi bi-eye me-1"></i>
                        Revisar
                      </Link>
                    )}
                    {importacao.pode_desfazer && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() =>
                          openModal({
                            title: "Desfazer importação",
                            message:
                              "As transações criadas por esta importação serão apagadas. Tem certeza?",
                            callback: () => desfazer({ id: importacao.id }),
                            autoClose: true,
                          })
                        }
                      >
                        <i className="bi bi-arrow-counterclockwise me-1"></i>
                        Desfazer
                      </button>
                    )}
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
