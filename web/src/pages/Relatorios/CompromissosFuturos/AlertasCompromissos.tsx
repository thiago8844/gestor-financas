import { brl, formatarDataExtensa } from "./formatadores";
import type { AlertaSaldoNegativo, ResumoCompromissosFuturos } from "../../../types/relatorio";

type Props = {
  alertas: AlertaSaldoNegativo[];
  resumo: ResumoCompromissosFuturos;
  estimando: boolean;
  onEstimar: () => void;
};

function AlertaSaldo({ alerta }: { alerta: AlertaSaldoNegativo }) {
  const total = alerta.conta_id === null;

  return (
    <div className="alert alert-danger d-flex gap-3 mb-3" role="alert">
      <i className="bi bi-exclamation-triangle-fill fs-4 flex-shrink-0"></i>
      <div>
        <div className="fw-semibold">
          {total
            ? `Seu saldo ficará negativo em ${formatarDataExtensa(alerta.data)}`
            : `A conta ${alerta.conta} ficará negativa em ${formatarDataExtensa(alerta.data)}`}
        </div>
        <div className="small">
          Saldo previsto de {brl(alerta.saldo)}
          {alerta.evento && (
            <>
              {" "}
              após <strong>{alerta.evento.descricao}</strong> ({brl(alerta.evento.valor)})
            </>
          )}
          . O menor saldo chega a <strong>{brl(alerta.menor_saldo)}</strong> em{" "}
          {formatarDataExtensa(alerta.data_menor_saldo)}.{" "}
          {alerta.volta_ao_positivo_em
            ? `Volta ao positivo em ${formatarDataExtensa(alerta.volta_ao_positivo_em)}.`
            : "Não volta ao positivo dentro do período projetado."}
          {!total && " Ter saldo em outra conta não cobre o débito desta."}
        </div>
      </div>
    </div>
  );
}

export function AlertasCompromissos({ alertas, resumo, estimando, onEstimar }: Props) {
  const temAlertaTotal = alertas.some((a) => a.conta_id === null);
  // Com o saldo total negativo, as contas individuais só repetiriam o mesmo recado.
  const visiveis = temAlertaTotal ? alertas.filter((a) => a.conta_id === null) : alertas;

  const semValor = resumo.sem_valor;
  const { atrasados } = resumo;

  return (
    <>
      {visiveis.map((alerta) => (
        <AlertaSaldo key={alerta.conta_id ?? "total"} alerta={alerta} />
      ))}

      {atrasados.quantidade > 0 && (
        <div className="alert alert-warning d-flex gap-3 mb-3" role="alert">
          <i className="bi bi-clock-history fs-4 flex-shrink-0"></i>
          <div className="small">
            <strong>
              {atrasados.quantidade} {atrasados.quantidade === 1 ? "compromisso vencido" : "compromissos vencidos"}
            </strong>{" "}
            ainda pendente{atrasados.quantidade === 1 ? "" : "s"}
            {atrasados.a_pagar > 0 && <> ({brl(atrasados.a_pagar)} a pagar)</>}. Eles são considerados como saindo
            hoje, já que o saldo atual ainda não os reflete.
          </div>
        </div>
      )}

      {semValor > 0 && (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-3 mb-3" role="alert">
          <i className="bi bi-question-circle-fill fs-4 flex-shrink-0"></i>
          <div className="small flex-grow-1">
            <strong>
              {semValor} {semValor === 1 ? "lançamento recorrente sem valor definido" : "lançamentos recorrentes sem valor definido"}
            </strong>{" "}
            {estimando
              ? "e sem histórico suficiente para estimar — preencha o valor de uma ocorrência passada para melhorar a previsão."
              : "ficando fora dos totais e do saldo projetado."}
          </div>
          {!estimando && (
            <button type="button" className="btn btn-sm btn-info" onClick={onEstimar}>
              <i className="bi bi-magic me-2"></i>
              Estimar pelo histórico
            </button>
          )}
        </div>
      )}
    </>
  );
}
