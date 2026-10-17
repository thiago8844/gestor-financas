import { useState } from "react";
import { Link } from "react-router-dom";
import type { EntradaRazao } from "../../../types/conciliacao";
import { dataBr, linkEdicao, valorExtrato } from "../conciliacaoUtils";

type Props = {
  entradas: EntradaRazao[];
  editavel: boolean;
  ocupado: boolean;
  onManter: (chaves: string[]) => void;
  onPendente: (chave: string) => void;
};

/**
 * Pago no app, dentro do mês, mas sem linha no extrato. Quase sempre é engano (conta errada, data
 * errada, marcado como pago sem ter pago). Corrija pela tela normal e clique em Reconferir, ou
 * confirme que está certo.
 */
export function SoNoAppLista({ entradas, editavel, ocupado, onManter, onPendente }: Props) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  if (entradas.length === 0) {
    return (
      <div className="text-center text-muted py-5">
        <i className="bi bi-check2-all fs-1 d-block mb-2 text-success"></i>
        Tudo que está pago no app neste mês aparece no extrato.
      </div>
    );
  }

  const alternar = (chave: string) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });

  return (
    <div>
      <div className="alert alert-light border small">
        <i className="bi bi-question-circle me-1"></i>
        Estes lançamentos estão <strong>pagos no app</strong> neste mês, nesta conta, mas não aparecem no extrato. Corrija
        o que estiver errado (editar, voltar para pendente) e use <strong>Reconferir</strong>, ou confirme os que estão
        certos (ex.: o banco só debita no mês seguinte).
      </div>

      {editavel && selecionadas.size > 0 && (
        <div className="d-flex align-items-center gap-2 mb-2">
          <span className="small text-muted">{selecionadas.size} selecionado(s)</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            disabled={ocupado}
            onClick={() => {
              onManter([...selecionadas]);
              setSelecionadas(new Set());
            }}
          >
            <i className="bi bi-check2 me-1"></i>Estão certos
          </button>
        </div>
      )}

      <div className="d-flex flex-column gap-2">
        {entradas.map((e) => {
          const valor = valorExtrato(e.type, e.amount);
          const lancamento = e.origem === "TRANSACAO";

          return (
            <div key={e.chave} className="card shadow-sm" style={{ borderLeft: "4px solid var(--bs-orange)" }}>
              <div className="card-body py-2 px-3 d-flex flex-wrap gap-2 align-items-center">
                {editavel && (
                  <input type="checkbox" className="form-check-input mt-0" checked={selecionadas.has(e.chave)} onChange={() => alternar(e.chave)} />
                )}
                <div className="text-muted small text-nowrap" style={{ width: 78 }}>
                  {dataBr(e.date)}
                </div>
                <div className="flex-grow-1" style={{ minWidth: 160 }}>
                  <div className="fw-semibold">
                    {e.origem === "FATURA" && <i className="bi bi-credit-card me-1"></i>}
                    {e.description}
                    {e.transferencia && <span className="badge text-bg-light border ms-2">transferência</span>}
                  </div>
                  <div className="small text-muted">
                    {e.categoria ?? (e.origem === "FATURA" ? `${e.quantidade} lançamento(s) da fatura` : "Sem categoria")}
                  </div>
                </div>
                <div className={`fw-bold text-nowrap ${valor.classe}`}>{valor.texto}</div>
                {editavel && (
                  <div className="d-flex flex-wrap gap-1 w-100 ps-md-5 ms-md-4">
                    {lancamento && !e.transferencia && (
                      <Link to={linkEdicao(e.chave, e.type)} className="btn btn-sm btn-outline-secondary">
                        <i className="bi bi-pencil me-1"></i>Editar
                      </Link>
                    )}
                    {e.transferencia && (
                      <Link to="/transferencias" className="btn btn-sm btn-outline-secondary">
                        <i className="bi bi-arrow-left-right me-1"></i>Ver transferências
                      </Link>
                    )}
                    {!lancamento && (
                      <Link to="/cartoes" className="btn btn-sm btn-outline-secondary">
                        <i className="bi bi-credit-card me-1"></i>Ver fatura
                      </Link>
                    )}
                    {lancamento && !e.transferencia && (
                      <button type="button" className="btn btn-sm btn-outline-warning" disabled={ocupado} onClick={() => onPendente(e.chave)}>
                        <i className="bi bi-hourglass me-1"></i>Não foi pago (voltar p/ pendente)
                      </button>
                    )}
                    <button type="button" className="btn btn-sm btn-outline-success" disabled={ocupado} onClick={() => onManter([e.chave])}>
                      <i className="bi bi-check2 me-1"></i>Está certo
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
