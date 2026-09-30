import { useRef } from "react";
import { useReactToPrint } from "react-to-print";

// O Chrome calcula os media queries da impressão com uma largura menor que a da folha (~850px numa
// A4 paisagem), e cada navegador faz de um jeito. Por isso o grid do Bootstrap é fixado aqui no
// layout "desktop" (md/lg) em vez de depender dos breakpoints.
// md primeiro e lg depois, para que `col-md-6 col-lg-3` resolva como no desktop (lg vence).
const regraColuna = (prefixo: "md" | "lg", n: number) =>
  `.relatorio-impressao .col-${prefixo}-${n} { flex: 0 0 auto; width: ${(n / 12) * 100}%; }`;
const COLUNAS_GRID = (["md", "lg"] as const)
  .flatMap((prefixo) => Array.from({ length: 12 }, (_, i) => regraColuna(prefixo, i + 1)))
  .join("\n");

export const ESTILO_IMPRESSAO = `
  @page { size: A4 landscape; margin: 12mm; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${COLUNAS_GRID}
  .relatorio-impressao .card { box-shadow: none !important; border: 1px solid #dee2e6 !important; break-inside: avoid; }
  .relatorio-impressao thead { display: table-header-group; }
  .relatorio-impressao tr { break-inside: avoid; }
  .relatorio-impressao .table-responsive { overflow: visible; box-shadow: none !important; }
  .relatorio-secao-titulo { break-after: avoid; }
  .relatorio-secao-nova-pagina { break-before: page; }
`;

/**
 * Impressão/PDF de relatórios: devolve o `contentRef` (a ser passado ao <RelatorioImprimivel />)
 * e a função `imprimir`. O nome do arquivo sugerido no "Salvar como PDF" é o `nomeArquivo`.
 */
export function useImprimirRelatorio(nomeArquivo: string) {
  const contentRef = useRef<HTMLDivElement>(null);

  const imprimir = useReactToPrint({
    contentRef,
    documentTitle: nomeArquivo,
    pageStyle: ESTILO_IMPRESSAO,
  });

  return { contentRef, imprimir };
}
