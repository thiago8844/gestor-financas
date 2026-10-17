import { brl } from "../CompromissosFuturos/formatadores";
import { NATUREZA, NATUREZAS } from "./constantes";
import { SituacaoBarra, Variacao } from "./SituacaoBarra";
import type { RelatorioAnaliseGastos } from "../../../types/relatorio";

function Cartao({ titulo, valor, icone, classe = "", children }: { titulo: string; valor: string; icone: string; classe?: string; children?: React.ReactNode }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card shadow-sm border-0 h-100">
        <div className="card-body">
          <div className="text-muted small mb-1">
            <i className={`bi ${icone} me-2`}></i>
            {titulo}
          </div>
          <div className={`fs-4 fw-bold ${classe}`}>{valor}</div>
          {children && <div className="small text-muted mt-1">{children}</div>}
        </div>
      </div>
    </div>
  );
}

/** Frases curtas que resumem o que os números dizem — só as que se aplicam aos dados. */
function destaques(r: RelatorioAnaliseGastos): string[] {
  const { resumo, por_natureza, por_categoria } = r;
  const lista: string[] = [];

  if (resumo.rigidez_percentual !== null && resumo.total > 0) {
    lista.push(
      `${resumo.rigidez_percentual.toFixed(0)}% dos gastos são fixos (${brl(resumo.fixos_mensal)} por mês): é o piso que você paga mesmo num mês sem nenhum gasto extra.`
    );
  }

  const variaveis = por_natureza.find((n) => n.natureza === "VARIAVEL");
  if (variaveis && variaveis.total > 0 && resumo.total > 0) {
    lista.push(
      `Os gastos variáveis (${brl(variaveis.total)}, ${variaveis.percentual?.toFixed(0)}% do total) são a parte que você controla mais facilmente.`
    );
  }

  const parceladas = por_natureza.find((n) => n.natureza === "PARCELADA");
  if (parceladas && parceladas.total > 0) {
    lista.push(`${brl(parceladas.total)} do período já estão comprometidos em parcelas de compras anteriores.`);
  }

  if (por_categoria.length > 0 && resumo.total > 0) {
    const topo = por_categoria[0];
    lista.push(`A maior categoria é ${topo.categoria}, com ${brl(topo.total)} (${topo.percentual?.toFixed(0)}% do total).`);
  }

  if (resumo.comprometimento_receitas !== null) {
    lista.push(`Os gastos equivalem a ${resumo.comprometimento_receitas.toFixed(0)}% das receitas do período (${brl(resumo.receitas)}).`);
  }

  if (resumo.previsto > 0) {
    lista.push(`${brl(resumo.previsto)} ainda vão ser lançados por recorrências que não venceram.`);
  }

  return lista;
}

export function ResumoAnaliseGastos({ relatorio }: { relatorio: RelatorioAnaliseGastos }) {
  const { resumo, por_natureza } = relatorio;
  const aPagar = resumo.pendente + resumo.previsto;
  const frases = destaques(relatorio);

  return (
    <div>
      <div className="row g-3 mb-3">
        <Cartao titulo="Total gasto" valor={brl(resumo.total)} icone="bi-wallet2" classe="text-danger">
          {resumo.quantidade} lançamentos
          <Variacao valor={resumo.variacao_percentual} />
          {resumo.anterior !== null && <div>Período anterior: {brl(resumo.anterior)}</div>}
        </Cartao>
        <Cartao titulo="Já pago" valor={brl(resumo.pago)} icone="bi-check-circle" classe="text-success">
          {resumo.percentual_pago !== null ? `${resumo.percentual_pago.toFixed(0)}% do total` : "—"}
        </Cartao>
        <Cartao titulo="Falta pagar" valor={brl(aPagar)} icone="bi-hourglass-split" classe={aPagar > 0 ? "text-warning-emphasis" : ""}>
          {brl(resumo.pendente)} já lançado
          {resumo.previsto > 0 && <div>{brl(resumo.previsto)} previsto (recorrências futuras)</div>}
        </Cartao>
        <Cartao titulo="Média por mês" valor={brl(resumo.media_mensal)} icone="bi-calendar3">
          {brl(resumo.media_diaria)} por dia
          {resumo.ticket_medio !== null && <div>Gasto médio: {brl(resumo.ticket_medio)}</div>}
        </Cartao>
        <Cartao titulo="Custo fixo mensal" valor={brl(resumo.fixos_mensal)} icone="bi-pin-angle">
          {resumo.rigidez_percentual !== null ? `${resumo.rigidez_percentual.toFixed(0)}% do total é fixo` : "—"}
        </Cartao>
        <Cartao titulo="No cartão" valor={brl(resumo.no_cartao)} icone="bi-credit-card">
          {resumo.total > 0 ? `${((resumo.no_cartao / resumo.total) * 100).toFixed(0)}% do total` : "—"}
        </Cartao>
        <Cartao titulo="Direto na conta" valor={brl(resumo.na_conta)} icone="bi-bank">
          {resumo.total > 0 ? `${((resumo.na_conta / resumo.total) * 100).toFixed(0)}% do total` : "—"}
        </Cartao>
        <Cartao titulo="Comprometimento da renda" valor={resumo.comprometimento_receitas !== null ? `${resumo.comprometimento_receitas.toFixed(0)}%` : "—"} icone="bi-percent">
          {resumo.comprometimento_receitas !== null ? `Receitas: ${brl(resumo.receitas)}` : "Sem receitas no período"}
        </Cartao>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <h6 className="fw-bold mb-3">Como o dinheiro foi (e vai ser) gasto</h6>
          <SituacaoBarra somas={resumo} />

          <hr />

          <div className="small text-muted mb-2">Tipo de gasto</div>
          <div className="progress mb-2" style={{ height: 14 }} role="img" aria-label="Composição dos gastos por tipo">
            {por_natureza.map((n) => (
              <div
                key={n.natureza}
                className="progress-bar"
                style={{ width: `${n.percentual ?? 0}%`, background: NATUREZA[n.natureza].cor }}
                title={`${NATUREZA[n.natureza].rotulo}: ${brl(n.total)}`}
              ></div>
            ))}
          </div>
          <div className="row g-2">
            {NATUREZAS.map((chave) => {
              const n = por_natureza.find((x) => x.natureza === chave)!;
              return (
                <div className="col-6 col-lg-3" key={chave}>
                  <div className="small">
                    <i className="bi bi-circle-fill me-2" style={{ color: NATUREZA[chave].cor, fontSize: 9 }}></i>
                    {NATUREZA[chave].rotulo}
                  </div>
                  <div className="fw-semibold">
                    {brl(n.total)} <span className="text-muted small fw-normal">{n.percentual !== null ? `${n.percentual.toFixed(0)}%` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {resumo.sem_valor > 0 && (
        <div className="alert alert-light border small">
          <i className="bi bi-info-circle me-2"></i>
          {resumo.sem_valor} {resumo.sem_valor === 1 ? "lançamento sem valor definido não entra" : "lançamentos sem valor definido não entram"} nos
          totais (geralmente contas variáveis ainda sem valor). Ative "Estimar valores variáveis" nos filtros para prever os futuros pelo histórico.
        </div>
      )}

      {frases.length > 0 && (
        <div className="card shadow-sm border-0">
          <div className="card-body">
            <h6 className="fw-bold mb-3">
              <i className="bi bi-lightbulb me-2 text-warning"></i>
              O que os números mostram
            </h6>
            <ul className="mb-0 small">
              {frases.map((f) => (
                <li key={f} className="mb-1">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
