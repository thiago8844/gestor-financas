import { Fragment, useState } from "react";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { LinhaCategoriaResultado } from "../../../types/relatorio";
import type { Transacao } from "../../../types/transacao";

type Props = {
  receitas: LinhaCategoriaResultado[];
  despesas: LinhaCategoriaResultado[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  onSelecionarTransacao: (transacao: Transacao) => void;
};

function VariacaoBadge({ variacao }: { variacao: number | null }) {
  if (variacao === null) return <span className="text-muted">-</span>;

  return (
    <span className={variacao >= 0 ? "text-danger" : "text-success"}>
      <i className={`bi bi-arrow-${variacao >= 0 ? "up" : "down"} me-1`}></i>
      {Math.abs(variacao)}%
    </span>
  );
}

function Secao({
  titulo,
  total,
  linhas,
  expandidos,
  onToggle,
  onSelecionarTransacao,
}: {
  titulo: string;
  total: number;
  linhas: LinhaCategoriaResultado[];
  expandidos: Set<string>;
  onToggle: (chave: string) => void;
  onSelecionarTransacao: (transacao: Transacao) => void;
}) {
  return (
    <>
      <tr className="table-light">
        <td colSpan={2} className="fw-bold text-uppercase">
          {titulo}
        </td>
        <td className="fw-bold">{convertNumberToCurrencyMask(total)}</td>
        <td colSpan={3}></td>
      </tr>

      {linhas.length === 0 && (
        <tr>
          <td colSpan={6} className="text-muted text-center py-3">
            Nenhum lançamento.
          </td>
        </tr>
      )}

      {linhas.map((linha) => {
        const chave = `${titulo}-${linha.categoria_id ?? "sem-categoria"}`;
        const expandido = expandidos.has(chave);

        return (
          <Fragment key={chave}>
            <tr role="button" onClick={() => onToggle(chave)}>
              <td style={{ width: 30 }}>
                <i className={`bi bi-chevron-${expandido ? "down" : "right"}`}></i>
              </td>
              <td>{linha.categoria}</td>
              <td>{convertNumberToCurrencyMask(linha.total)}</td>
              <td>{linha.percentual !== null ? `${linha.percentual}%` : "-"}</td>
              <td>{linha.periodo_anterior !== null ? convertNumberToCurrencyMask(linha.periodo_anterior) : "-"}</td>
              <td>
                <VariacaoBadge variacao={linha.variacao_percentual} />
              </td>
            </tr>

            {expandido && (
              <tr>
                <td colSpan={6} className="bg-light">
                  <div className="py-2 px-4">
                    {linha.transacoes.map((transacao) => (
                      <div
                        key={transacao.id}
                        role="button"
                        className="d-flex justify-content-between py-1 border-bottom"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelecionarTransacao(transacao);
                        }}
                      >
                        <span>
                          {transacao.description || "Sem descrição"}{" "}
                          <span className="text-muted small">({transacao.date})</span>
                        </span>
                        <span>{convertNumberToCurrencyMask(transacao.amount ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

export function TabelaResultadoFinanceiro({
  receitas,
  despesas,
  totalReceitas,
  totalDespesas,
  resultado,
  onSelecionarTransacao,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggle = (chave: string) => {
    setExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
  };

  return (
    <div className="table-responsive shadow-sm rounded">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th></th>
            <th>Categoria</th>
            <th>Valor</th>
            <th>%</th>
            <th>Período anterior</th>
            <th>Variação</th>
          </tr>
        </thead>
        <tbody>
          <Secao
            titulo="Receitas"
            total={totalReceitas}
            linhas={receitas}
            expandidos={expandidos}
            onToggle={toggle}
            onSelecionarTransacao={onSelecionarTransacao}
          />
          <Secao
            titulo="Despesas"
            total={totalDespesas}
            linhas={despesas}
            expandidos={expandidos}
            onToggle={toggle}
            onSelecionarTransacao={onSelecionarTransacao}
          />
          <tr className="table-light">
            <td colSpan={2} className="fw-bold text-uppercase">
              Resultado
            </td>
            <td className={`fw-bold ${resultado >= 0 ? "text-success" : "text-danger"}`}>
              {convertNumberToCurrencyMask(resultado)}
            </td>
            <td colSpan={3}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
