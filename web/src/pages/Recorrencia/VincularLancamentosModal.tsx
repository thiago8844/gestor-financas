import { useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  desvincularLancamento,
  getLancamentosCandidatos,
  getLancamentosVinculados,
  vincularLancamentos,
} from "../../api/recorrencias";
import { convertNumberToCurrencyMask } from "../../utils";
import type { LancamentoVinculavel, RecorrenciaTransacao } from "../../types/recorrencia";
import type { Transacao } from "../../types/transacao";

type Props = {
  recorrencia: RecorrenciaTransacao | null;
  onClose: () => void;
};

type Aba = "adicionar" | "vinculados";

/** Data do lançamento em dd/mm/aaaa. Compra de cartão usa a data da compra, não a do vencimento da fatura. */
function dataDoLancamento(l: { purchase_date: string | null; date_raw: string | null; due_date_raw: string | null }) {
  const iso = (l.purchase_date ?? l.date_raw ?? l.due_date_raw ?? "").slice(0, 10);
  if (!iso) return "-";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function origemDoLancamento(l: { cartao: { name: string } | null; conta: { name: string } | null }) {
  return l.cartao ? `Cartão ${l.cartao.name}` : (l.conta?.name ?? "-");
}

export function VincularLancamentosModal({ recorrencia, onClose }: Props) {
  const queryClient = useQueryClient();
  const id = recorrencia?.id ?? 0;
  const [aba, setAba] = useState<Aba>("adicionar");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState<string | null>(null);

  const candidatos = useQuery({
    queryKey: ["recorrencia-candidatos", id],
    queryFn: () => getLancamentosCandidatos(id),
    enabled: !!recorrencia,
  });

  const vinculados = useQuery({
    queryKey: ["recorrencia-vinculados", id],
    queryFn: () => getLancamentosVinculados(id),
    enabled: !!recorrencia,
  });

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["recorrencias"] });
    queryClient.invalidateQueries({ queryKey: ["recorrencia", String(id)] });
    queryClient.invalidateQueries({ queryKey: ["recorrencia-candidatos", id] });
    queryClient.invalidateQueries({ queryKey: ["recorrencia-vinculados", id] });
    queryClient.invalidateQueries({ queryKey: ["relatorio-compromissos-futuros"] });
  };

  const { mutate: vincular, isPending: vinculando } = useMutation({
    mutationFn: (ids: number[]) => vincularLancamentos(id, ids),
    onSuccess: () => {
      setSelecionados(new Set());
      setErro(null);
      atualizar();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setErro(e.response?.data?.message ?? "Erro ao vincular lançamentos. Tente novamente."),
  });

  const { mutate: desvincular, isPending: desvinculando } = useMutation({
    mutationFn: (transacaoId: number) => desvincularLancamento(id, transacaoId),
    onSuccess: atualizar,
    onError: () => setErro("Erro ao remover o vínculo. Tente novamente."),
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = candidatos.data ?? [];
    if (!termo) return lista;
    return lista.filter(
      (l) =>
        (l.description ?? "").toLowerCase().includes(termo) ||
        (l.categoria?.name ?? "").toLowerCase().includes(termo)
    );
  }, [candidatos.data, busca]);

  const totalSelecionado = useMemo(
    () =>
      (candidatos.data ?? [])
        .filter((l) => selecionados.has(l.id))
        .reduce((soma, l) => soma + Number(l.amount ?? 0), 0),
    [candidatos.data, selecionados]
  );

  const todosMarcados = filtrados.length > 0 && filtrados.every((l) => selecionados.has(l.id));

  const alternar = (lancamento: LancamentoVinculavel) => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(lancamento.id)) novo.add(lancamento.id);
      return novo;
    });
  };

  const alternarTodos = () => {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      filtrados.forEach((l) => (todosMarcados ? novo.delete(l.id) : novo.add(l.id)));
      return novo;
    });
  };

  const fechar = () => {
    setSelecionados(new Set());
    setBusca("");
    setErro(null);
    setAba("adicionar");
    onClose();
  };

  const ehVariavel = recorrencia?.amount === null;

  return (
    <Modal show={!!recorrencia} onHide={fechar} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">
          Lançamentos passados de “{recorrencia?.description}”
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="small text-muted mb-3">
          {ehVariavel
            ? "Vincule os lançamentos que já aconteceram. Os valores deles viram o histórico usado para estimar as próximas ocorrências na projeção."
            : "Vincule os lançamentos que já aconteceram. Eles deixam de ser gerados de novo, e a próxima geração segue depois do último vinculado."}
        </p>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link ${aba === "adicionar" ? "active" : ""}`} onClick={() => setAba("adicionar")}>
              Adicionar
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link ${aba === "vinculados" ? "active" : ""}`} onClick={() => setAba("vinculados")}>
              Já vinculados
              {vinculados.data && <span className="badge text-bg-secondary ms-2">{vinculados.data.length}</span>}
            </button>
          </li>
        </ul>

        {erro && <div className="alert alert-danger py-2">{erro}</div>}

        {aba === "adicionar" && (
          <>
            <input
              type="search"
              className="form-control mb-3"
              placeholder="Buscar por descrição ou categoria"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            {candidatos.isLoading && (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status"></div>
              </div>
            )}

            {candidatos.data && filtrados.length === 0 && (
              <div className="text-center text-muted py-4 small">
                {candidatos.data.length === 0
                  ? "Nenhum lançamento passado disponível para vincular."
                  : "Nenhum lançamento encontrado com essa busca."}
              </div>
            )}

            {filtrados.length > 0 && (
              <div className="table-responsive border rounded">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label="Selecionar todos"
                          checked={todosMarcados}
                          onChange={alternarTodos}
                        />
                      </th>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Conta / cartão</th>
                      <th className="text-end">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((l) => (
                      <tr key={l.id} role="button" onClick={() => alternar(l)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selecionados.has(l.id)}
                            onChange={() => alternar(l)}
                          />
                        </td>
                        <td className="text-nowrap">{dataDoLancamento(l)}</td>
                        <td>
                          {l.description || "Sem descrição"}
                          {l.categoria && <div className="small text-muted">{l.categoria.name}</div>}
                        </td>
                        <td className="small text-muted text-nowrap">{origemDoLancamento(l)}</td>
                        <td className={`text-end text-nowrap ${l.type === "INCOME" ? "text-success" : "text-danger"}`}>
                          R$ {convertNumberToCurrencyMask(l.amount)}
                          {l.status === "PENDING" && <div className="small text-muted fw-normal">pendente</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {aba === "vinculados" && (
          <VinculadosLista
            transacoes={vinculados.data ?? []}
            carregando={vinculados.isLoading}
            desvinculando={desvinculando}
            onDesvincular={(tid) => desvincular(tid)}
          />
        )}
      </Modal.Body>

      <Modal.Footer className="justify-content-between">
        {aba === "adicionar" ? (
          <span className="small text-muted">
            {selecionados.size > 0
              ? `${selecionados.size} selecionado(s) · R$ ${convertNumberToCurrencyMask(totalSelecionado)}`
              : "Nenhum lançamento selecionado"}
          </span>
        ) : (
          <span />
        )}

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={fechar}>
            Fechar
          </button>
          {aba === "adicionar" && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={selecionados.size === 0 || vinculando}
              onClick={() => vincular([...selecionados])}
            >
              {vinculando ? (
                <span className="spinner-border spinner-border-sm me-2"></span>
              ) : (
                <i className="bi bi-link-45deg me-2"></i>
              )}
              Vincular {selecionados.size > 0 ? selecionados.size : ""}
            </button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}

function VinculadosLista({
  transacoes,
  carregando,
  desvinculando,
  onDesvincular,
}: {
  transacoes: Transacao[];
  carregando: boolean;
  desvinculando: boolean;
  onDesvincular: (id: number) => void;
}) {
  if (carregando) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  if (transacoes.length === 0) {
    return <div className="text-center text-muted py-4 small">Nenhum lançamento vinculado ainda.</div>;
  }

  return (
    <div className="table-responsive border rounded">
      <table className="table align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th className="text-end">Valor</th>
            <th style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {transacoes.map((t) => (
            <tr key={t.id}>
              <td className="text-nowrap">{dataDoLancamento(t)}</td>
              <td>{t.description || "Sem descrição"}</td>
              <td className="text-end text-nowrap">R$ {convertNumberToCurrencyMask(t.amount ?? 0)}</td>
              <td className="text-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  disabled={desvinculando}
                  onClick={() => onDesvincular(t.id)}
                >
                  <i className="bi bi-link-45deg me-1"></i>
                  Desvincular
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
