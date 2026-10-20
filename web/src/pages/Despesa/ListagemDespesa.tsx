import { useMutation, useQuery } from "@tanstack/react-query";
import {
  deletarDespesa,
  deletarTransacoesMultiplas,
  getGruposParcelados,
  getTransacoes,
} from "../../api/transacoes";
import PageLayout from "../../layouts/PageLayout";
import { Link, useNavigate } from "react-router-dom";
import { useConfirmModalStore } from "../../stores/confirmModal";
import { convertNumberToCurrencyMask } from "../../utils";
import { Paginator } from "../../components/Listagens/Paginator";
import { useState } from "react";

import { getCategorias } from "../../api/categoria";
import { getContas } from "../../api/conta";
import { getCartoes } from "../../api/cartao";
import type { Conta } from "../../types";
import type { Cartao } from "../../types/cartao";
import { Listagem } from "../../components/Listagens/Listagem";
import { AcoesEmMassa } from "../../components/Listagens/AcoesEmMassa";
import { CampoDataSelect, DatasTransacao, SituacaoSelect } from "../../components/Listagens/CampoData";
import { useSelecaoEmMassa } from "../../hooks/useSelecaoEmMassa";
import { useCacheUtils } from "../../hooks/useCacheUtils";
import { toast } from "../../utils/toast";

const filtrosOriginais = {
  type: "EXPENSE" as const,
  page: 1,
  limit: 25,
  descricao: "",
  // Outros filtros que você quiser adicionar
  data_inicial: "",
  data_final: "",
  categoria_id: undefined as number | undefined,
  nomeCategoria: "",
  periodo: "",
  order_by: "date_desc",
  campo_data: "",
  status: "",
  origem: "" as "" | "conta" | "cartao",
  conta_id: undefined as number | undefined,
  cartao_id: undefined as number | undefined,
  apenas_parceladas: false,
  installment_group: undefined as string | undefined,
};

export function ListagemDespesa() {
  const navigate = useNavigate();
  const selecao = useSelecaoEmMassa();
  const { invalidateFaturas } = useCacheUtils();

  //Filtros despesa
  const [filtros, setFiltros] = useState(filtrosOriginais);
  const [filtrosModificados, setFiltrosModificados] =
    useState(filtrosOriginais);

  //Query despesaS
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["despesas", filtros],
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

  const { data: cartoes, refetch: refetchCartoes } = useQuery({
    queryKey: ["cartoes"],
    queryFn: () => getCartoes({ active: true }),
  });

  const { data: gruposParcelados } = useQuery({
    queryKey: ["despesas", "grupos-parcelados"],
    queryFn: () => getGruposParcelados("EXPENSE"),
    enabled: filtrosModificados.apenas_parceladas,
  });

  //Deletar despesa
  const { mutate } = useMutation({
    mutationFn: (id: number) => deletarDespesa(id),
    onSuccess: () => {
      invalidateFaturas(); // A despesa pode pertencer a uma fatura; refaz o cálculo dela
      refetch(); // Refaz a consulta para atualizar a lista de despesas
    },
    onError: () => {
      toast.error("Erro ao excluir despesa", { message: "Tente novamente." });
    },
  });

  //Deletar múltiplas despesas
  const { mutate: mutateDeletarMultiplas } = useMutation({
    mutationFn: (ids: number[]) => deletarTransacoesMultiplas(ids),
    onSuccess: () => {
      invalidateFaturas();
      selecao.cancelar();
      refetch();
    },
    onError: () => {
      toast.error("Erro ao excluir despesas", { message: "Tente novamente." });
    },
  });

  const { openModal } = useConfirmModalStore();

  const handleProsseguirSelecao = () => {
    const ids = [...selecao.selecionados];

    if (selecao.modo === "editar") {
      navigate(`/despesas/editar-multiplas?ids=${ids.join(",")}`);
    } else if (selecao.modo === "excluir") {
      openModal({
        title: "Confirmar exclusão",
        message: `Tem certeza que deseja excluir ${ids.length} despesa${
          ids.length !== 1 ? "s" : ""
        }? Essa ação não poderá ser desfeita.`,
        callback: () => mutateDeletarMultiplas(ids),
        autoClose: true,
      });
    }
  };

  const handlePageChange = (page: number) => {
    setFiltros((prev) => ({ ...prev, page }));
  };

  const resetarFiltros = () => {
    setFiltros(filtrosOriginais);
    setFiltrosModificados(filtrosOriginais);
  };

  // A busca é aplicada direto (sem o botão Aplicar do dropdown) e mantém o rascunho dos filtros em dia
  const buscarDescricao = (descricao: string) => {
    setFiltros((prev) => ({ ...prev, descricao, page: 1 }));
    setFiltrosModificados((prev) => ({ ...prev, descricao }));
  };

  // Origem é aplicada na hora; limpa o filtro que deixou de fazer sentido (conta x cartão)
  const mudarOrigem = (origem: string) => {
    const novaOrigem = origem as "" | "conta" | "cartao";
    const ajuste = {
      origem: novaOrigem,
      ...(novaOrigem === "conta" ? { cartao_id: undefined } : {}),
      ...(novaOrigem === "cartao" ? { conta_id: undefined } : {}),
    };
    setFiltros((prev) => ({ ...prev, ...ajuste, page: 1 }));
    setFiltrosModificados((prev) => ({ ...prev, ...ajuste }));
  };

  const filtrosAtivos = [
    filtros.categoria_id,
    filtros.conta_id,
    filtros.cartao_id,
    filtros.periodo,
    filtros.campo_data,
    filtros.status,
    filtros.apenas_parceladas,
  ].filter(Boolean).length;

  const aplicarFiltros = () => {
    setFiltros({ ...filtrosModificados, page: 1 });
  };

  //Se falhar mostrar erro e o botão de refetch
  if (isError) {
    return (
      <div>
        <p>Erro ao buscar despesas</p>
        <button className="btn btn-primary" onClick={() => refetch()}>
          Tentar Novamente
        </button>
      </div>
    );
  }

  const despesas = data?.data || [];
  const meta = data?.meta;
  const total = data?.total;
  //Após criar a tabela, verificar como componentizar ela

  // TODO: VER COMO ABSTRAIR ESSA LISTAGEM PARA OUTROS RECURSOS FICAREM MAIS SIMPLES DE FAZER

  return (
    <PageLayout title="Despesas" backTo="/">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/despesas/cadastrar" className="btn btn-success">
              <i className="bi bi-plus-circle me-2"></i>
              Nova Despesa
            </Link>

            <AcoesEmMassa
              modo={selecao.modo}
              quantidade={selecao.quantidade}
              onIniciar={selecao.iniciar}
              onCancelar={selecao.cancelar}
              onProsseguir={handleProsseguirSelecao}
            />
          </Listagem.Acoes>

          <Listagem.Controles>
            <Listagem.Busca
              value={filtros.descricao}
              onChange={buscarDescricao}
              placeholder="Buscar despesa..."
            />

            <Listagem.LimiteSelector
              value={filtros.limit}
              onChange={(limit) => setFiltros((prev) => ({ ...prev, limit }))}
            />

            <Listagem.FiltrosDropdown
              onAplicar={aplicarFiltros}
              onLimpar={resetarFiltros}
              ativos={filtrosAtivos}
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
                  <option value="">Todas as categorias</option>
                  {categorias?.data.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </option>
                  ))}
                </select>
              </div>

              {filtros.origem !== "cartao" && (
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
                  <option value="">Todas as contas</option>
                  {contas?.data.map((conta: Conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.name}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {filtros.origem !== "conta" && (
              <div className="px-3 py-2">
                <label className="form-label small">Cartão:</label>
                <select
                  value={filtrosModificados.cartao_id || ""}
                  onChange={(e) =>
                    setFiltrosModificados({
                      ...filtrosModificados,
                      cartao_id: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  onFocus={() => refetchCartoes()}
                  className="form-select form-select-sm"
                >
                  <option value="">Todos os cartões</option>
                  {cartoes?.data.map((cartao: Cartao) => (
                    <option key={cartao.id} value={cartao.id}>
                      {cartao.name}
                    </option>
                  ))}
                </select>
              </div>
              )}

              <div className="px-3 py-2">
                <label className="form-label small">Situação:</label>
                <SituacaoSelect
                  value={filtrosModificados.status}
                  rotuloConcluidas="pagas"
                  onChange={(status) =>
                    setFiltrosModificados({ ...filtrosModificados, status })
                  }
                />
              </div>

              <div className="px-3 py-2">
                <label className="form-label small">Filtrar pela data de:</label>
                <CampoDataSelect
                  value={filtrosModificados.campo_data}
                  onChange={(campo_data) =>
                    setFiltrosModificados({ ...filtrosModificados, campo_data })
                  }
                />
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
              </div>

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
                    Somente despesas compostas (parceladas)
                  </label>
                </div>

                {filtrosModificados.apenas_parceladas && (
                  <div className="mt-2">
                    <label className="form-label small">Compra parcelada:</label>
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

            <Listagem.OrdenarDropdown>
              {/* ✅ SEUS RADIOS CUSTOMIZADOS */}
              <div className="mb-2">
                <label className="form-label small mb-1">Data usada:</label>
                <CampoDataSelect
                  value={filtros.campo_data}
                  onChange={(campo_data) => {
                    setFiltros((prev) => ({ ...prev, campo_data, page: 1 }));
                    setFiltrosModificados((prev) => ({ ...prev, campo_data }));
                  }}
                />
              </div>
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

        <Listagem.Segmentado
          ariaLabel="Origem da despesa"
          value={filtros.origem}
          onChange={mudarOrigem}
          opcoes={[
            { value: "", label: "Todas", icon: "bi-list-ul" },
            { value: "conta", label: "Contas financeiras", icon: "bi-bank" },
            { value: "cartao", label: "Cartão", icon: "bi-credit-card" },
          ]}
        />

      
        <Listagem.Tabela
          headers={[
            ...(selecao.ativo ? [""] : []),
            "ID",
            "Descrição",
            "Valor",
            "Datas",
            "Conta",
            "Categoria",
            "Status",
            "Parcela",
            "Ações",
          ]}
          footer={
            <div className="d-flex justify-content-between align-items-center bg-light px-4 py-3 border-top">
              <span className="text-muted fw-semibold">
                <i className="bi bi-calculator me-2"></i>
                Total de Despesas
              </span>
              <span className="fs-5 fw-bold text-danger">
                R$ {convertNumberToCurrencyMask(total || 0)}
              </span>
            </div>
          }
          mobile={despesas.map((despesa) => (
            <div key={despesa.id} className="card shadow-sm">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="d-flex gap-2 align-items-start">
                    {selecao.ativo && (
                      <input
                        type="checkbox"
                        className="form-check-input mt-1"
                        checked={selecao.selecionados.has(despesa.id)}
                        onChange={() => selecao.alternar(despesa.id)}
                      />
                    )}
                    <div>
                      <div className="fw-semibold">{despesa.description}</div>
                      <div className="small text-muted">
                        #{despesa.id} · {despesa.conta?.name || "-"}
                      </div>
                  {despesa.cartao && (
                    <div className="small text-muted">
                      <i className="bi bi-credit-card me-1"></i>
                      {despesa.cartao.name}
                    </div>
                  )}
                    </div>
                  </div>
                  <div className="text-end text-danger fw-bold text-nowrap">
                    {despesa.amount !== null ? (
                      `R$ ${convertNumberToCurrencyMask(despesa.amount)}`
                    ) : (
                      <span className="text-muted fw-normal">A definir</span>
                    )}
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-1 mt-2">
                  {despesa.status === "PAID" ? (
                    <span className="badge text-bg-success">PAGO</span>
                  ) : (
                    <span className="badge text-bg-secondary">PENDENTE</span>
                  )}
                  {despesa.categoria && (
                    <span className="badge text-bg-secondary">
                      {despesa.categoria.name}
                    </span>
                  )}
                  {despesa.is_installment && (
                    <span className="badge text-bg-info">
                      {despesa.installment_number}/{despesa.installment_total}
                    </span>
                  )}
                  {despesa.is_recurring && (
                    <Link
                      to={`/recorrencias/editar/${despesa.recurring_transaction_id}`}
                      className="badge text-bg-light border text-decoration-none"
                    >
                      <i className="bi bi-arrow-repeat"></i> Recorrente
                    </Link>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-end mt-2">
                  <DatasTransacao
                    transacao={despesa}
                    campoAtivo={filtros.campo_data || "date"}
                    mostrarVencimento={true}
                  />
                  <div className="d-flex gap-2">
                    <Link
                      to={`/despesas/editar/${despesa.id}`}
                      className="btn btn-sm btn-secondary"
                    >
                      <i className="bi bi-pencil"></i>
                    </Link>
                    <button
                      onClick={() =>
                        openModal({
                          callback: () => mutate(despesa.id),
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
                </div>
              </div>
            </div>
          ))}
          loading={isLoading || isFetching}
          emptyMessage={
            filtros.origem === "cartao"
              ? "Nenhuma despesa de cartão encontrada"
              : filtros.origem === "conta"
                ? "Nenhuma despesa em contas financeiras encontrada"
                : "Nenhuma despesa encontrada"
          }
        >
          {despesas.map((despesa) => (
            <tr key={despesa.id}>
              {selecao.ativo && (
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selecao.selecionados.has(despesa.id)}
                    onChange={() => selecao.alternar(despesa.id)}
                  />
                </td>
              )}
              <td>{despesa.id}</td>
              <td>
                {despesa.description}
                {despesa.is_recurring && (
                  <Link
                    to={`/recorrencias/editar/${despesa.recurring_transaction_id}`}
                    className="badge text-bg-light border ms-2 text-decoration-none"
                    title="Veio de uma recorrência — clique para ver/editar a regra"
                  >
                    <i className="bi bi-arrow-repeat"></i> Recorrente
                  </Link>
                )}
              </td>
              <td className="text-danger fw-bold">
                {despesa.amount !== null ? (
                  `R$ ${convertNumberToCurrencyMask(despesa.amount)}`
                ) : (
                  <span className="text-muted fw-normal">A definir</span>
                )}
              </td>
              <td>
                <DatasTransacao
                  transacao={despesa}
                  campoAtivo={filtros.campo_data || "date"}
                  mostrarVencimento={true}
                />
              </td>
              <td>
                {despesa.conta?.name || "-"}
                {despesa.cartao && (
                  <>
                    <br />
                    <small className="text-muted">
                      <i className="bi bi-credit-card me-1"></i>
                      {despesa.cartao.name}
                    </small>
                  </>
                )}
              </td>
              <td>
                {despesa.categoria ? (
                  <span className="badge text-bg-secondary">
                    {despesa.categoria.name}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td>
                {despesa.status === "PAID" ? (
                  <span className="badge text-bg-success">PAGO</span>
                ) : (
                  <span className="badge text-bg-secondary">PENDENTE</span>
                )}
              </td>
              <td>
                {despesa.is_installment && despesa.installment_group ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-info d-flex flex-column align-items-start py-1 px-2"
                    title={`Ver todas as parcelas do grupo ${despesa.installment_group}`}
                    onClick={() => {
                      setFiltrosModificados({
                        ...filtrosModificados,
                        apenas_parceladas: true,
                        installment_group: despesa.installment_group as string,
                      });
                      setFiltros({
                        ...filtros,
                        apenas_parceladas: true,
                        installment_group: despesa.installment_group as string,
                        page: 1,
                      });
                    }}
                  >
                    <span className="badge text-bg-info">
                      {despesa.installment_number}/{despesa.installment_total}
                    </span>
                    <small className="text-muted" style={{ fontSize: "0.65rem" }}>
                      {despesa.installment_group.slice(0, 8)}
                    </small>
                  </button>
                ) : (
                  "-"
                )}
              </td>

              <td>
                <div className="d-flex gap-2">
                  <Link
                    to={`/despesas/editar/${despesa.id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    <i className="bi bi-pencil"></i>
                  </Link>
                  <button
                    onClick={() =>
                      openModal({
                        callback: () => mutate(despesa.id),
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
