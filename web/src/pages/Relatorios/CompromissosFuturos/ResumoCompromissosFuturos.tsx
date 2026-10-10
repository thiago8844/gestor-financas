import { brl, COR_ORIGEM, formatarDataExtensa, formatarDiaMes, ICONE_ORIGEM, LABEL_ORIGEM } from "./formatadores";
import type { ResumoCompromissosFuturos as ResumoTipo } from "../../../types/relatorio";

type Props = {
  resumo: ResumoTipo;
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

export function ResumoCompromissosFuturos({ resumo, dataFinal }: Props) {
  const saldoFinalNegativo = resumo.saldo_final < 0;
  const estimadoTotal = resumo.estimado.a_pagar + resumo.estimado.a_receber;
  const menorNegativo = resumo.menor_saldo.valor < 0;

  return (
    <div>
      <div className="row g-4 mb-4">
        <Kpi
          icone="bi-wallet2"
          corIcone="text-primary"
          titulo="Saldo disponível hoje"
          valor={brl(resumo.saldo_atual)}
          corValor={resumo.saldo_atual < 0 ? "text-danger" : ""}
          rodape="Nas contas selecionadas"
        />
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
          icone="bi-flag-fill"
          corIcone={saldoFinalNegativo ? "text-danger" : "text-primary"}
          titulo={`Saldo em ${formatarDiaMes(dataFinal)}`}
          valor={brl(resumo.saldo_final)}
          corValor={saldoFinalNegativo ? "text-danger" : ""}
          rodape={
            <span className={menorNegativo ? "text-danger" : ""}>
              {menorNegativo && <i className="bi bi-exclamation-triangle-fill me-1"></i>}
              Menor saldo: {brl(resumo.menor_saldo.valor)} em {formatarDataExtensa(resumo.menor_saldo.data)}
            </span>
          }
        />
      </div>

      <ComposicaoCompromissos resumo={resumo} />

      {estimadoTotal > 0 && (
        <p className="text-muted small mt-3 mb-0">
          <i className="bi bi-magic me-1"></i>
          Valores marcados como <em>estimado</em> são previsões calculadas com o histórico de cada recorrência —
          não são compromissos confirmados.
        </p>
      )}
    </div>
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
