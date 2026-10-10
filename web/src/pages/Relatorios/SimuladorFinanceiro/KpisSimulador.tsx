import type { ReactNode } from "react";
import type { RelatorioSimulador, ResumoSimulacao } from "../../../types/simulador";
import { BadgeConfianca } from "./ui";
import { brl, brlSinal, formatarDataExtensa, formatarDiaMes, pct } from "./utils";

function Kpi({
  icone,
  corIcone,
  titulo,
  valor,
  corValor,
  rodape,
  delta,
}: {
  icone: string;
  corIcone: string;
  titulo: string;
  valor: ReactNode;
  corValor?: string;
  rodape?: ReactNode;
  delta?: ReactNode;
}) {
  return (
    <div className="col-6 col-md-4 col-xl">
      <div className="card shadow-sm border-0 h-100">
        <div className="card-body d-flex flex-column align-items-start p-3">
          <span className="text-muted small mb-1">
            <i className={`bi ${icone} ${corIcone} me-2`}></i>
            {titulo}
          </span>
          <span className={`fs-5 fw-semibold ${corValor ?? ""}`}>{valor}</span>
          {rodape && <span className="text-muted small mt-1">{rodape}</span>}
          {delta && <span className="small mt-1">{delta}</span>}
        </div>
      </div>
    </div>
  );
}

/** Diferença em relação ao cenário-base, só quando há simulação ativa. */
function Delta({ valor, inverter = false, formato = brlSinal }: { valor: number; inverter?: boolean; formato?: (v: number) => string }) {
  if (Math.abs(valor) < 0.005) return <span className="text-muted">= previsão automática</span>;
  const bom = inverter ? valor < 0 : valor > 0;
  return (
    <span className={bom ? "text-success" : "text-danger"}>
      <i className={`bi ${valor > 0 ? "bi-arrow-up-short" : "bi-arrow-down-short"}`}></i>
      {formato(valor)} vs. automática
    </span>
  );
}

const pp = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;

export function KpisSimulador({ relatorio }: { relatorio: RelatorioSimulador }) {
  const r: ResumoSimulacao = relatorio.cenarios.personalizado.resumo;
  const b: ResumoSimulacao = relatorio.cenarios.base.resumo;
  const ativo = relatorio.cenario_ativo;
  const d = (fn: (x: ResumoSimulacao) => number | null) => (ativo ? (fn(r) ?? 0) - (fn(b) ?? 0) : null);
  const dataFinal = relatorio.periodo.data_final;
  const menorNegativo = r.menor_saldo.valor < 0;

  return (
    <>
      <div className="row g-3 mb-3">
        <Kpi
          icone="bi-wallet2"
          corIcone="text-primary"
          titulo="Saldo atual"
          valor={brl(r.saldo_atual)}
          corValor={r.saldo_atual < 0 ? "text-danger" : ""}
          rodape="Nas contas selecionadas"
        />
        <Kpi
          icone="bi-flag-fill"
          corIcone={r.saldo_final < 0 ? "text-danger" : "text-primary"}
          titulo={`Saldo previsto em ${formatarDiaMes(dataFinal)}`}
          valor={brl(r.saldo_final)}
          corValor={r.saldo_final < 0 ? "text-danger" : ""}
          delta={ativo && <Delta valor={d((x) => x.saldo_final)!} />}
        />
        <Kpi
          icone="bi-graph-up-arrow"
          corIcone={r.resultado < 0 ? "text-danger" : "text-success"}
          titulo="Resultado previsto"
          valor={brlSinal(r.resultado)}
          corValor={r.resultado < 0 ? "text-danger" : "text-success"}
          rodape="Saldo final − saldo atual"
        />
        <Kpi
          icone="bi-arrow-down-circle-fill"
          corIcone="text-success"
          titulo="Receitas previstas"
          valor={brl(r.receitas.total)}
          rodape={
            r.receitas.estimadas + r.receitas.hipoteticas > 0
              ? `${brl(r.receitas.conhecidas)} confirmadas · ${brl(r.receitas.estimadas)} estimadas${r.receitas.hipoteticas ? ` · ${brl(r.receitas.hipoteticas)} simuladas` : ""}`
              : "Todas confirmadas"
          }
          delta={ativo && <Delta valor={d((x) => x.receitas.total)!} />}
        />
        <Kpi
          icone="bi-arrow-up-circle-fill"
          corIcone="text-danger"
          titulo="Despesas previstas"
          valor={brl(r.despesas.total)}
          rodape={`${brl(r.despesas.conhecidas)} conhecidas · ${brl(r.despesas.estimadas)} estimadas${r.despesas.hipoteticas ? ` · ${brl(r.despesas.hipoteticas)} simuladas` : ""}`}
          delta={ativo && <Delta valor={d((x) => x.despesas.total)!} inverter />}
        />
      </div>

      <div className="row g-3 mb-4">
        <Kpi
          icone="bi-lock-fill"
          corIcone="text-warning"
          titulo="Comprometimento"
          valor={pct(r.comprometimento_confirmado_pct)}
          corValor={(r.comprometimento_confirmado_pct ?? 0) > 100 ? "text-danger" : ""}
          rodape="Das receitas, já comprometido com despesas conhecidas"
        />
        <Kpi
          icone="bi-piggy-bank-fill"
          corIcone="text-success"
          titulo="Taxa de poupança"
          valor={pct(r.taxa_poupanca_pct)}
          corValor={(r.taxa_poupanca_pct ?? 0) < 0 ? "text-danger" : ""}
          rodape="Das receitas, o que sobra após todas as despesas"
          delta={ativo && r.taxa_poupanca_pct !== null && b.taxa_poupanca_pct !== null && <Delta valor={r.taxa_poupanca_pct - b.taxa_poupanca_pct} formato={pp} />}
        />
        <Kpi
          icone="bi-arrow-bar-down"
          corIcone={menorNegativo ? "text-danger" : "text-primary"}
          titulo="Menor saldo previsto"
          valor={brl(r.menor_saldo.valor)}
          corValor={menorNegativo ? "text-danger" : ""}
          rodape={
            <span className={menorNegativo ? "text-danger" : ""}>
              {menorNegativo && <i className="bi bi-exclamation-triangle-fill me-1"></i>}
              em {formatarDataExtensa(r.menor_saldo.data)}
              {r.dias_negativos > 0 && ` · ${r.dias_negativos} dia(s) no negativo`}
            </span>
          }
          delta={ativo && <Delta valor={d((x) => x.menor_saldo.valor)!} />}
        />
        <Kpi
          icone="bi-calendar2-plus"
          corIcone="text-success"
          titulo="Capacidade de poupança"
          valor={`${brlSinal(r.poupanca_mensal_media)}/mês`}
          corValor={r.poupanca_mensal_media < 0 ? "text-danger" : ""}
          rodape="Sobra média por mês no período"
          delta={ativo && <Delta valor={d((x) => x.poupanca_mensal_media)!} />}
        />
        <Kpi
          icone="bi-shield-check"
          corIcone="text-primary"
          titulo="Confiabilidade geral"
          valor={<BadgeConfianca nivel={relatorio.confiabilidade.nivel} prefixo={false} />}
          rodape={`${pct(relatorio.confiabilidade.percentual_estimado, 0)} do movimento é estimativa · ${relatorio.confiabilidade.meses_historico} meses de histórico`}
        />
      </div>
    </>
  );
}
