import { OverlayTrigger, Popover } from "react-bootstrap";
import { brl, formatarDiaMes, nomeMes } from "./formatadores";
import type { MesProjecao } from "../../../types/relatorio";

const EXPLICACAO_MENOR_SALDO = (
  <Popover id="explicacao-menor-saldo">
    <Popover.Header as="h6">Menor saldo</Popover.Header>
    <Popover.Body className="small">
      É o menor saldo que as contas selecionadas chegam a ter durante o mês, medido ao fim de cada dia com
      movimentação. Começa no saldo inicial do mês, então nunca é maior que ele. Entradas e saídas do mesmo
      dia se compensam antes de medir.
    </Popover.Body>
  </Popover>
);

type Props = {
  meses: MesProjecao[];
  saldoAtual: number;
};

export function TabelaResumoMensal({ meses, saldoAtual }: Props) {
  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <h6 className="fw-bold mb-3">
          <i className="bi bi-table me-2 text-primary"></i>
          Resumo mensal
        </h6>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Mês</th>
                <th className="text-end">Saldo inicial</th>
                <th className="text-end">Entradas</th>
                <th className="text-end">Saídas</th>
                <th className="text-end">Resultado</th>
                <th className="text-end">Saldo final</th>
                <th className="text-end text-nowrap">
                  Menor saldo
                  <OverlayTrigger trigger={["hover", "focus"]} placement="top" overlay={EXPLICACAO_MENOR_SALDO}>
                    <button
                      type="button"
                      className="btn btn-link p-0 ms-1 align-baseline text-muted"
                      aria-label="O que é o menor saldo"
                    >
                      <i className="bi bi-info-circle"></i>
                    </button>
                  </OverlayTrigger>
                </th>
              </tr>
            </thead>
            <tbody>
              {meses.map((mes, i) => {
                const saldoInicial = i === 0 ? saldoAtual : meses[i - 1].saldo_final;
                const negativo = mes.saldo_final < 0;
                const minimoNegativo = mes.saldo_minimo < 0;

                return (
                  <tr key={mes.mes}>
                    <td className="fw-semibold text-nowrap">
                      {nomeMes(mes.mes)}
                      {i === 0 && <span className="text-muted small fw-normal ms-2">(restante)</span>}
                      {mes.sem_valor > 0 && (
                        <span className="badge text-bg-light border ms-2" title="Lançamentos sem valor definido">
                          {mes.sem_valor} sem valor
                        </span>
                      )}
                    </td>
                    <td className="text-end text-muted text-nowrap">{brl(saldoInicial)}</td>
                    <td className="text-end text-success text-nowrap">
                      {brl(mes.entradas)}
                      {mes.entradas_estimadas > 0 && <span className="text-muted" title="Inclui valores estimados"> ≈</span>}
                    </td>
                    <td className="text-end text-danger text-nowrap">
                      {brl(mes.saidas)}
                      {mes.saidas_estimadas > 0 && <span className="text-muted" title="Inclui valores estimados"> ≈</span>}
                    </td>
                    <td className={`text-end text-nowrap ${mes.resultado < 0 ? "text-danger" : ""}`}>
                      {mes.resultado >= 0 ? "+ " : ""}
                      {brl(mes.resultado)}
                    </td>
                    <td className={`text-end fw-semibold text-nowrap ${negativo ? "text-danger" : ""}`}>
                      {negativo && <i className="bi bi-exclamation-triangle-fill me-1"></i>}
                      {brl(mes.saldo_final)}
                    </td>
                    <td className={`text-end text-nowrap small ${minimoNegativo ? "text-danger" : "text-muted"}`}>
                      {brl(mes.saldo_minimo)}
                      {/* A data só importa quando o fundo do poço foi dentro do mês, não o saldo de abertura. */}
                      {minimoNegativo && mes.data_saldo_minimo && mes.saldo_minimo < saldoInicial && (
                        <div>em {formatarDiaMes(mes.data_saldo_minimo)}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
