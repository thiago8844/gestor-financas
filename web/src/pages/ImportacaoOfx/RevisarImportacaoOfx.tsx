import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";
import {
  atualizarItemOfx,
  atualizarItensOfxEmMassa,
  confirmarImportacaoOfx,
  getImportacaoOfx,
} from "../../api/ofxImportacoes";
import { convertNumberToCurrencyMask } from "../../utils";
import { ItemOfxRow } from "./ItemOfxRow";
import { RegraOfxModal } from "./RegraOfxModal";
import type { OfxImportItem } from "../../types/ofx";
import type { Conta } from "../../types";

const FILTROS = ["todas", "pendentes", "duplicadas", "nao_selecionadas"] as const;
type Filtro = (typeof FILTROS)[number];

const LABEL_FILTRO: Record<Filtro, string> = {
  todas: "Todas",
  pendentes: "Pendentes",
  duplicadas: "Duplicadas",
  nao_selecionadas: "Não selecionadas",
};

export function RevisarImportacaoOfx() {
  const { id } = useParams();
  const importacaoId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { contas, categorias, orcamentos } = useFormularioTransacao();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["importacao-ofx", importacaoId],
    queryFn: () => getImportacaoOfx(importacaoId),
    enabled: !!importacaoId,
  });

  const [tab, setTab] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [modoBulk, setModoBulk] = useState(false);
  const [bulkSelecionados, setBulkSelecionados] = useState<Set<number>>(new Set());
  const [regraModalItem, setRegraModalItem] = useState<OfxImportItem | null>(null);
  const [bulkCategoria, setBulkCategoria] = useState("");
  const [bulkOrcamento, setBulkOrcamento] = useState("");
  const [bulkConta, setBulkConta] = useState("");

  const importacao = data?.data;

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["importacao-ofx", importacaoId] });

  const { mutate: atualizarItem } = useMutation({
    mutationFn: ({ itemId, dados }: { itemId: number; dados: Record<string, unknown> }) =>
      atualizarItemOfx(importacaoId, itemId, dados),
    onSuccess: invalidar,
    onError: () => alert("Erro ao salvar alteração. Tente novamente."),
  });

  const { mutate: atualizarEmMassa, isPending: salvandoEmMassa } = useMutation({
    mutationFn: (dados: Record<string, unknown>) => atualizarItensOfxEmMassa(importacaoId, dados),
    onSuccess: () => {
      invalidar();
      setModoBulk(false);
      setBulkSelecionados(new Set());
      setBulkCategoria("");
      setBulkOrcamento("");
      setBulkConta("");
    },
    onError: () => alert("Erro ao aplicar alteração em massa. Tente novamente."),
  });

  const { mutate: confirmar, isPending: confirmando } = useMutation({
    mutationFn: (ids: number[]) => confirmarImportacaoOfx(importacaoId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["importacoes-ofx"] });
      alert("Importação confirmada com sucesso!");
      navigate("/importacoes-ofx");
    },
    onError: () => alert("Erro ao confirmar importação. Tente novamente."),
  });

  if (isError) {
    return (
      <PageLayout title="Revisar Importação" backTo="/importacoes-ofx">
        <div className="alert alert-danger">Erro ao carregar a importação.</div>
      </PageLayout>
    );
  }

  if (isLoading || !importacao) {
    return (
      <PageLayout title="Revisar Importação" backTo="/importacoes-ofx" loading>
        <></>
      </PageLayout>
    );
  }

  if (importacao.status !== "STAGED") {
    return (
      <PageLayout title="Revisar Importação" backTo="/importacoes-ofx">
        <div className="alert alert-info">
          Esta importação já foi {importacao.status === "CONFIRMED" ? "confirmada" : "desfeita"}. Consulte
          o histórico de importações.
        </div>
      </PageLayout>
    );
  }

  const itensDaAba = importacao.itens.filter((item) => item.type === tab);

  const itensFiltrados = itensDaAba.filter((item) => {
    switch (filtro) {
      case "pendentes":
        return item.status === "PENDENTE";
      case "duplicadas":
        return item.status === "DUPLICADA";
      case "nao_selecionadas":
        return item.status === "PENDENTE" && !item.selecionada;
      default:
        return true;
    }
  });

  const toggleExpand = (itemId: number) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(itemId)) {
        novo.delete(itemId);
      } else {
        novo.add(itemId);
      }
      return novo;
    });
  };

  const toggleBulk = (itemId: number) => {
    setBulkSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(itemId)) {
        novo.delete(itemId);
      } else {
        novo.add(itemId);
      }
      return novo;
    });
  };

  const aplicarBulk = () => {
    const dados: Record<string, unknown> = { ids: [...bulkSelecionados] };
    if (bulkConta) dados.account_id = Number(bulkConta);
    if (bulkCategoria) dados.category_id = Number(bulkCategoria);
    if (bulkOrcamento) dados.budget_id = Number(bulkOrcamento);

    if (Object.keys(dados).length === 1) {
      alert("Selecione ao menos uma alteração para aplicar (conta, categoria ou orçamento).");
      return;
    }

    atualizarEmMassa(dados);
  };

  const selecionadosParaImportar = importacao.itens.filter(
    (item) => item.status === "PENDENTE" && item.selecionada
  );
  const totalReceitasSelecionadas = selecionadosParaImportar
    .filter((i) => i.type === "INCOME")
    .reduce((soma, i) => soma + i.amount, 0);
  const totalDespesasSelecionadas = selecionadosParaImportar
    .filter((i) => i.type === "EXPENSE")
    .reduce((soma, i) => soma + i.amount, 0);

  const pendentesCount = importacao.itens.filter((i) => i.status === "PENDENTE").length;
  const duplicadasCount = importacao.itens.filter((i) => i.status === "DUPLICADA").length;
  const receitasCount = importacao.itens.filter((i) => i.type === "INCOME").length;
  const despesasCount = importacao.itens.filter((i) => i.type === "EXPENSE").length;

  return (
    <PageLayout title={`Revisar Importação — ${importacao.original_filename}`} backTo="/importacoes-ofx">
      <div className="mb-3 d-flex gap-2">
        <button
          type="button"
          className={`btn ${tab === "EXPENSE" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setTab("EXPENSE")}
        >
          Despesas ({despesasCount})
        </button>
        <button
          type="button"
          className={`btn ${tab === "INCOME" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setTab("INCOME")}
        >
          Receitas ({receitasCount})
        </button>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="btn-group">
          {FILTROS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              className={`btn btn-sm ${filtro === opcao ? "btn-secondary" : "btn-outline-secondary"}`}
              onClick={() => setFiltro(opcao)}
            >
              {LABEL_FILTRO[opcao]}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => {
            setModoBulk((prev) => !prev);
            setBulkSelecionados(new Set());
          }}
        >
          <i className="bi bi-list-check me-1"></i>
          {modoBulk ? "Cancelar edição em massa" : "Editar em massa"}
        </button>
      </div>

      {modoBulk && (
        <div className="card mb-3">
          <div className="card-body d-flex flex-wrap gap-3 align-items-end">
            <span className="text-muted small">{bulkSelecionados.size} selecionada(s)</span>

            <div>
              <label className="form-label small mb-0">Conta</label>
              <select
                className="form-select form-select-sm"
                value={bulkConta}
                onChange={(e) => setBulkConta(e.target.value)}
              >
                <option value="">Não alterar</option>
                {contas.map((conta: Conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label small mb-0">Categoria</label>
              <select
                className="form-select form-select-sm"
                value={bulkCategoria}
                onChange={(e) => setBulkCategoria(e.target.value)}
              >
                <option value="">Não alterar</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label small mb-0">Orçamento</label>
              <select
                className="form-select form-select-sm"
                value={bulkOrcamento}
                onChange={(e) => setBulkOrcamento(e.target.value)}
              >
                <option value="">Não alterar</option>
                {orcamentos.map((orcamento) => (
                  <option key={orcamento.id} value={orcamento.id}>
                    {orcamento.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={bulkSelecionados.size === 0 || salvandoEmMassa}
              onClick={aplicarBulk}
            >
              Aplicar às {bulkSelecionados.size} selecionadas
            </button>
          </div>
        </div>
      )}

      <div className="table-responsive shadow-sm rounded">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Data</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {itensFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-5 text-muted">
                  Nenhuma transação encontrada com este filtro.
                </td>
              </tr>
            )}
            {itensFiltrados.map((item) => (
              <ItemOfxRow
                key={item.id}
                item={item}
                expanded={expandidos.has(item.id)}
                onToggleExpand={() => toggleExpand(item.id)}
                contas={contas}
                categorias={categorias}
                orcamentos={orcamentos}
                onUpdate={(dados) => atualizarItem({ itemId: item.id, dados })}
                onToggleSelecionada={() =>
                  atualizarItem({ itemId: item.id, dados: { selecionada: !item.selecionada } })
                }
                onCriarRegra={() => setRegraModalItem(item)}
                bulkMode={modoBulk}
                bulkSelected={bulkSelecionados.has(item.id)}
                onToggleBulk={() => toggleBulk(item.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Espaço para a barra fixa não sobrepor as últimas linhas da tabela */}
      <div style={{ height: 110 }}></div>

      <div
        className="position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg py-3 px-4"
        style={{ zIndex: 1030 }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex gap-4 flex-wrap">
            <span>
              <strong>{selecionadosParaImportar.length}</strong> selecionada(s)
            </span>
            <span className="text-success">
              Receitas: R$ {convertNumberToCurrencyMask(totalReceitasSelecionadas)}
            </span>
            <span className="text-danger">
              Despesas: R$ {convertNumberToCurrencyMask(totalDespesasSelecionadas)}
            </span>
            <span className="text-muted">
              Pendentes: {pendentesCount} · Duplicadas: {duplicadasCount}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-success"
            disabled={confirmando || selecionadosParaImportar.length === 0}
            onClick={() => confirmar(selecionadosParaImportar.map((i) => i.id))}
          >
            {confirmando ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Importando...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                Importar {selecionadosParaImportar.length} transações
              </>
            )}
          </button>
        </div>
      </div>

      {regraModalItem && (
        <RegraOfxModal
          show={!!regraModalItem}
          onClose={() => setRegraModalItem(null)}
          ofxImportId={importacao.id}
          categorias={categorias}
          orcamentos={orcamentos}
          valoresIniciais={{
            descricao_contains: regraModalItem.descricao_original,
            tipo: regraModalItem.type,
            descricao: regraModalItem.descricao ?? undefined,
            category_id: regraModalItem.category_id ?? undefined,
            budget_id: regraModalItem.budget_id ?? undefined,
          }}
        />
      )}
    </PageLayout>
  );
}
