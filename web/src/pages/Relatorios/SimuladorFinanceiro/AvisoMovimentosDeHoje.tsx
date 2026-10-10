import { useState } from "react";
import type { RelatorioSimulador } from "../../../types/simulador";
import { BadgeNatureza } from "./ui";
import { brl, brlSinal, formatarDataBR } from "./utils";

/**
 * Explica o "degrau" no começo do gráfico: lançamentos vencidos e ainda pendentes (ou ocorrências de
 * recorrência que já deveriam ter sido geradas) não estão no saldo atual, então a simulação considera
 * que acontecem hoje. Sem este aviso parece que o dinheiro surgiu do nada.
 */
export function AvisoMovimentosDeHoje({ relatorio, onVerDetalhes }: { relatorio: RelatorioSimulador; onVerDetalhes: () => void }) {
  const [aberto, setAberto] = useState(false);
  const hoje = relatorio.periodo.data_inicial;
  const deHoje = relatorio.eventos.filter((e) => e.data === hoje && e.valor !== null);
  const vencidos = deHoje.filter((e) => e.atrasado);

  if (vencidos.length === 0) return null;

  const liquido = deHoje.reduce((s, e) => s + (e.tipo === "INCOME" ? e.valor! : -e.valor!), 0);
  const aReceber = vencidos.filter((e) => e.tipo === "INCOME").reduce((s, e) => s + e.valor!, 0);
  const aPagar = vencidos.filter((e) => e.tipo === "EXPENSE").reduce((s, e) => s + e.valor!, 0);
  const temRecorrencia = vencidos.some((e) => e.natureza === "RECORRENCIA" || (e.natureza === "ESTIMADO" && e.recorrencia_id));

  return (
    <div className="alert alert-info small py-2">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span>
          <i className="bi bi-info-circle-fill me-1"></i>
          <strong>
            {vencidos.length} {vencidos.length === 1 ? "lançamento vencido ainda não aconteceu" : "lançamentos vencidos ainda não aconteceram"} no sistema
          </strong>
          {aReceber > 0 && <> · {brl(aReceber)} a receber</>}
          {aPagar > 0 && <> · {brl(aPagar)} a pagar</>}. A simulação considera que acontecem hoje — por isso o saldo vai de{" "}
          {brl(relatorio.cenarios.personalizado.resumo.saldo_atual)} para {brl(relatorio.cenarios.personalizado.resumo.saldo_atual + liquido)} logo no início do gráfico.
        </span>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Ocultar" : "Ver o que entra hoje"}
        </button>
      </div>

      {aberto && (
        <div className="mt-2">
          <ul className="list-unstyled mb-2">
            {deHoje.map((e) => (
              <li key={e.id} className="d-flex flex-wrap justify-content-between gap-2 py-1 border-bottom">
                <span>
                  <BadgeNatureza natureza={e.natureza} /> <span className="ms-1">{e.descricao}</span>
                  {e.atrasado && e.data_original ? (
                    <span className="text-danger ms-2">venceu em {formatarDataBR(e.data_original)}</span>
                  ) : (
                    <span className="text-muted ms-2">vence hoje</span>
                  )}
                </span>
                <span className={e.tipo === "INCOME" ? "text-success" : "text-danger"}>{brlSinal(e.tipo === "INCOME" ? e.valor! : -e.valor!)}</span>
              </li>
            ))}
          </ul>
          <p className="mb-1">
            Enquanto o lançamento não existir (ou estiver pendente), o saldo atual não inclui esse valor. Se ele já aconteceu de verdade,
            registre-o como pago/recebido e o degrau desaparece.
          </p>
          {temRecorrencia && (
            <p className="mb-1">
              Há recorrências com data anterior a hoje que ainda não geraram o lançamento — normalmente isso é feito todo dia pelo sistema.
              Desligar as estimativas não muda isso: recorrência cadastrada é compromisso conhecido, não previsão.
            </p>
          )}
          <button type="button" className="btn btn-sm btn-link p-0" onClick={onVerDetalhes}>
            Ver na linha do tempo
          </button>
        </div>
      )}
    </div>
  );
}
