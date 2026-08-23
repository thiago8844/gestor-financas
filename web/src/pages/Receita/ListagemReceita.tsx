import { useMutation, useQuery } from "@tanstack/react-query";
import { deletarTransacao, getGruposParcelados, getTransacoes } from "../../api/transacoes";
import PageLayout from "../../layouts/PageLayout";
import { Link } from "react-router-dom";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { convertNumberToCurrencyMask } from "../../utils";
import { Paginator } from "../../components/Listagens/Paginator";
import { useState } from "react";
import { getCategorias } from "../../api/categoria";
import { getContas } from "../../api/conta";
import type { Conta } from "../../types";
import { Listagem } from "../../components/Listagens/Listagem";

// TODO: COLOCAR O STATUS PENDENTE EM RECEITAS DEPOIS

const filtrosOriginais = {
  type: "INCOME" as const,
  page: 1,
  limit: 25,
  // Outros filtros que você quiser adicionar
  data_inicial: "",
  data_final: "",
  categoria_id: undefined as number | undefined,
  nomeCategoria: "",
  periodo: "",
  order_by: "date_desc",
  conta_id: undefined as number | undefined,
  apenas_parceladas: false,
  installment_group: undefined as string | undefined,
};

export function ListagemReceita() {
  //Filtros despesa
  const [filtros, setFiltros] = useState(filtrosOriginais);
  const [filtrosModificados, setFiltrosModificados] =
    useState(filtrosOriginais);

  //Query Receitas
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["receitas", filtros],
    queryFn: () => getTransacoes(filtros),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { data: categorias, refetch: refetchCategorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => getCategorias(),
  });

  const { data: contas, refetch: refetchContas } = useQuery({
    queryKey: ["contas"],
    queryFn: () => getContas({ active: true, tipo: "INCOME" }),
  });

  const { data: gruposParcelados } = useQuery({
    queryKey: ["receitas", "grupos-parcelados"],
    queryFn: () => getGruposParcelados("INCOME"),
    enabled: filtrosModificados.apenas_parceladas,
  });

  //Deletar Receita
  const { mutate } = useMutation({
    mutationFn: (id: number) => deletarTransacao(id),
    onSuccess: () => {
      refetch(); // Refaz a consulta para atualizar a lista de despesas
    },
    onError: () => {
      alert("Erro ao excluir despesa. Tente novamente.");
    },
  });

  const { openModal } = useConfirmModalStore();

  const handlePageChange = (page: number) => {
    setFiltros((prev) => ({ ...prev, page }));
  };

  const resetarFiltros = () => {
    setFiltros(filtrosOriginais);
    setFiltrosModificados(filtrosOriginais);
  };

  const aplicarFiltros = () => {
    setFiltros({ ...filtrosModificados, page: 1 });
  };

  //Se falhar mostrar erro e o botão de refetch
  if (isError) {
    return (
      <div>
        <p>Erro ao buscar receitas</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const receitas = data?.data || [];
  const meta = data?.meta;
  //Após criar a tabela, verificar como componentizar ela

  // TODO: VER COMO ABSTRAIR ESSA LISTAGEM PARA OUTROS RECURSOS FICAREM MAIS SIMPLES DE FAZER

  return (
    <PageLayout title="Receitas" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/receitas/cadastrar" className="btn btn-success">
              <i className="bi bi-plus-circle me-2"></i>
              Nova Receita
            </Link>
          </Listagem.Acoes>

          {/* ✅ CONTROLES À DIREITA */}
          <Listagem.Controles>
            {/* SELECT DE LIMITE */}
            <Listagem.LimiteSelector
              value={filtros.limit}
              onChange={(limit) => setFiltros((prev) => ({ ...prev, limit }))}
            />

            {/* DROPDOWN DE FILTROS */}
            <Listagem.FiltrosDropdown
              onAplicar={aplicarFiltros}
              onLimpar={resetarFiltros}
            >
              {/* ✅ SEUS FILTROS CUSTOMIZADOS */}
              <div className="px-3 py-2">
                <label className="form-label small">Categoria:</label>
                <select
                  value={filtrosModificados.categoria_id || ""}
                  onChange={(e) =>
                    setFiltrosModificados({
                      ...filtrosModificados,
                      categoria_id: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  onFocus={() => refetchCategorias()}
                  className="form-select form-select-sm"
                >
                  <option value="">Sem Categoria</option>
                  {categorias?.data.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="px-3 py-2">
                <label className="form-label small">Conta:</label>
                <select
                  value={filtrosModificados.conta_id || ""}
                  onChange={(e) =>
                    setFiltrosModificados({
                      ...filtrosModificados,
                      conta_id: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  onFocus={() => refetchContas()}
                  className="form-select form-select-sm"
                >
                  <option value="">Todas</option>
                  {contas?.data.map((conta: Conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="px-3 py-2">
                <label className="form-label small">Período:</label>
                <select
                  value={filtrosModificados.periodo}
                  onChange={(e) =>
                    setFiltrosModificados({
                      ...filtrosModificados,
                      periodo: e.target.value,
                    })
                  }
                  className="form-select form-select-sm"
                >
                  <option value="">Todos os períodos</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Esta semana</option>
                  <option value="mes">Este mês</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {filtrosModificados.periodo === "custom" && (
                <div className="mt-2">
                  <label className="form-label small">Data Inicial:</label>
                  <input
                    type="date"
                    className="form-control form-control-sm mb-2"
                    value={filtrosModificados.data_inicial}
                    onChange={(e) =>
                      setFiltrosModificados({
                        ...filtrosModificados,
                        data_inicial: e.target.value,
                      })
                    }
                  />

                  <label className="form-label small">Data Final:</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={filtrosModificados.data_final}
                    onChange={(e) =>
                      setFiltrosModificados({
                        ...filtrosModificados,
                        data_final: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              <div className="px-3 py-2">
                <div className="form-check form-switch">
                  <input
                    id="apenasParceladas"
                    type="checkbox"
                    role="switch"
                    className="form-check-input"
                    checked={filtrosModificados.apenas_parceladas}
                    onChange={(e) =>
                      setFiltrosModificados({
                        ...filtrosModificados,
                        apenas_parceladas: e.target.checked,
                        installment_group: undefined,
                      })
                    }
                  />
                  <label htmlFor="apenasParceladas" className="form-check-label small">
                    Somente receitas compostas (parceladas)
                  </label>
                </div>

                {filtrosModificados.apenas_parceladas && (
                  <div className="mt-2">
                    <label className="form-label small">Recebimento parcelado:</label>
                    <select
                      value={filtrosModificados.installment_group || ""}
                      onChange={(e) =>
                        setFiltrosModificados({
                          ...filtrosModificados,
                          installment_group: e.target.value || undefined,
                        })
                      }
                      className="form-select form-select-sm"
                    >
                      <option value="">Todas as compostas</option>
                      {gruposParcelados?.data.map((grupo) => (
                        <option key={grupo.installment_group} value={grupo.installment_group}>
                          {grupo.description} ({grupo.installment_total}x) —{" "}
                          {grupo.installment_group.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Listagem.FiltrosDropdown>

            {/* DROPDOWN DE ORDENAR */}
            <Listagem.OrdenarDropdown>
              {/* ✅ SEUS RADIOS CUSTOMIZADOS */}
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                  id="date_desc"
                  value="date_desc"
                  checked={filtros.order_by === "date_desc"}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      order_by: e.target.value,
                    })
                  }
                />
                <label htmlFor="date_desc" className="form-check-label">
                  Data decrescente
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                  id="date_asc"
                  value="date_asc"
                  checked={filtros.order_by === "date_asc"}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      order_by: e.target.value,
                    })
                  }
                />
                <label htmlFor="date_asc" className="form-check-label">
                  Data crescente
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                  id="valor_desc"
                  value="valor_desc"
                  checked={filtros.order_by === "valor_desc"}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      order_by: e.target.value,
                    })
                  }
                />
                <label htmlFor="valor_desc" className="form-check-label">
                  Valor decrescente
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                  id="valor_asc"
                  value="valor_asc"
                  checked={filtros.order_by === "valor_asc"}
                  onChange={(e) =>
                    setFiltros({
                      ...filtros,
                      order_by: e.target.value,
                    })
                  }
                />
                <label htmlFor="valor_asc" className="form-check-label">
                  Valor crescente
                </label>
              </div>
            </Listagem.OrdenarDropdown>
          </Listagem.Controles>
        </Listagem.Header>

        {/* ✅ TABELA */}
        <Listagem.Tabela
          headers={[
            "ID",
            "Descrição",
            "Valor",
            "Data Transação",
            "Conta",
            "Categoria",
            "Parcela",
            "Ações",
          ]}
          footer={
            <div className="d-flex justify-content-between align-items-center bg-light px-4 py-3 border-top">
              <span className="text-muted fw-semibold">
                <i className="bi bi-calculator me-2"></i>
                Total de Receitas
              </span>
              <span className="fs-5 fw-bold text-success">
                R$ {convertNumberToCurrencyMask(data?.total || 0)}
              </span>
            </div>
          }
          loading={isLoading || isFetching}
          emptyMessage="Nenhuma receita encontrada"
        >
          {receitas.map((receita) => (
            <tr key={receita.id}>
              <td>{receita.id}</td>
              <td>
                {receita.description}
                {receita.is_recurring && (
                  <Link
                    to={`/recorrencias/editar/${receita.recurring_transaction_id}`}
                    className="badge text-bg-light border ms-2 text-decoration-none"
                    title="Veio de uma recorrência — clique para ver/editar a regra"
                  >
                    <i className="bi bi-arrow-repeat"></i> Recorrente
                  </Link>
                )}
              </td>
              <td className="text-success fw-bold">
                {receita.amount !== null ? (
                  `R$ ${convertNumberToCurrencyMask(receita.amount)}`
                ) : (
                  <span className="text-muted fw-normal">A definir</span>
                )}
              </td>
              <td>{receita.date ?? "-"}</td>
              <td>{receita.conta?.name || "-"}</td>
              <td>
                {receita.categoria ? (
                  <span className="badge text-bg-secondary">
                    {receita.categoria.name}
                  </span>
                ) : (
                  "-"
                )}
              </td>

              {/* <td>
                {despesa.status === "PAID" ? (
                  <span className="badge text-bg-success">PAGO</span>
                ) : (
                  <span className="badge text-bg-secondary">PENDENTE</span>
                )}
              </td> */}

              <td>
                {receita.is_installment && receita.installment_group ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-info d-flex flex-column align-items-start py-1 px-2"
                    title={`Ver todas as parcelas do grupo ${receita.installment_group}`}
                    onClick={() => {
                      setFiltrosModificados({
                        ...filtrosModificados,
                        apenas_parceladas: true,
                        installment_group: receita.installment_group as string,
                      });
                      setFiltros({
                        ...filtros,
                        apenas_parceladas: true,
                        installment_group: receita.installment_group as string,
                        page: 1,
                      });
                    }}
                  >
                    <span className="badge text-bg-info">
                      {receita.installment_number}/{receita.installment_total}
                    </span>
                    <small className="text-muted" style={{ fontSize: "0.65rem" }}>
                      {receita.installment_group.slice(0, 8)}
                    </small>
                  </button>
                ) : (
                  "-"
                )}
              </td>

              <td>
                <div className="d-flex gap-2">
                  <Link
                    to={`/receitas/editar/${receita.id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    <i className="bi bi-pencil"></i>
                  </Link>
                  <button
                    onClick={() =>
                      openModal({
                        callback: () => mutate(receita.id),
                        title: "Confirmar Exclusão",
                        message: "Tem certeza que deseja excluir esta despesa?",
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

        {/* ✅ PAGINAÇÃO */}
        {meta && (
          <Listagem.Paginacao>
            <Paginator meta={meta} onPageChange={handlePageChange} />
          </Listagem.Paginacao>
        )}
      </Listagem>
    </PageLayout>
  );
}
