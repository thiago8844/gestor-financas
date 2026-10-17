import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";

type CardRelatorio = {
  titulo: string;
  pergunta: string;
  icone: string;
  to: string | null;
};

const RELATORIOS: CardRelatorio[] = [
  {
    titulo: "Fluxo de Caixa",
    pergunta: "Para onde meu dinheiro está indo e como meu saldo evoluiu?",
    icone: "bi-cash-coin",
    to: "/relatorios/fluxo-de-caixa",
  },
  {
    titulo: "Resultado Financeiro",
    pergunta: "Estou ganhando ou gastando mais? Onde está meu resultado?",
    icone: "bi-graph-up",
    to: "/relatorios/resultado-financeiro",
  },
  {
    titulo: "Análise dos Gastos",
    pergunta: "Quanto do que eu gasto é fixo, quanto varia, o que já paguei e o que ainda vem?",
    icone: "bi-clipboard-data",
    to: "/relatorios/analise-gastos",
  },
  {
    titulo: "Orçado x Realizado",
    pergunta: "Estou gastando conforme o planejado?",
    icone: "bi-pie-chart",
    to: null,
  },
  {
    titulo: "Compromissos Futuros",
    pergunta: "Quanto do meu dinheiro já está comprometido?",
    icone: "bi-calendar-check",
    to: "/relatorios/compromissos-futuros",
  },
  {
    titulo: "Simulador Financeiro Futuro",
    pergunta: "Como vai estar meu dinheiro nos próximos meses — e o que muda se eu decidir algo diferente?",
    icone: "bi-stars",
    to: "/relatorios/simulador-financeiro",
  },
];

export function ListagemRelatorios() {
  return (
    <PageLayout title="Relatórios" backTo="/">
      <div className="row g-4">
        {RELATORIOS.map((relatorio) => {
          const conteudo = (
            <div className={`card shadow-sm border-0 h-100 ${!relatorio.to ? "opacity-75" : ""}`}>
              <div className="card-body d-flex flex-column">
                <i className={`bi ${relatorio.icone} fs-1 text-primary mb-3`}></i>
                <h5 className="fw-bold mb-2">
                  {relatorio.titulo}
                  {!relatorio.to && <span className="badge text-bg-secondary ms-2 align-middle">Em breve</span>}
                </h5>
                <p className="text-muted small mb-0">{relatorio.pergunta}</p>
              </div>
            </div>
          );

          return (
            <div className="col-12 col-md-6" key={relatorio.titulo}>
              {relatorio.to ? (
                <Link to={relatorio.to} className="text-decoration-none">
                  {conteudo}
                </Link>
              ) : (
                conteudo
              )}
            </div>
          );
        })}
      </div>
    </PageLayout>
  );
}
