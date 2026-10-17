import { brl, formatarDataBR } from "../CompromissosFuturos/formatadores";
import { NATUREZA, SITUACAO } from "./constantes";
import type { LancamentoGasto } from "../../../types/relatorio";

type Props = {
  lancamentos: LancamentoGasto[];
  /** Esconde a coluna de categoria quando a lista já está dentro de uma categoria. */
  semCategoria?: boolean;
};

/** Lista de gastos com natureza, situação e meio de pagamento — usada na aba Lançamentos e dentro das categorias. */
export function TabelaLancamentosGastos({ lancamentos, semCategoria }: Props) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0 bg-white">
        <thead className="table-light">
          <tr className="small">
            <th>Data</th>
            <th>Descrição</th>
            {!semCategoria && <th>Categoria</th>}
            <th>Tipo</th>
            <th>Meio</th>
            <th>Situação</th>
            <th className="text-end">Valor</th>
          </tr>
        </thead>
        <tbody>
          {lancamentos.map((l, i) => (
            <tr key={`${l.id ?? "prev"}-${i}`}>
              <td className="text-nowrap">
                {formatarDataBR(l.data)}
                {l.data_gasto !== l.data_pagamento && (
                  <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                    {l.data === l.data_gasto ? `paga em ${formatarDataBR(l.data_pagamento)}` : `compra em ${formatarDataBR(l.data_gasto)}`}
                  </div>
                )}
              </td>
              <td>
                {l.descricao}
                {l.parcela && <span className="text-muted ms-2">{l.parcela}</span>}
                {l.estimado && <span className="badge text-bg-info-subtle text-info-emphasis border border-info-subtle ms-2">Estimado</span>}
              </td>
              {!semCategoria && <td>{l.categoria}</td>}
              <td className="text-nowrap small">
                <i className={`bi ${NATUREZA[l.natureza].icone} me-1`} style={{ color: NATUREZA[l.natureza].cor }}></i>
                {NATUREZA[l.natureza].singular}
              </td>
              <td className="text-nowrap small">
                <i className={`bi ${l.cartao ? "bi-credit-card" : "bi-wallet2"} me-1`}></i>
                {l.cartao ?? l.conta ?? "Conta"}
              </td>
              <td>
                <span className={`badge ${SITUACAO[l.situacao].classe}`}>{SITUACAO[l.situacao].rotulo}</span>
              </td>
              <td className="text-end text-nowrap">{l.valor === null ? <span className="text-muted">sem valor</span> : brl(l.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
