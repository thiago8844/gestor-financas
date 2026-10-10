import { brl, COR_ORIGEM, formatarDataExtensa, formatarDiaMes, ICONE_ORIGEM, LABEL_ORIGEM } from "./formatadores";
import type { MesProjecao, ResumoCompromissosFuturos as ResumoTipo, TipoProjecao } from "../../../types/relatorio";

type Props = {
  resumo: ResumoTipo;
  meses: MesProjecao[];
  tipos: TipoProjecao;
  dataFinal: string;
};

const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Kpi({
  icone,
  corIcone,
  titulo,
  valor,
  corValor,
  rodape,
}: {
  icone: string;
  corIcone: string;
  titulo: string;
  valor: string;
  corValor?: string;
  rodape?: React.ReactNode;
}) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className="card shadow-sm border-0 h-100">
        <div className="card-body d-flex flex-column align-items-start">
          <span className="text-muted small mb-1">
            <i className={`bi ${icone} ${corIcone} me-2`}></i>
            {titulo}
          </span>
          <span className={`fs-4 fw-semibold ${corValor ?? ""}`}>{valor}</span>
          {rodape && <span className="text-muted small mt-1">{rodape}</span>}
        </div>
      </div>
    </div>
  );
}

/** Média do resultado mensal. O primeiro mês é só o restante de hoje, então não entra quando há outros. */
function mediaResultadoMensal(meses: MesProjecao[]): number | null {
  const base = meses.length > 1 ? meses.slice(1) : meses;
  if (base.length === 0) return null;
  return base.reduce((soma, m) => soma + m.resultado, 0) / base.length;
}

export function ResumoCompromissosFuturos({ resumo, meses, tipos, dataFinal }: Props) {
  const menorNegativo = resumo.menor_saldo.valor < 0;
  const menorSaldo = <span>em {formatarDataExtensa(resumo.menor_saldo.data)}</span>;
  const saldoFinalNegativo = resumo.saldo_final < 0;
  const saldoAtualNegativo = resumo.saldo_atual < 0;

  const saldoHoje = (
    <Kpi
      icone="bi-wallet2"
      corIcone="text-primary"
      titulo="Saldo disponível hoje"
      valor={brl(resumo.saldo_atual)}
      corValor={saldoAtualNegativo ? "text-danger" : ""}
      rodape="Nas contas selecionadas"
    />
  );

  if (tipos === "DESPESAS") {
    return (
      <div>
        <div className="row g-4 mb-4">
          {saldoHoje}
          <Kpi
            icone="bi-arrow-up-circle-fill"
            corIcone="text-danger"
            titulo="Despesas a pagar"
            valor={brl(resumo.a_pagar)}
            corValor="text-danger"
            rodape={resumo.estimado.a_pagar > 0 ? `Inclui ${brl(resumo.estimado.a_pagar)} estimados` : "Tudo que vence até a data final"}
          />
          <Kpi
            icone={saldoFinalNegativo ? "bi-x-circle-fill" : "bi-check-circle-fill"}
            corIcone={saldoFinalNegativo ? "text-danger" : "text-success"}
            titulo="Sobra se pagar tudo hoje"
            valor={brl(resumo.saldo_final)}
            corValor={saldoFinalNegativo ? "text-danger" : "text-success"}
            rodape={saldoFinalNegativo ? "Não cobre todas as despesas" : "Cobre todas as despesas"}
          />
          <Kpi
            icone={menorNegativo ? "bi-exclamation-triangle-fill" : "bi-flag-fill"}
            corIcone={menorNegativo ? "text-danger" : "text-primary"}
            titulo="Menor saldo"
            valor={brl(resumo.menor_saldo.valor)}
            corValor={menorNegativo ? "text-danger" : ""}
            rodape={menorSaldo}
          />
        </div>
        <ComposicaoCompromissos resumo={resumo} />
        <Rodape resumo={resumo} />
      </div>
    );
  }

  if (tipos === "RECEITAS") {
    return (
      <div>
        <div className="row g-4 mb-4">
          {saldoHoje}
          <Kpi
            icone="bi-arrow-down-circle-fill"
            corIcone="text-success"
            titulo="Receitas a entrar"
            valor={brl(resumo.a_receber)}
            corValor="text-success"
            rodape={resumo.estimado.a_receber > 0 ? `Inclui ${brl(resumo.estimado.a_receber)} estimados` : "Sem contar nenhum pagamento"}
          />
          <Kpi
            icone="bi-flag-fill"
            corIcone="text-primary"
            titulo={`Saldo em ${formatarDiaMes(dataFinal)}`}
            valor={brl(resumo.saldo_final)}
            corValor={saldoFinalNegativo ? "text-danger" : ""}
            rodape="Se só entrasse dinheiro"
          />
          <Kpi
            icone={menorNegativo ? "bi-exclamation-triangle-fill" : "bi-flag-fill"}
            corIcone={menorNegativo ? "text-danger" : "text-primary"}
            titulo="Menor saldo"
            valor={brl(resumo.menor_saldo.valor)}
            corValor={menorNegativo ? "text-danger" : ""}
            rodape={menorSaldo}
          />
        </div>
        <Rodape resumo={resumo} />
      </div>
    );
  }

  // AMBOS: o indicador principal é o quanto sobra livre por mês.
  const livre = mediaResultadoMensal(meses);
  const livreNegativo = livre !== null && livre < 0;

  return (
    <div>
      <div className="row g-4 mb-4">
        {saldoHoje}
        <Kpi
          icone="bi-arrow-down-circle-fill"
          corIcone="text-success"
          titulo="A receber"
          valor={brl(resumo.a_receber)}
          corValor="text-success"
          rodape={resumo.estimado.a_receber > 0 ? `Inclui ${brl(resumo.estimado.a_receber)} estimados` : undefined}
        />
        <Kpi
          icone="bi-arrow-up-circle-fill"
          corIcone="text-danger"
          titulo="A pagar"
          valor={brl(resumo.a_pagar)}
          corValor="text-danger"
          rodape={resumo.estimado.a_pagar > 0 ? `Inclui ${brl(resumo.estimado.a_pagar)} estimados` : undefined}
        />
        <Kpi
          icone="bi-piggy-bank-fill"
          corIcone={livreNegativo ? "text-danger" : "text-success"}
          titulo="Livre por mês (média)"
          valor={livre === null ? "-" : brl(livre)}
          corValor={livreNegativo ? "text-danger" : "text-success"}
          rodape="Sobra de receitas depois de despesas, sem contar o mês atual"
        />
      </div>

      <ComposicaoCompromissos resumo={resumo} />
      <Rodape resumo={resumo} />
    </div>
  );
}

function Rodape({ resumo }: { resumo: ResumoTipo }) {
  const temEstimado = resumo.estimado.a_receber + resumo.estimado.a_pagar > 0;

  return (
    <>
      {temEstimado && (
        <p className="text-muted small mt-3 mb-0">
          <i className="bi bi-magic me-1"></i>
          Valores marcados como <em>estimado</em> são previsões calculadas com o histórico de cada recorrência —
          não são compromissos confirmados.
        </p>
      )}
    </>
  );
}

function ComposicaoCompromissos({ resumo }: { resumo: ResumoTipo }) {
  if (resumo.a_pagar <= 0) return null;

  return (
    <div className="card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-3">
          <h6 className="fw-bold mb-0">
            <i className="bi bi-pie-chart-fill text-primary me-2"></i>
            Do que é feito o que você vai pagar
          </h6>
          {resumo.comprometido_percentual !== null &&
            (resumo.comprometido_percentual > 100 ? (
              <span className="small text-danger">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                Os compromissos equivalem a <strong>{percentual(resumo.comprometido_percentual)}</strong> do saldo +
                entradas previstas — mais do que você tem
              </span>
            ) : (
              <span className="small text-muted">
                <strong className="text-body">{percentual(resumo.comprometido_percentual)}</strong> do saldo + o que
                ainda vai entrar já está comprometido
              </span>
            ))}
        </div>

        <div
          className="d-flex rounded overflow-hidden mb-3"
          style={{ height: 14, gap: 2 }}
          role="img"
          aria-label="Composição das saídas por origem"
        >
          {resumo.composicao_saidas.map((parte) => (
            <div
              key={parte.origem}
              title={`${LABEL_ORIGEM[parte.origem]}: ${brl(parte.total)}`}
              style={{
                width: `${(parte.total / resumo.a_pagar) * 100}%`,
                background: COR_ORIGEM[parte.origem],
                minWidth: 4,
              }}
            />
          ))}
        </div>

        <div className="row g-3">
          {resumo.composicao_saidas.map((parte) => (
            <div className="col-6 col-lg-3" key={parte.origem}>
              <div className="d-flex align-items-start gap-2">
                <span
                  className="rounded-circle flex-shrink-0 mt-1"
                  style={{ width: 10, height: 10, background: COR_ORIGEM[parte.origem] }}
                />
                <div>
                  <div className="small">
                    <i className={`bi ${ICONE_ORIGEM[parte.origem]} me-1 text-muted`}></i>
                    {LABEL_ORIGEM[parte.origem]}
                  </div>
                  <div className="fw-semibold">{brl(parte.total)}</div>
                  <div className="text-muted small">
                    {parte.quantidade} {parte.quantidade === 1 ? "item" : "itens"} ·{" "}
                    {Math.round((parte.total / resumo.a_pagar) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
