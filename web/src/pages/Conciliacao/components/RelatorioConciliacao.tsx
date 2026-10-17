import type { RefObject } from "react";
import { RelatorioImprimivel } from "../../../components/Relatorio/RelatorioImprimivel";
import type { RevisaoConciliacao } from "../../../types/conciliacao";
import { STATUS_ITEM_LABEL, dataBr, mesAno, moeda, valorExtrato } from "../conciliacaoUtils";

type Props = {
  revisao: RevisaoConciliacao;
  contentRef: RefObject<HTMLDivElement | null>;
  titulo: string;
};

/** PDF da auditoria do mês: o retrato da conciliação, linha a linha, com o que foi decidido. */
export function RelatorioConciliacao({ revisao, contentRef, titulo }: Props) {
  const { conciliacao, resumo, saldo, itens, so_no_app } = revisao;

  const resolucao = (i: RevisaoConciliacao["itens"][number]) => {
    if (i.status === "CONCILIADO") {
      if (i.fatura) return `Pagamento da fatura ${i.fatura.cartao} ${mesAno(i.fatura.reference_month)}`;
      return i.lancamentos.map((l) => l.description).join(", ");
    }

    return i.note ?? "-";
  };

  return (
    <RelatorioImprimivel
      contentRef={contentRef}
      titulo={titulo}
      filtrosTexto={`Período ${dataBr(conciliacao.period_start)} a ${dataBr(conciliacao.period_end)} · Extrato: ${conciliacao.original_filename ?? "-"} · Situação: ${conciliacao.status === "FINALIZADA" ? `finalizada em ${conciliacao.finalized_at ? new Date(conciliacao.finalized_at.replace(" ", "T")).toLocaleString("pt-BR") : "-"}` : "em aberto"}`}
      resumo={
        <div className="d-flex flex-wrap gap-4 small">
          <span>Linhas do extrato: <strong>{resumo.linhas}</strong></span>
          <span>Conferidas: <strong>{resumo.conciliadas}</strong> ({resumo.conciliadas_auto} automáticas)</span>
          <span>Ignoradas: <strong>{resumo.ignoradas}</strong></span>
          <span>Pendentes/adiadas: <strong>{resumo.pendentes + resumo.adiadas}</strong></span>
          <span>Só no app: <strong>{resumo.so_no_app}</strong> pendentes, {resumo.mantidos_so_no_app} confirmados</span>
          <span>Entradas: <strong>{moeda(resumo.entradas)}</strong></span>
          <span>Saídas: <strong>{moeda(resumo.saidas)}</strong></span>
          {saldo.banco !== null && <span>Saldo banco ({dataBr(saldo.data)}): <strong>{moeda(saldo.banco)}</strong></span>}
          <span>Saldo app ({dataBr(saldo.data)}): <strong>{moeda(saldo.app)}</strong></span>
          {saldo.diferenca !== null && <span>Diferença: <strong>{moeda(saldo.diferenca)}</strong></span>}
          {conciliacao.note && <span>Observação: <strong>{conciliacao.note}</strong></span>}
        </div>
      }
      tabelas={
        <>
          <table className="table table-sm">
            <thead className="table-light">
              <tr>
                <th>Data</th>
                <th>Descrição (extrato)</th>
                <th className="text-end">Valor</th>
                <th>Situação</th>
                <th>Conferido com / motivo</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const v = valorExtrato(i.type, i.amount);

                return (
                  <tr key={i.id}>
                    <td className="text-nowrap">{dataBr(i.transaction_date)}</td>
                    <td>
                      {i.source === "APP" && "[só no app] "}
                      {i.description}
                    </td>
                    <td className="text-end text-nowrap">{v.texto}</td>
                    <td>
                      {i.source === "APP" ? "Confirmado" : STATUS_ITEM_LABEL[i.status]}
                      {i.matched_by === "AUTO" && " (auto)"}
                    </td>
                    <td>{resolucao(i)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {so_no_app.length > 0 && (
            <>
              <h6 className="fw-bold mt-4">Pagos no app sem linha no extrato (sem decisão)</h6>
              <table className="table table-sm">
                <tbody>
                  {so_no_app.map((e) => (
                    <tr key={e.chave}>
                      <td className="text-nowrap">{dataBr(e.date)}</td>
                      <td>{e.description}</td>
                      <td className="text-end text-nowrap">{valorExtrato(e.type, e.amount).texto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      }
    />
  );
}
