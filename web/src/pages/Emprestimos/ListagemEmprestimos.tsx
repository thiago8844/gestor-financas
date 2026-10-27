import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { getEmprestimos, getResumoEmprestimos } from "../../api/emprestimos";
import { CardResumo } from "./components/CardResumo";
import { CardEmprestimo } from "./components/CardEmprestimo";
import { BaixaParcelaModal } from "./components/BaixaParcelaModal";
import { formatarDataBr, formatarMoeda } from "../../utils/emprestimo";
import type { DirecaoEmprestimo, Emprestimo, ParcelaEmprestimo } from "../../types/emprestimo";

type Filtro = "TODOS" | DirecaoEmprestimo | "ATRASADOS";

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "TODOS", label: "Todos" },
  { valor: "TOMADO", label: "Eu devo" },
  { valor: "CONCEDIDO", label: "Me devem" },
  { valor: "ATRASADOS", label: "Atrasados" },
];

export function ListagemEmprestimos() {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [verEncerrados, setVerEncerrados] = useState(false);
  const [baixa, setBaixa] = useState<{ emprestimo: Emprestimo; parcela: ParcelaEmprestimo } | null>(null);

  const resumo = useQuery({ queryKey: ["emprestimos-resumo"], queryFn: getResumoEmprestimos });

  const lista = useQuery({
    queryKey: ["emprestimos", filtro],
    queryFn: () =>
      getEmprestimos({
        direction: filtro === "TOMADO" || filtro === "CONCEDIDO" ? filtro : undefined,
        overdue: filtro === "ATRASADOS",
      }),
  });

  const emprestimos = (lista.data ?? []).filter((e) => (verEncerrados ? e.status !== "ATIVO" : e.status === "ATIVO"));
  const r = resumo.data;
  const proximo = r?.proximos_vencimentos[0];

  return (
    <PageLayout title="Empréstimos" backTo="/">
      <div className="d-flex justify-content-end mb-3">
        <Link to="/emprestimos/cadastrar" className="btn btn-success">
          <i className="bi bi-plus-circle me-2"></i>
          Novo empréstimo
        </Link>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <CardResumo
            titulo="Eu devo"
            icone="bi-arrow-up-right-circle"
            variante="danger"
            valor={formatarMoeda(r?.eu_devo.saldo_principal)}
            detalhe={`${r?.eu_devo.contratos ?? 0} ${r?.eu_devo.contratos === 1 ? "contrato" : "contratos"} · só o valor emprestado`}
            onClick={() => setFiltro(filtro === "TOMADO" ? "TODOS" : "TOMADO")}
            ativo={filtro === "TOMADO"}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <CardResumo
            titulo="Me devem"
            icone="bi-arrow-down-left-circle"
            variante="success"
            valor={formatarMoeda(r?.me_devem.saldo_principal)}
            detalhe={`${r?.me_devem.contratos ?? 0} ${r?.me_devem.contratos === 1 ? "contrato" : "contratos"} · só o valor emprestado`}
            onClick={() => setFiltro(filtro === "CONCEDIDO" ? "TODOS" : "CONCEDIDO")}
            ativo={filtro === "CONCEDIDO"}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <CardResumo
            titulo="Atrasadas"
            icone="bi-exclamation-triangle"
            variante={r && r.atrasadas.quantidade > 0 ? "warning" : "primary"}
            valor={r && r.atrasadas.quantidade > 0 ? formatarMoeda(r.atrasadas.valor) : "Nenhuma"}
            detalhe={r && r.atrasadas.quantidade > 0 ? `${r.atrasadas.quantidade} ${r.atrasadas.quantidade === 1 ? "parcela" : "parcelas"} em atraso` : "Tudo em dia"}
            onClick={() => setFiltro(filtro === "ATRASADOS" ? "TODOS" : "ATRASADOS")}
            ativo={filtro === "ATRASADOS"}
          />
        </div>
        <div className="col-12 col-sm-6 col-xl-3">
          <CardResumo
            titulo="Próximo vencimento"
            icone="bi-calendar-event"
            variante="primary"
            valor={proximo ? formatarMoeda(proximo.amount) : "-"}
            detalhe={proximo ? `${formatarDataBr(proximo.due_date)} · ${proximo.counterparty}` : "Nada a vencer"}
          />
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="btn-group" role="group" aria-label="Filtrar empréstimos">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`btn btn-sm ${filtro === f.valor ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="form-check form-switch mb-0">
          <input
            id="verEncerrados"
            type="checkbox"
            role="switch"
            className="form-check-input"
            checked={verEncerrados}
            onChange={(e) => setVerEncerrados(e.target.checked)}
          />
          <label htmlFor="verEncerrados" className="form-check-label">Ver encerrados</label>
        </div>
      </div>

      {lista.isError && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          Erro ao buscar empréstimos
          <button className="btn btn-sm btn-outline-danger" onClick={() => lista.refetch()}>Tentar novamente</button>
        </div>
      )}

      {lista.isLoading ? (
        <div className="text-center my-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div></div>
      ) : emprestimos.length === 0 ? (
        <EstadoVazio filtrando={filtro !== "TODOS" || verEncerrados} />
      ) : (
        <div className="row g-3">
          {emprestimos.map((e) => (
            <div key={e.id} className="col-12 col-lg-6">
              <CardEmprestimo emprestimo={e} onBaixar={(emprestimo, parcela) => setBaixa({ emprestimo, parcela })} />
            </div>
          ))}
        </div>
      )}

      <BaixaParcelaModal emprestimo={baixa?.emprestimo ?? null} parcela={baixa?.parcela ?? null} onClose={() => setBaixa(null)} />
    </PageLayout>
  );
}

function EstadoVazio({ filtrando }: { filtrando: boolean }) {
  if (filtrando) {
    return <p className="text-muted text-center my-5">Nenhum empréstimo encontrado com esse filtro.</p>;
  }

  return (
    <div className="text-center my-5 py-4">
      <i className="bi bi-cash-coin display-4 text-muted"></i>
      <h5 className="mt-3">Nenhum empréstimo ainda</h5>
      <p className="text-muted mx-auto" style={{ maxWidth: 420 }}>
        Registre um dinheiro que você emprestou ou pegou emprestado. O sistema calcula as parcelas, avisa dos vencimentos e lança os pagamentos na sua conta.
      </p>
      <Link to="/emprestimos/cadastrar" className="btn btn-success">
        <i className="bi bi-plus-circle me-2"></i>
        Registrar empréstimo
      </Link>
    </div>
  );
}
