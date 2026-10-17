import { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { lancarNaFatura } from "../../../api/fatura";
import InputMoeda from "../../../components/InputMoeda";
import { useCacheUtils } from "../../../hooks/useCacheUtils";
import { useFormularioTransacao } from "../../../hooks/useFormularioDespesa";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask } from "../../../utils";
import { useToastStore } from "../../../stores/toast";
import type { FaturaParaModal } from "../../../types/fatura";
import { formatarDataBr, formatarMesAno } from "./faturaUtils";

type Props = {
  fatura: FaturaParaModal;
  tipoInicial: "INCOME" | "EXPENSE";
  valorInicial?: number;
  descricaoInicial?: string;
  onClose: () => void;
};

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Lança um crédito/estorno (abate da fatura) ou uma despesa/ajuste direto nesta fatura,
 * sem depender da data de fechamento do cartão.
 */
export function LancarNaFaturaModal({ fatura, tipoInicial, valorInicial, descricaoInicial, onClose }: Props) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [descricao, setDescricao] = useState(descricaoInicial ?? "");
  const [valor, setValor] = useState(valorInicial ? convertNumberToCurrencyMask(valorInicial) : "");
  const [data, setData] = useState(hoje());
  const [categoriaId, setCategoriaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { categorias } = useFormularioTransacao();
  const { invalidateFaturas, invalidateContas, queryClient } = useCacheUtils();
  const pushToast = useToastStore((s) => s.pushToast);

  const paga = fatura.status !== undefined ? fatura.status === "PAGA" : Boolean(fatura.paga);
  const jaPaga = paga && (fatura.pagamentos?.length ?? 0) > 0;
  const ultimoPagamento = fatura.pagamentos?.[fatura.pagamentos.length - 1]?.data;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      lancarNaFatura(fatura.id, {
        type: tipo,
        amount: convertCurrencyMaskToNumber(valor) ?? 0,
        description: descricao.trim(),
        purchase_date: data,
        category_id: categoriaId ? Number(categoriaId) : null,
      }),
    onSuccess: (resposta) => {
      invalidateFaturas();
      invalidateContas();
      queryClient.invalidateQueries({ queryKey: ["conciliacao"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-painel"] });
      pushToast({ title: "Fatura", message: resposta.message, severity: "success" });
      onClose();
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      setErro(error.response?.data?.message || "Erro ao lançar na fatura.");
    },
  });

  const valido = descricao.trim() !== "" && (convertCurrencyMaskToNumber(valor) ?? 0) > 0;

  return (
    <Modal show onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Lançar na fatura de {formatarMesAno(fatura.reference_month)}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {erro && <div className="alert alert-danger">{erro}</div>}

        <div className="btn-group w-100 mb-3" role="group">
          <button
            type="button"
            className={`btn ${tipo === "INCOME" ? "btn-success" : "btn-outline-success"}`}
            onClick={() => setTipo("INCOME")}
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i>
            Crédito / estorno
          </button>
          <button
            type="button"
            className={`btn ${tipo === "EXPENSE" ? "btn-danger" : "btn-outline-danger"}`}
            onClick={() => setTipo("EXPENSE")}
          >
            <i className="bi bi-plus-circle me-1"></i>
            Despesa / ajuste
          </button>
        </div>

        <p className="small text-muted">
          {tipo === "INCOME"
            ? "Abate do total da fatura (estorno de compra, crédito do banco). Nos relatórios entra como receita."
            : "Soma no total da fatura (juros, IOF, anuidade, compra que faltou)."}
        </p>

        <div className="mb-3">
          <label className="form-label">Descrição</label>
          <input
            type="text"
            className="form-control"
            value={descricao}
            maxLength={255}
            placeholder={tipo === "INCOME" ? "Ex.: Estorno Loja X" : "Ex.: IOF compra internacional"}
            onChange={(e) => setDescricao(e.target.value)}
            autoFocus
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label">Valor</label>
            <InputMoeda value={valor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValor(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label">Data</label>
            <input type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label">Categoria</label>
          <select className="form-select" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categorias.map((c: { id: number; name: string }) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {jaPaga && (fatura.levado_para_proxima ?? 0) > 0 && (
          <div className="alert alert-info small py-2 mt-3 mb-0">
            <i className="bi bi-info-circle me-1"></i>
            Esta fatura foi paga parcialmente: o lançamento muda o saldo levado para a próxima fatura (hoje{" "}
            {convertNumberToCurrencyMask(fatura.levado_para_proxima)}). O que saiu da conta não muda.
          </div>
        )}

        {jaPaga && !((fatura.levado_para_proxima ?? 0) > 0) && (
          <div className="alert alert-warning small py-2 mt-3 mb-0">
            <i className="bi bi-info-circle me-1"></i>
            Esta fatura já está paga: o lançamento entra como pago em {formatarDataBr(ultimoPagamento)} e já altera o saldo
            da conta. Para um estorno que o banco vai descontar na próxima fatura, lance na fatura seguinte.
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button variant={tipo === "INCOME" ? "success" : "danger"} onClick={() => mutate()} disabled={isPending || !valido}>
          {isPending ? "Lançando..." : tipo === "INCOME" ? "Lançar crédito" : "Lançar despesa"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
