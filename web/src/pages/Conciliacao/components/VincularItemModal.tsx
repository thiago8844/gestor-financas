import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import type { Candidato, ErroConciliacao, ItemConciliacao, RevisaoResponse } from "../../../types/conciliacao";
import { dataBr, moeda, valorExtrato } from "../conciliacaoUtils";

type Props = {
  item: ItemConciliacao;
  onVincular: (dados: { chave: string; ajustar_valor?: boolean; ajustar_data?: boolean }) => Promise<RevisaoResponse>;
  onClose: () => void;
};

/**
 * Escolher manualmente o lançamento do app que corresponde à linha. Mostra os mais prováveis
 * (mesmo tipo, data próxima, valor exato primeiro) e permite corrigir valor/data na hora.
 */
export function VincularItemModal({ item, onVincular, onClose }: Props) {
  const [escolhido, setEscolhido] = useState<Candidato | null>(item.candidatos[0] ?? null);
  const [ajustarData, setAjustarData] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const valor = valorExtrato(item.type, item.amount);
  const diferencaValor = escolhido ? Math.abs(escolhido.diferenca) >= 0.005 : false;
  const ehFatura = escolhido?.entrada.origem === "FATURA";

  const vincular = async () => {
    if (!escolhido) return;

    setEnviando(true);
    setErro(null);

    try {
      await onVincular({ chave: escolhido.chave, ajustar_valor: diferencaValor, ajustar_data: ajustarData });
      onClose();
    } catch (e) {
      setErro((e as ErroConciliacao).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h5">Vincular a um lançamento do app</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="border rounded p-2 mb-3 bg-body-tertiary d-flex justify-content-between gap-2">
          <div>
            <div className="small text-muted">{dataBr(item.transaction_date)} · extrato</div>
            <div className="fw-semibold">{item.description}</div>
          </div>
          <div className={`fw-bold text-nowrap ${valor.classe}`}>{valor.texto}</div>
        </div>

        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        {item.candidatos.length === 0 ? (
          <div className="text-center text-muted py-4">
            <i className="bi bi-search fs-2 d-block mb-2"></i>
            Nenhum lançamento livre do mesmo tipo perto dessa data. Use "Lançar agora" para criar.
          </div>
        ) : (
          <div className="list-group">
            {item.candidatos.map((c) => {
              const exato = Math.abs(c.diferenca) < 0.005;

              return (
                <label key={c.chave} className={`list-group-item list-group-item-action d-flex gap-3 align-items-center ${escolhido?.chave === c.chave ? "list-group-item-primary" : ""}`}>
                  <input
                    type="radio"
                    className="form-check-input mt-0"
                    name="candidato"
                    checked={escolhido?.chave === c.chave}
                    onChange={() => {
                      setEscolhido(c);
                      setAjustarData(false);
                    }}
                  />
                  <div className="flex-grow-1">
                    <div className="fw-semibold">
                      {c.entrada.origem === "FATURA" && <i className="bi bi-credit-card me-1"></i>}
                      {c.entrada.description}
                      {c.entrada.transferencia && <span className="badge text-bg-light border ms-2">transferência</span>}
                    </div>
                    <div className="small text-muted">
                      {dataBr(c.entrada.date)}
                      {c.dias > 0 && ` (${c.dias} dia${c.dias > 1 ? "s" : ""} de diferença)`}
                      {c.entrada.categoria && ` · ${c.entrada.categoria}`}
                      {c.entrada.quantidade > 1 && ` · ${c.entrada.quantidade} lançamentos`}
                    </div>
                  </div>
                  <div className="text-end text-nowrap">
                    <div className="fw-semibold">{moeda(c.entrada.amount)}</div>
                    {exato ? (
                      <span className="badge text-bg-success">valor exato</span>
                    ) : (
                      <span className="badge text-bg-warning">
                        {c.diferenca > 0 ? "+" : "−"} {moeda(Math.abs(c.diferenca))}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {escolhido && diferencaValor && (
          <div className={`alert mt-3 mb-0 py-2 small ${ehFatura ? "alert-warning" : "alert-info"}`}>
            {ehFatura ? (
              <>Pagamento de fatura com valor diferente: use "É pagamento de fatura", que ajusta a fatura.</>
            ) : (
              <>
                <i className="bi bi-pencil me-1"></i>
                O valor do lançamento no app será corrigido de {moeda(escolhido.entrada.amount)} para{" "}
                <strong>{moeda(item.amount)}</strong> (o do banco).
              </>
            )}
          </div>
        )}

        {escolhido && escolhido.dias > 0 && (
          <div className="form-check mt-3">
            <input id="ajustar-data" type="checkbox" className="form-check-input" checked={ajustarData} onChange={(e) => setAjustarData(e.target.checked)} />
            <label htmlFor="ajustar-data" className="form-check-label small">
              Mover a data do lançamento de {dataBr(escolhido.entrada.date)} para {dataBr(item.transaction_date)} (a do banco)
            </label>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={vincular} disabled={enviando || !escolhido || (diferencaValor && ehFatura)}>
          {enviando ? "Vinculando..." : diferencaValor ? "Corrigir valor e vincular" : "Vincular"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
