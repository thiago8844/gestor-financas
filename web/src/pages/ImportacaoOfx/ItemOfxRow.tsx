import { useState } from "react";
import { convertNumberToCurrencyMask } from "../../utils";
import type { Categoria } from "../../api/categoria";
import type { Orcamento } from "../../types/orcamento";
import type { Conta } from "../../types";
import type { OfxImportItem } from "../../types/ofx";

type Props = {
  item: OfxImportItem;
  expanded: boolean;
  onToggleExpand: () => void;
  contas: Conta[];
  categorias: Categoria[];
  orcamentos: Orcamento[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate: (dados: Record<string, any>) => void;
  onToggleSelecionada: () => void;
  onCriarRegra: () => void;
  bulkMode: boolean;
  bulkSelected: boolean;
  onToggleBulk: () => void;
};

export function ItemOfxRow({
  item,
  expanded,
  onToggleExpand,
  contas,
  categorias,
  orcamentos,
  onUpdate,
  onToggleSelecionada,
  onCriarRegra,
  bulkMode,
  bulkSelected,
  onToggleBulk,
}: Props) {
  const podeEditar = item.status === "PENDENTE";
  const [descricao, setDescricao] = useState(item.descricao ?? item.descricao_original);

  const corValor = item.type === "EXPENSE" ? "text-danger" : "text-success";
  const sinal = item.type === "EXPENSE" ? "-" : "+";

  return (
    <>
      <tr className={item.status === "DUPLICADA" ? "opacity-50" : ""}>
        <td>
          {bulkMode ? (
            <input
              type="checkbox"
              className="form-check-input"
              disabled={!podeEditar}
              checked={bulkSelected}
              onChange={onToggleBulk}
            />
          ) : (
            <input
              type="checkbox"
              className="form-check-input"
              disabled={!podeEditar}
              checked={item.selecionada}
              onChange={onToggleSelecionada}
              title={podeEditar ? "Importar esta transação" : "Já importada anteriormente (duplicada)"}
            />
          )}
        </td>
        <td>{item.transaction_date.split("-").reverse().join("/")}</td>
        <td>
          {item.descricao || item.descricao_original}
          {item.editada && (
            <span
              className="badge text-bg-light border ms-2"
              title={`Original: ${item.descricao_original}`}
            >
              editado
            </span>
          )}
          {item.status === "DUPLICADA" && <span className="badge text-bg-secondary ms-2">duplicada</span>}
          {item.regra_aplicada_id && (
            <span className="badge text-bg-info ms-2" title="Preenchido automaticamente por uma regra">
              regra aplicada
            </span>
          )}
        </td>
        <td className={`fw-bold ${corValor}`}>
          {sinal} R$ {convertNumberToCurrencyMask(item.amount)}
        </td>
        <td>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onToggleExpand}>
            <i className={`bi bi-chevron-${expanded ? "up" : "down"}`}></i>
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={5} className="bg-light">
            <div className="row g-3 py-2">
              <div className="col-12">
                <label className="form-label small text-muted">Descrição original do OFX</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={item.descricao_original}
                  disabled
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small">Descrição no app</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={descricao}
                  disabled={!podeEditar}
                  onChange={(e) => setDescricao(e.target.value)}
                  onBlur={() =>
                    descricao !== (item.descricao ?? item.descricao_original) && onUpdate({ descricao })
                  }
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small">Conta</label>
                <select
                  className="form-select form-select-sm"
                  value={item.account_id ?? ""}
                  disabled={!podeEditar}
                  onChange={(e) => onUpdate({ account_id: e.target.value ? Number(e.target.value) : null })}
                >
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small">Categoria</label>
                <select
                  className="form-select form-select-sm"
                  value={item.category_id ?? ""}
                  disabled={!podeEditar}
                  onChange={(e) => onUpdate({ category_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Sem categoria</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small">Orçamento</label>
                <select
                  className="form-select form-select-sm"
                  value={item.budget_id ?? ""}
                  disabled={!podeEditar}
                  onChange={(e) => onUpdate({ budget_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Sem orçamento</option>
                  {orcamentos.map((orcamento) => (
                    <option key={orcamento.id} value={orcamento.id}>
                      {orcamento.name}
                    </option>
                  ))}
                </select>
              </div>

              {podeEditar && (
                <div className="col-12 text-end">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={onCriarRegra}>
                    <i className="bi bi-magic me-1"></i>
                    Criar regra
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
