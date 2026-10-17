import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import type { ErroConciliacao, ItemConciliacao, RevisaoResponse } from "../../../types/conciliacao";
import { dataBr, valorExtrato } from "../conciliacaoUtils";

type Dados = { description?: string; category_id?: number | null; category_name?: string; budget_id?: number | null };

export type TrocaDeDecisao = "transferencia" | "fatura" | "adiar" | "ignorar";

type Props = {
  item: ItemConciliacao;
  restantes: number;
  emSequencia: boolean;
  podeSerFatura: boolean;
  onSequenciaChange: (v: boolean) => void;
  onLancar: (dados: Dados) => Promise<RevisaoResponse>;
  /** "Não é uma despesa comum": troca para outra decisão sem sair da sequência. */
  onTrocar: (tipo: TrocaDeDecisao) => void;
  onClose: () => void;
};

/**
 * "Lançar agora": cria no app, já pago, na data e valor do banco, o que só estava no extrato.
 * Com "em sequência", ao salvar já abre a próxima linha sem correspondência — dá para passar
 * o mês inteiro só com teclado (Enter salva).
 */
export function LancarItemModal({ item, restantes, emSequencia, podeSerFatura, onSequenciaChange, onLancar, onTrocar, onClose }: Props) {
  const { categorias, orcamentos } = useFormularioTransacao();
  const [descricao, setDescricao] = useState(item.description ?? "");
  const [categoriaId, setCategoriaId] = useState("");
  const [novaCategoria, setNovaCategoria] = useState("");
  const [orcamentoId, setOrcamentoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const valor = valorExtrato(item.type, item.amount);

  const salvar = async () => {
    setEnviando(true);
    setErro(null);

    try {
      await onLancar({
        description: descricao.trim() || undefined,
        category_id: categoriaId && categoriaId !== "nova" ? Number(categoriaId) : null,
        category_name: categoriaId === "nova" && novaCategoria.trim() ? novaCategoria.trim() : undefined,
        budget_id: orcamentoId ? Number(orcamentoId) : null,
      });
    } catch (e) {
      setErro((e as ErroConciliacao).message);
    } finally {
      setEnviando(false);
    }
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !enviando) {
      e.preventDefault();
      salvar();
    }
  };

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">
          Lançar {item.type === "EXPENSE" ? "despesa" : "receita"} no app
        </Modal.Title>
      </Modal.Header>
      <Modal.Body onKeyDown={aoTeclar}>
        <div className="border rounded p-2 mb-3 bg-body-tertiary d-flex justify-content-between gap-2">
          <div>
            <div className="small text-muted">{dataBr(item.transaction_date)} · extrato</div>
            <div className="fw-semibold">{item.description}</div>
          </div>
          <div className={`fw-bold text-nowrap ${valor.classe}`}>{valor.texto}</div>
        </div>

        <div className="small text-muted mb-3 d-flex flex-wrap align-items-center gap-1">
          <span>Não é {item.type === "EXPENSE" ? "uma despesa" : "uma receita"} comum?</span>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onTrocar("transferencia")}>
            É transferência
          </button>
          {podeSerFatura && (
            <>
              <span>·</span>
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onTrocar("fatura")}>
                É pagamento de fatura
              </button>
            </>
          )}
          <span>·</span>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onTrocar("adiar")}>
            Lançar depois
          </button>
          <span>·</span>
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => onTrocar("ignorar")}>
            Ignorar
          </button>
        </div>

        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        <div className="mb-3">
          <label className="form-label">Descrição no app</label>
          <input
            type="text"
            className="form-control"
            value={descricao}
            maxLength={255}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categorias.map((c: { id: number; name: string }) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="nova">+ Nova categoria...</option>
            </select>
            {categoriaId === "nova" && (
              <input
                type="text"
                className="form-control mt-2"
                placeholder="Nome da nova categoria"
                maxLength={100}
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
              />
            )}
          </div>
          {item.type === "EXPENSE" && orcamentos.length > 0 && (
            <div className="col-12 col-md-6">
              <label className="form-label">Orçamento</label>
              <select className="form-select" value={orcamentoId} onChange={(e) => setOrcamentoId(e.target.value)}>
                <option value="">Sem orçamento</option>
                {orcamentos.map((o: { id: number; name: string }) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <p className="small text-muted mt-3 mb-0">
          Entra como pago em {dataBr(item.transaction_date)}, na conta desta conciliação, e já fica conferido.
        </p>
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <div className="form-check form-switch m-0">
          <input
            id="lancar-sequencia"
            type="checkbox"
            role="switch"
            className="form-check-input"
            checked={emSequencia}
            onChange={(e) => onSequenciaChange(e.target.checked)}
          />
          <label htmlFor="lancar-sequencia" className="form-check-label small">
            Abrir a próxima ao salvar {restantes > 0 && <span className="text-muted">({restantes} restantes)</span>}
          </label>
        </div>
        <div className="d-flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="success" onClick={salvar} disabled={enviando}>
            {enviando ? "Salvando..." : "Lançar e conferir"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
