import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import InputMoeda from "../../../components/InputMoeda";
import { ajustarEmprestimo, simularAjuste } from "../../../api/emprestimos";
import { getContas } from "../../../api/conta";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useInvalidarEmprestimos } from "../../../hooks/useInvalidarEmprestimos";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask, mensagemErroApi } from "../../../utils";
import { aceitaAjuste, formatarDataBr, formatarMoeda, frasesDeJuros, hojeISO } from "../../../utils/emprestimo";
import { toast } from "../../../utils/toast";
import type { Conta } from "../../../types/conta";
import type { AjustePayload, Emprestimo, ModoAjuste, TipoAjuste } from "../../../types/emprestimo";

type Opcao = "AMORTIZAR" | "QUITAR" | "AUMENTAR";

/**
 * Amortização extra (o devedor abate parte do principal), quitação antecipada e aumento do
 * empréstimo. Mostra o efeito antes de confirmar.
 */
export function AjustarContrato({ emprestimo, onConcluido }: { emprestimo: Emprestimo; onConcluido?: () => void }) {
  const invalidar = useInvalidarEmprestimos();
  const tomado = emprestimo.direction === "TOMADO";

  const [opcao, setOpcao] = useState<Opcao>("AMORTIZAR");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [modo, setModo] = useState<ModoAjuste>("MANTER_PRAZO");
  const [parcelas, setParcelas] = useState("");
  const [contaId, setContaId] = useState(emprestimo.account_id ? String(emprestimo.account_id) : "");
  const [movimentar, setMovimentar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const tipo: TipoAjuste = opcao === "AUMENTAR" ? "AUMENTO" : "AMORTIZACAO";
  const permitido = aceitaAjuste(emprestimo, tipo);
  const amortizaOuAumenta = emprestimo.modality === "PRICE" || emprestimo.modality === "SAC";

  const { data: contas } = useQuery({ queryKey: ["contas", "active"], queryFn: () => getContas({ active: true }) });

  // Saldo que ainda dá para amortizar na data escolhida (para o botão "quitar tudo").
  const saldo = useQuery({
    queryKey: ["emprestimo", emprestimo.id, "saldo-ajuste", data],
    queryFn: () => simularAjuste(emprestimo.id, { type: "AMORTIZACAO", amount: 0.01, date: data }),
    enabled: aceitaAjuste(emprestimo, "AMORTIZACAO") && !!data,
    retry: false,
  });
  const saldoAmortizavel = saldo.data?.balance_before ?? null;

  const valorNumerico = opcao === "QUITAR" ? (saldoAmortizavel ?? 0) : (convertCurrencyMaskToNumber(valor) ?? 0);
  const numeroParcelas = Number(parcelas) > 0 ? Number(parcelas) : null;

  const payload: AjustePayload | null =
    permitido && valorNumerico > 0 && data
      ? {
          type: tipo,
          amount: valorNumerico,
          date: data,
          mode: amortizaOuAumenta ? modo : undefined,
          installments: tipo === "AUMENTO" ? numeroParcelas : null,
          account_id: contaId ? Number(contaId) : null,
          movimentar_conta: tipo === "AUMENTO" ? movimentar : true,
        }
      : null;

  // Debounce sobre texto: com um objeto novo a cada render o timer nunca assentaria.
  const chave = useDebouncedValue(payload ? JSON.stringify(payload) : null);
  const payloadSimulacao = useMemo(() => (chave ? (JSON.parse(chave) as AjustePayload) : null), [chave]);

  const simulacao = useQuery({
    queryKey: ["emprestimo-simulacao", emprestimo.id, payloadSimulacao],
    queryFn: ({ signal }) => simularAjuste(emprestimo.id, payloadSimulacao!, signal),
    enabled: payloadSimulacao !== null,
    placeholderData: (anterior) => anterior,
    retry: false,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => ajustarEmprestimo(emprestimo.id, payload!),
    onSuccess: () => {
      invalidar();
      toast.success(tipo === "AMORTIZACAO" ? "Amortização registrada" : "Empréstimo aumentado", {
        message: "As parcelas foram recalculadas.",
      });
      setValor("");
      setErro(null);
      onConcluido?.();
    },
    onError: (e) => setErro(mensagemErroApi(e, "Não foi possível registrar o ajuste.")),
  });

  const r = payloadSimulacao ? simulacao.data : undefined;
  const erroSimulacao = simulacao.isError ? mensagemErroApi(simulacao.error, "Não foi possível simular.") : null;
  const podeConfirmar = !!payload && (!!contaId || (tipo === "AUMENTO" && !movimentar));

  if (emprestimo.status === "CANCELADO") {
    return <p className="text-muted">Este empréstimo foi cancelado e não aceita mais ajustes.</p>;
  }

  if (!["JUROS_PERIODICOS", "PRICE", "SAC"].includes(emprestimo.modality)) {
    return (
      <p className="text-muted">
        Amortização e aumento estão disponíveis para empréstimos de juros periódicos, Price e SAC. Neste contrato, as parcelas são fixas.
      </p>
    );
  }

  return (
    <div className="row g-4">
      <div className="col-12 col-lg-6">
        <div className="btn-group w-100 mb-3" role="group" aria-label="Tipo de ajuste">
          {([
            ["AMORTIZAR", tomado ? "Pagar adiantado" : "Recebi adiantado"],
            ["QUITAR", "Quitar tudo"],
            ["AUMENTAR", "Emprestar mais"],
          ] as [Opcao, string][]).map(([chaveOpcao, label]) => (
            <button
              key={chaveOpcao}
              type="button"
              className={`btn ${opcao === chaveOpcao ? "btn-primary" : "btn-outline-primary"}`}
              aria-pressed={opcao === chaveOpcao}
              onClick={() => { setOpcao(chaveOpcao); setErro(null); }}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-muted small">
          {opcao === "AMORTIZAR" && (tomado
            ? "Pague uma parte do valor que deve antes do prazo. O saldo cai e os juros das próximas parcelas diminuem."
            : "O devedor quitou parte do valor emprestado. O saldo cai e os juros das próximas parcelas diminuem.")}
          {opcao === "QUITAR" && "Quita todo o saldo que ainda falta, com os juros proporcionais ao período em andamento, e encerra as parcelas futuras."}
          {opcao === "AUMENTAR" && (tomado
            ? "Pegar mais dinheiro emprestado no mesmo contrato. O saldo aumenta e as próximas parcelas são recalculadas."
            : "Emprestar mais dinheiro à mesma pessoa no mesmo contrato. O saldo aumenta e as próximas parcelas são recalculadas.")}
        </p>

        {!permitido && <div className="alert alert-warning">Este contrato não aceita esse tipo de ajuste agora.</div>}
        {erro && <div className="alert alert-danger">{erro}</div>}

        {opcao !== "QUITAR" ? (
          <div className="mb-3">
            <label className="form-label" htmlFor="ajusteValor">
              {opcao === "AMORTIZAR" ? (tomado ? "Quanto você vai pagar do principal" : "Quanto foi quitado do principal") : "Valor a mais"}
            </label>
            <InputMoeda id="ajusteValor" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            {opcao === "AMORTIZAR" && saldoAmortizavel !== null && (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setValor(convertNumberToCurrencyMask(saldoAmortizavel))}>
                Usar o saldo todo ({formatarMoeda(saldoAmortizavel)})
              </button>
            )}
          </div>
        ) : (
          <div className="mb-3">
            <small className="text-muted d-block">Saldo a quitar</small>
            <span className="fs-4 fw-semibold">{saldoAmortizavel !== null ? formatarMoeda(saldoAmortizavel) : "..."}</span>
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label" htmlFor="ajusteData">Data</label>
            <input id="ajusteData" type="date" className="form-control" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="col-6">
            <label className="form-label" htmlFor="ajusteConta">
              {opcao === "AUMENTAR" ? (tomado ? "Entrou na conta" : "Saiu da conta") : (tomado ? "Saiu da conta" : "Entrou na conta")}
            </label>
            <select id="ajusteConta" className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
              <option value="">Selecione</option>
              {(contas?.data ?? []).map((c: Conta) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {amortizaOuAumenta && opcao !== "QUITAR" && (
          <fieldset className="mb-3">
            <legend className="form-label fs-6">O que muda nas parcelas?</legend>
            {([
              ["MANTER_PRAZO", "Parcelas menores", opcao === "AMORTIZAR" ? "Mesmo número de parcelas, com valor menor." : "Mesmo número de parcelas, com valor maior."],
              ["MANTER_PARCELA", "Prazo diferente", opcao === "AMORTIZAR" ? "Parcelas do mesmo valor, terminando antes." : "Parcelas do mesmo valor, terminando depois."],
            ] as [ModoAjuste, string, string][]).map(([v, titulo, texto]) => (
              <div className="form-check" key={v}>
                <input id={`modo-${v}`} type="radio" className="form-check-input" checked={modo === v} onChange={() => setModo(v)} />
                <label htmlFor={`modo-${v}`} className="form-check-label">
                  {titulo} <small className="text-muted d-block">{texto}</small>
                </label>
              </div>
            ))}
          </fieldset>
        )}

        {opcao === "AUMENTAR" && (
          <>
            <div className="mb-3" style={{ maxWidth: 260 }}>
              <label className="form-label" htmlFor="ajusteParcelas">Pagar em quantas parcelas? <small className="text-muted">(opcional)</small></label>
              <input id="ajusteParcelas" type="number" min={1} max={600} className="form-control" value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="Manter as atuais" />
            </div>
            <div className="form-check form-switch mb-3">
              <input id="ajusteMovimentar" type="checkbox" role="switch" className="form-check-input" checked={movimentar} onChange={(e) => setMovimentar(e.target.checked)} />
              <label htmlFor="ajusteMovimentar" className="form-check-label">
                Lançar {tomado ? "a entrada" : "a saída"} desse dinheiro na conta
              </label>
            </div>
          </>
        )}
      </div>

      <div className="col-12 col-lg-6">
        <div className="border rounded p-3" style={{ opacity: simulacao.isFetching ? 0.6 : 1 }}>
          <h6 className="fw-bold">Como vai ficar</h6>

          {erroSimulacao ? (
            <div className="alert alert-warning mb-0">{erroSimulacao}</div>
          ) : !r ? (
            <p className="text-muted mb-0">Informe o valor para ver o efeito nas parcelas.</p>
          ) : (
            <>
              <dl className="row mb-3">
                <dt className="col-6 fw-normal text-muted">{tipo === "AMORTIZACAO" ? (tomado ? "Você paga agora" : "Você recebe agora") : (tomado ? "Você recebe agora" : "Você empresta agora")}</dt>
                <dd className="col-6 text-end fw-semibold">{formatarMoeda(r.amount_to_post)}</dd>
                {r.accrued_interest > 0 && (
                  <>
                    <dt className="col-6 fw-normal text-muted">Juros proporcionais</dt>
                    <dd className="col-6 text-end">{formatarMoeda(r.accrued_interest)}</dd>
                  </>
                )}
                <dt className="col-6 fw-normal text-muted">Saldo</dt>
                <dd className="col-6 text-end">{formatarMoeda(r.balance_before)} → <strong>{formatarMoeda(r.balance_after)}</strong></dd>
                {r.next_amount_after !== null && (
                  <>
                    <dt className="col-6 fw-normal text-muted">Próxima parcela</dt>
                    <dd className="col-6 text-end">{r.next_amount_before !== null ? `${formatarMoeda(r.next_amount_before)} → ` : ""}<strong>{formatarMoeda(r.next_amount_after)}</strong></dd>
                  </>
                )}
                <dt className="col-6 fw-normal text-muted">Parcelas restantes</dt>
                <dd className="col-6 text-end">{r.installments_before} → <strong>{r.installments_after}</strong></dd>
                {r.end_date_after && (
                  <>
                    <dt className="col-6 fw-normal text-muted">Última parcela</dt>
                    <dd className="col-6 text-end">{r.end_date_before ? `${formatarDataBr(r.end_date_before)} → ` : ""}<strong>{formatarDataBr(r.end_date_after)}</strong></dd>
                  </>
                )}
              </dl>
              <p className={`mb-3 ${r.interest_difference > 0 ? "text-success" : "text-muted"}`}>
                <i className="bi bi-piggy-bank me-2"></i>
                {frasesDeJuros(r.interest_difference)}
              </p>
            </>
          )}

          <button type="button" className="btn btn-success w-100" disabled={!r || !podeConfirmar || isPending || !!erroSimulacao} onClick={() => mutate()}>
            {isPending ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Salvando...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-2"></i>
                {opcao === "AUMENTAR" ? "Confirmar aumento" : opcao === "QUITAR" ? "Confirmar quitação" : "Confirmar amortização"}
              </>
            )}
          </button>
          {!contaId && !(tipo === "AUMENTO" && !movimentar) && payload && (
            <small className="text-muted d-block mt-2">Escolha a conta para confirmar.</small>
          )}
        </div>
      </div>
    </div>
  );
}
