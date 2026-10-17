import { useMemo, useState } from "react";
import { brl } from "../CompromissosFuturos/formatadores";
import { NATUREZA, NATUREZAS, SITUACAO } from "./constantes";
import { TabelaLancamentosGastos } from "./TabelaLancamentosGastos";
import type { LancamentoGasto, NaturezaGasto, SituacaoGasto } from "../../../types/relatorio";

type Props = { lancamentos: LancamentoGasto[]; truncado: boolean };

export function LancamentosGastos({ lancamentos, truncado }: Props) {
  const [busca, setBusca] = useState("");
  const [natureza, setNatureza] = useState<NaturezaGasto | "">("");
  const [situacao, setSituacao] = useState<SituacaoGasto | "">("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter(
      (l) =>
        (!natureza || l.natureza === natureza) &&
        (!situacao || l.situacao === situacao) &&
        (!termo || l.descricao.toLowerCase().includes(termo) || l.categoria.toLowerCase().includes(termo))
    );
  }, [lancamentos, busca, natureza, situacao]);

  const total = filtrados.reduce((s, l) => s + (l.valor ?? 0), 0);

  return (
    <div>
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small">Buscar</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text"><i className="bi bi-search"></i></span>
                <input type="search" className="form-control" placeholder="Descrição ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label small">Tipo de gasto</label>
              <select className="form-select form-select-sm" value={natureza} onChange={(e) => setNatureza(e.target.value as NaturezaGasto | "")}>
                <option value="">Todos</option>
                {NATUREZAS.map((n) => (
                  <option key={n} value={n}>{NATUREZA[n].rotulo}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label small">Situação</label>
              <select className="form-select form-select-sm" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoGasto | "")}>
                <option value="">Todas</option>
                {(Object.keys(SITUACAO) as SituacaoGasto[]).map((s) => (
                  <option key={s} value={s}>{SITUACAO[s].rotulo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-white d-flex justify-content-between py-3">
          <span className="fw-bold">{filtrados.length} lançamentos</span>
          <span className="fw-semibold text-danger">{brl(total)}</span>
        </div>
        {filtrados.length === 0 ? (
          <div className="card-body text-center text-muted py-5">Nenhum gasto com esses filtros.</div>
        ) : (
          <TabelaLancamentosGastos lancamentos={filtrados} />
        )}
      </div>

      {truncado && (
        <p className="small text-muted mt-2 mb-0">
          <i className="bi bi-info-circle me-1"></i>
          A lista mostra os lançamentos mais recentes; os totais do relatório consideram todos.
        </p>
      )}
    </div>
  );
}
