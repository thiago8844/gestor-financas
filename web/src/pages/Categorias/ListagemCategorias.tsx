import PageLayout from "../../layouts/PageLayout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { deleteCategoria, getCategorias, type Categoria } from "../../api/categoria";
import { Listagem } from "../../components/Listagens/Listagem";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { CriarCategoriaModal } from "./components/CriarCategoriaModal";
import { useState } from "react";
import { EditarCategoriaModal } from "./components/EditarCategoriaModal";

/**
 *
 * TODOS:
 * CRIAR MODAL DE EXCLUSÃO, MODAL DE EDIÇÃO, E BARRA DE PESQUISA
 */

export function ListagemCategorias() {
  const [novaCategoriaModalAberto, setNovaCategoriaModalAberto] =
    useState(false);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Categoria | null>(null);


  const { openModal } = useConfirmModalStore();

  const { data, refetch, isLoading, isFetching, isError } = useQuery({
    queryKey: ["categorias_usuario"],
    queryFn: () => getCategorias(),
  });

  const { mutate } = useMutation({
    mutationFn: (id: number) => deleteCategoria(id),
    onSuccess: () => {
      refetch();
      alert("Categoria Excluída com sucesso");
    },
    onError: () => {
      alert("Erro ao excluir categoria");
    },
  });

  if (isError) {
    return (
      <div>
        <p>Erro ao buscar Categorias</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const categorias = data?.data ?? [];

  return (
    <PageLayout title="Categorias" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <button
              onClick={() => setNovaCategoriaModalAberto(true)}
              className="btn btn-success"
            >
              <i className="bi bi-plus-circle me-2"></i>
              Nova Categoria
            </button>
          </Listagem.Acoes>
        </Listagem.Header>

        <Listagem.Tabela
          headers={["Nº", "Nome", "Ações"]}
          loading={isLoading || isFetching}
          emptyMessage="Nenhuma Categoria Encontrada"
        >
          {categorias.map((cat, index) => (
            <tr>
              <td>{index + 1}</td>
              <td>{cat.name}</td>
              <td>
                <div className="d-flex gap-2">
                  {/* EDITAR */}
                  <button 
                  onClick={() => setCategoriaSelecionada(cat)}
                  className="btn btn-primary">
                    <i className="bi bi-pencil"></i>
                  </button>
                  {/* EXCLUIR */}
                  <button
                    onClick={() =>
                      openModal({
                        callback: () => mutate(cat.id),
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir essa categoria ? ${cat.qtd_transacoes} transações vão ficar sem categoria ! `,
                        autoClose: true,
                      })
                    }
                    className="btn btn-danger"
                  >
                    <i className="bi bi-trash3-fill"></i>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Listagem.Tabela>
      </Listagem>

      <CriarCategoriaModal
        show={novaCategoriaModalAberto}
        setShow={setNovaCategoriaModalAberto}
      />

      {categoriaSelecionada && (
        <EditarCategoriaModal
          show={!!categoriaSelecionada}
          setShow={(state) =>
            setCategoriaSelecionada(state ? categoriaSelecionada : null)
          }
          categoria={categoriaSelecionada}
        />
      )}

    </PageLayout>
  );
}
