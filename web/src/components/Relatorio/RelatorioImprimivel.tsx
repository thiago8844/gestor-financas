import type { ReactNode, RefObject } from "react";

type Props = {
  contentRef: RefObject<HTMLDivElement | null>;
  titulo: string;
  /** Linha de filtros aplicados (período, contas, regime...). */
  filtrosTexto?: string | null;
  /** Seções do PDF, sempre nesta ordem: resumo → tabelas → gráficos. Omitida = seção não impressa. */
  resumo?: ReactNode;
  tabelas?: ReactNode;
  graficos?: ReactNode;
};

function Secao({ titulo, novaPagina, children }: { titulo: string; novaPagina?: boolean; children: ReactNode }) {
  return (
    <section className={`mt-4 ${novaPagina ? "relatorio-secao-nova-pagina" : ""}`}>
      <h5 className="relatorio-secao-titulo fw-bold text-uppercase border-bottom pb-2 mb-3">{titulo}</h5>
      {children}
    </section>
  );
}

/**
 * Layout padrão de PDF dos relatórios. Fica renderizado fora da tela (só para o react-to-print
 * copiar) na largura útil de uma A4 paisagem, para os gráficos medirem o tamanho certo.
 *
 * Para um relatório novo: monte `resumo`, `tabelas` e `graficos` com os mesmos componentes da
 * tela, passando `modoImpressao` (tabelas expandidas, gráficos sem animação), e use
 * `useImprimirRelatorio` + `BotaoImprimirRelatorio` na página.
 */
export function RelatorioImprimivel({ contentRef, titulo, filtrosTexto, resumo, tabelas, graficos }: Props) {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left: "-10000px", top: 0, width: "273mm", pointerEvents: "none" }}
    >
      <div ref={contentRef} className="relatorio-impressao bg-white text-dark">
        <header className="border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-muted small text-uppercase">Gestor de Finanças</div>
              <h3 className="fw-bold mb-1">{titulo}</h3>
            </div>
            <div className="text-muted small text-end">
              Gerado em
              <br />
              {new Date().toLocaleString("pt-BR")}
            </div>
          </div>
          {filtrosTexto && (
            <div className="text-muted small mt-1">
              <i className="bi bi-funnel me-2"></i>
              {filtrosTexto}
            </div>
          )}
        </header>

        {resumo && <Secao titulo="Resumo">{resumo}</Secao>}
        {tabelas && <Secao titulo="Tabelas">{tabelas}</Secao>}
        {graficos && (
          <Secao titulo="Gráficos" novaPagina>
            {graficos}
          </Secao>
        )}
      </div>
    </div>
  );
}
