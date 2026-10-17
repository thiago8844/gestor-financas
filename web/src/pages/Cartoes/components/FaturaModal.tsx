import { useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import writeExcelFile from "write-excel-file/browser";
import { convertNumberToCurrencyMask } from "../../../utils";
import type { Fatura } from "../../../types/fatura";
import type { Cartao } from "../../../types/cartao";
import type { Transacao } from "../../../types/transacao";
import { RelatorioImprimivel } from "../../../components/Relatorio/RelatorioImprimivel";
import { useImprimirRelatorio } from "../../../hooks/useImprimirRelatorio";
import {
  FILTROS_FATURA_INICIAIS,
  STATUS_BADGE,
  STATUS_LABEL,
  contarFiltrosAtivos,
  descreverFiltros,
  filtrarParcelas,
  formatarDataBr,
  formatarMesAno,
  type FiltrosFatura,
} from "./faturaUtils";

type Props = {
  fatura: Fatura;
  cartao: Cartao;
  onClose: () => void;
  onPagar: (fatura: Fatura) => void;
  onReverter: (fatura: Fatura) => void;
};

const moeda = (v: number | null | undefined) => `R$ ${convertNumberToCurrencyMask(v ?? 0)}`;

function Resumo({ rotulo, valor, classe = "" }: { rotulo: string; valor: string; classe?: string }) {
  return (
    <div className="col-6 col-md-3">
      <div className="border rounded p-2 h-100 bg-body-tertiary">
        <div className="text-muted small">{rotulo}</div>
        <div className={`fw-bold fs-6 ${classe}`}>{valor}</div>
      </div>
    </div>
  );
}

function ParcelaTexto({ p }: { p: Transacao }) {
  return <>{p.installment_total && p.installment_total > 1 ? `${p.installment_number}/${p.installment_total}` : "Única"}</>;
}

export function FaturaModal({ fatura, cartao, onClose, onPagar, onReverter }: Props) {
  const [filtros, setFiltros] = useState<FiltrosFatura>(FILTROS_FATURA_INICIAIS);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const titulo = `Fatura ${cartao.name} — ${formatarMesAno(fatura.reference_month)}`;
  const { contentRef, imprimir } = useImprimirRelatorio(titulo);

  const set = <K extends keyof FiltrosFatura>(campo: K, valor: FiltrosFatura[K]) =>
    setFiltros((prev) => ({ ...prev, [campo]: valor }));

  const categorias = useMemo(() => {
    const mapa = new Map<number, string>();
    fatura.parcelas.forEach((p) => p.categoria && mapa.set(p.categoria.id, p.categoria.name));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [fatura.parcelas]);

  const parcelas = useMemo(() => filtrarParcelas(fatura.parcelas, filtros), [fatura.parcelas, filtros]);
  const totalFiltrado = parcelas.reduce((soma, p) => soma + (p.amount ?? 0), 0);
  const ativos = contarFiltrosAtivos(filtros);
  const filtrado = ativos > 0;
  const textoFiltros = descreverFiltros(
    filtros,
    categorias.find(([id]) => String(id) === filtros.categoria)?.[1]
  );

  const exportarExcel = async () => {
    const linhas = [
      ...parcelas.map((p) => ({
        descricao: p.description,
        categoria: p.categoria?.name ?? "-",
        compra: p.purchase_date_fmt ?? "-",
        parcela: p.installment_total && p.installment_total > 1 ? `${p.installment_number}/${p.installment_total}` : "Única",
        status: p.status === "PAID" ? "Paga" : "Pendente",
        valor: p.amount ?? 0,
      })),
      { descricao: "TOTAL", categoria: "", compra: "", parcela: "", status: "", valor: totalFiltrado },
    ];

    const cabecalho = (texto: string) => ({ value: texto, fontWeight: "bold" as const, backgroundColor: "#E9ECEF" });
    const negrito = (i: number) => (i === linhas.length - 1 ? ("bold" as const) : undefined);

    await writeExcelFile(linhas, {
      columns: [
        { header: cabecalho("Descrição"), width: 38, cell: (l, i) => ({ value: l.descricao, fontWeight: negrito(i) }) },
        { header: cabecalho("Categoria"), width: 20, cell: (l) => ({ value: l.categoria }) },
        { header: cabecalho("Data da compra"), width: 16, cell: (l) => ({ value: l.compra }) },
        { header: cabecalho("Parcela"), width: 10, cell: (l) => ({ value: l.parcela }) },
        { header: cabecalho("Status"), width: 12, cell: (l) => ({ value: l.status }) },
        {
          header: cabecalho("Valor (R$)"),
          width: 14,
          cell: (l, i) => ({ value: l.valor, format: "#,##0.00", fontWeight: negrito(i) }),
        },
      ],
      sheet: formatarMesAno(fatura.reference_month).replace("/", "-"),
    }).toFile(`fatura-${cartao.name}-${fatura.reference_month.slice(0, 7)}.xlsx`.replace(/\s+/g, "-").toLowerCase());
  };

  const tabelaParcelas = (
    <table className="table table-sm align-middle mb-0">
      <thead className="table-light">
        <tr>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Compra</th>
          <th>Parcela</th>
          <th>Status</th>
          <th className="text-end">Valor</th>
        </tr>
      </thead>
      <tbody>
        {parcelas.map((p) => (
          <tr key={p.id}>
            <td>{p.description}</td>
            <td>{p.categoria?.name ?? "-"}</td>
            <td className="text-nowrap">{p.purchase_date_fmt ?? "-"}</td>
            <td>
              <ParcelaTexto p={p} />
            </td>
            <td>{p.status === "PAID" ? "Paga" : "Pendente"}</td>
            <td className="text-end text-nowrap">{moeda(p.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="fw-bold">
          <td colSpan={5} className="text-end">
            Total{filtrado ? " (filtrado)" : ""}
          </td>
          <td className="text-end text-nowrap">{moeda(totalFiltrado)}</td>
        </tr>
      </tfoot>
    </table>
  );

  return (
    <>
    <Modal show onHide={onClose} size="xl" scrollable fullscreen="md-down">
      <Modal.Header closeButton>
        <div>
          <Modal.Title className="h5 mb-1">
            <i className="bi bi-credit-card me-2"></i>
            {cartao.name} · {formatarMesAno(fatura.reference_month)}
            <span className={`badge ms-2 ${STATUS_BADGE[fatura.status]}`}>{STATUS_LABEL[fatura.status]}</span>
          </Modal.Title>
          <div className="text-muted small">
            Fecha em {formatarDataBr(fatura.closing_date)} · Vence em {formatarDataBr(fatura.due_date)}
            {cartao.conta_nome && <> · Paga pela conta {cartao.conta_nome}</>}
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="row g-2 mb-3">
          <Resumo rotulo="Total da fatura" valor={moeda(fatura.total)} />
          <Resumo rotulo="Pago" valor={moeda(fatura.pago)} classe="text-success" />
          <Resumo rotulo="Pendente" valor={moeda(fatura.pendente)} classe={fatura.pendente > 0 ? "text-danger" : ""} />
          <Resumo rotulo="Lançamentos" valor={String(fatura.parcelas.length)} />
        </div>

        {/* Barra de busca + ações */}
        <div className="d-flex flex-wrap gap-2 mb-2">
          <div className="input-group input-group-sm flex-grow-1" style={{ minWidth: "200px", maxWidth: "360px" }}>
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="search"
              className="form-control"
              placeholder="Buscar lançamento..."
              value={filtros.busca}
              onChange={(e) => set("busca", e.target.value)}
            />
          </div>

          <button
            type="button"
            className={`btn btn-sm ${mostrarFiltros ? "btn-secondary" : "btn-outline-secondary"}`}
            onClick={() => setMostrarFiltros((v) => !v)}
          >
            <i className="bi bi-funnel me-1"></i>
            Filtros
            {ativos > 0 && <span className="badge rounded-pill text-bg-primary ms-2">{ativos}</span>}
          </button>

          <div className="ms-md-auto d-flex gap-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => imprimir()}>
              <i className="bi bi-file-earmark-pdf me-1"></i>
              PDF
            </button>
            <button type="button" className="btn btn-sm btn-outline-success" onClick={exportarExcel}>
              <i className="bi bi-file-earmark-excel me-1"></i>
              Excel
            </button>
          </div>
        </div>

        {mostrarFiltros && (
          <div className="border rounded p-3 mb-3 bg-body-tertiary">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Categoria</label>
                <select className="form-select form-select-sm" value={filtros.categoria} onChange={(e) => set("categoria", e.target.value)}>
                  <option value="">Todas</option>
                  <option value="sem">Sem categoria</option>
                  {categorias.map(([id, nome]) => (
                    <option key={id} value={id}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Situação</label>
                <select className="form-select form-select-sm" value={filtros.status} onChange={(e) => set("status", e.target.value as FiltrosFatura["status"])}>
                  <option value="">Todas</option>
                  <option value="PENDING">Pendentes</option>
                  <option value="PAID">Pagas</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Tipo de compra</label>
                <select className="form-select form-select-sm" value={filtros.parcelamento} onChange={(e) => set("parcelamento", e.target.value as FiltrosFatura["parcelamento"])}>
                  <option value="">Todas</option>
                  <option value="parcelada">Parceladas</option>
                  <option value="avista">À vista</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Ordenar por</label>
                <select className="form-select form-select-sm" value={filtros.ordem} onChange={(e) => set("ordem", e.target.value as FiltrosFatura["ordem"])}>
                  <option value="compra_asc">Compra: mais antiga</option>
                  <option value="compra_desc">Compra: mais recente</option>
                  <option value="valor_desc">Maior valor</option>
                  <option value="valor_asc">Menor valor</option>
                  <option value="descricao">Descrição (A-Z)</option>
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Compra a partir de</label>
                <input type="date" className="form-control form-control-sm" value={filtros.compraDe} onChange={(e) => set("compraDe", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Compra até</label>
                <input type="date" className="form-control form-control-sm" value={filtros.compraAte} onChange={(e) => set("compraAte", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Valor mínimo</label>
                <input type="number" min="0" step="0.01" className="form-control form-control-sm" placeholder="0,00" value={filtros.valorMin} onChange={(e) => set("valorMin", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Valor máximo</label>
                <input type="number" min="0" step="0.01" className="form-control form-control-sm" placeholder="0,00" value={filtros.valorMax} onChange={(e) => set("valorMax", e.target.value)} />
              </div>
            </div>
            <div className="text-end mt-3">
              <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setFiltros(FILTROS_FATURA_INICIAIS)}>
                <i className="bi bi-x-circle me-1"></i>
                Limpar filtros
              </button>
            </div>
          </div>
        )}

        {filtrado && (
          <div className="small text-muted mb-2">
            Mostrando {parcelas.length} de {fatura.parcelas.length} lançamentos · {moeda(totalFiltrado)}
          </div>
        )}

        {parcelas.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-inbox fs-1 d-block mb-2"></i>
            {fatura.parcelas.length === 0 ? "Essa fatura ainda não tem lançamentos." : "Nenhum lançamento com esses filtros."}
          </div>
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="table-responsive d-none d-md-block border rounded">{tabelaParcelas}</div>

            {/* Mobile: cards */}
            <div className="d-md-none d-flex flex-column gap-2">
              {parcelas.map((p) => (
                <div key={p.id} className="border rounded p-2">
                  <div className="d-flex justify-content-between gap-2">
                    <div className="fw-semibold">{p.description}</div>
                    <div className="fw-bold text-nowrap">{moeda(p.amount)}</div>
                  </div>
                  <div className="d-flex flex-wrap gap-1 mt-1 align-items-center small text-muted">
                    <span>{p.purchase_date_fmt ?? "-"}</span>
                    <span>·</span>
                    <span>
                      <ParcelaTexto p={p} />
                    </span>
                    {p.categoria && <span className="badge text-bg-secondary ms-1">{p.categoria.name}</span>}
                    <span className={`badge ms-auto ${p.status === "PAID" ? "text-bg-success" : "text-bg-secondary"}`}>
                      {p.status === "PAID" ? "Paga" : "Pendente"}
                    </span>
                  </div>
                </div>
              ))}
              <div className="d-flex justify-content-between fw-bold border-top pt-2">
                <span>Total{filtrado ? " (filtrado)" : ""}</span>
                <span>{moeda(totalFiltrado)}</span>
              </div>
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="justify-content-between">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
          Fechar
        </button>
        {fatura.id !== null &&
          (fatura.pendente > 0 ? (
            <button type="button" className="btn btn-success" onClick={() => onPagar(fatura)}>
              <i className="bi bi-cash-coin me-2"></i>
              Pagar fatura ({moeda(fatura.pendente)})
            </button>
          ) : (
            <button type="button" className="btn btn-outline-danger" onClick={() => onReverter(fatura)}>
              <i className="bi bi-arrow-counterclockwise me-2"></i>
              Reverter pagamento
            </button>
          ))}
      </Modal.Footer>

    </Modal>

      {/* Layout usado só na exportação em PDF */}
      <RelatorioImprimivel
        contentRef={contentRef}
        titulo={titulo}
        filtrosTexto={textoFiltros || null}
        resumo={
          <div className="d-flex flex-wrap gap-4 small">
            <span>Fechamento: <strong>{formatarDataBr(fatura.closing_date)}</strong></span>
            <span>Vencimento: <strong>{formatarDataBr(fatura.due_date)}</strong></span>
            <span>Status: <strong>{STATUS_LABEL[fatura.status]}</strong></span>
            <span>Total da fatura: <strong>{moeda(fatura.total)}</strong></span>
            <span>Pago: <strong>{moeda(fatura.pago)}</strong></span>
            <span>Pendente: <strong>{moeda(fatura.pendente)}</strong></span>
          </div>
        }
        tabelas={<div className="table-responsive">{tabelaParcelas}</div>}
      />
    </>
  );
}
