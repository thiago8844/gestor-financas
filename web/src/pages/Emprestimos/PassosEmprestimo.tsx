import { Controller, type UseFormReturn } from "react-hook-form";
import InputMoeda from "../../components/InputMoeda";
import { FieldError } from "../../components/FieldError";
import { convertCurrencyMaskToNumber } from "../../utils";
import {
  FREQUENCIAS,
  MODALIDADES,
  diaDaData,
  formatarMoeda,
  jurosPrimeiroMes,
  parseDecimal,
} from "../../utils/emprestimo";
import type { EmprestimoFormValues } from "../../schemas/emprestimo";
import type { Conta } from "../../types/conta";

type PassoProps = { form: UseFormReturn<EmprestimoFormValues>; contas?: Conta[] };

const msg = (erro: unknown) => (erro as { message?: string } | undefined)?.message;

/** Passo 1 — quem e quanto. */
export function PassoPessoa({ form, contas = [] }: PassoProps) {
  const { register, watch, setValue, control, formState: { errors } } = form;
  const direcao = watch("direction");
  const movimentar = watch("movimentar_conta");
  const tomado = direcao === "TOMADO";

  return (
    <div className="row g-4">
      <div className="col-12">
        <label className="form-label d-block">O que aconteceu?</label>
        <div className="row g-2">
          {[
            { valor: "CONCEDIDO", titulo: "Eu emprestei", texto: "Emprestei dinheiro para alguém e vou receber de volta.", icone: "bi-arrow-down-left-circle", cor: "success" },
            { valor: "TOMADO", titulo: "Eu peguei emprestado", texto: "Peguei dinheiro emprestado e vou pagar de volta.", icone: "bi-arrow-up-right-circle", cor: "danger" },
          ].map((o) => (
            <div key={o.valor} className="col-12 col-md-6">
              <input
                type="radio"
                className="btn-check"
                id={`direcao-${o.valor}`}
                checked={direcao === o.valor}
                onChange={() => setValue("direction", o.valor as EmprestimoFormValues["direction"])}
              />
              <label className={`btn btn-outline-${o.cor} w-100 text-start p-3`} htmlFor={`direcao-${o.valor}`}>
                <i className={`bi ${o.icone} fs-4 me-2 align-middle`}></i>
                <strong>{o.titulo}</strong>
                <small className="d-block mt-1 opacity-75">{o.texto}</small>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label" htmlFor="counterparty">
          {tomado ? "Quem te emprestou?" : "Para quem você emprestou?"} <span className="text-danger">*</span>
        </label>
        <input id="counterparty" className="form-control" placeholder={tomado ? "Pessoa ou banco" : "Nome da pessoa"} {...register("counterparty")} />
        <FieldError>{msg(errors.counterparty)}</FieldError>
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label" htmlFor="principal">Valor emprestado <span className="text-danger">*</span></label>
        <Controller name="principal" control={control} render={({ field }) => <InputMoeda id="principal" {...field} placeholder="0,00" />} />
        <FieldError>{msg(errors.principal)}</FieldError>
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label" htmlFor="contract_date">Data do empréstimo <span className="text-danger">*</span></label>
        <input id="contract_date" type="date" className="form-control" {...register("contract_date")} />
        <FieldError>{msg(errors.contract_date)}</FieldError>
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label" htmlFor="description">Descrição <small className="text-muted">(opcional)</small></label>
        <input id="description" className="form-control" placeholder="Ex.: reforma do apartamento" {...register("description")} />
      </div>

      <div className="col-12">
        <div className="border rounded p-3">
          <div className="form-check form-switch mb-0">
            <input id="movimentar" type="checkbox" role="switch" className="form-check-input" {...register("movimentar_conta")} />
            <label htmlFor="movimentar" className="form-check-label">
              {tomado ? "Lançar a entrada desse dinheiro na minha conta" : "Lançar a saída desse dinheiro da minha conta"}
            </label>
            <small className="text-muted d-block">
              Mantém o saldo da conta correto. Deixe desligado se o dinheiro já está nos seus lançamentos.
            </small>
          </div>

          <div className="mt-3">
            <label className="form-label" htmlFor="account_id">
              {movimentar ? "Conta" : "Conta padrão dos pagamentos"} {movimentar && <span className="text-danger">*</span>}
            </label>
            <select id="account_id" className="form-select" {...register("account_id")}>
              <option value="">Selecione</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <small className="text-muted">
              {tomado ? "De onde sai" : "Onde entra"} o dinheiro de cada parcela. Dá para trocar na hora de registrar.
            </small>
            <div><FieldError>{msg(errors.account_id)}</FieldError></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Passo 2 — modalidade e juros. */
export function PassoCondicoes({ form }: PassoProps) {
  const { register, watch, setValue, formState: { errors } } = form;
  const modalidade = watch("modality");
  const tipo = watch("interest_type");
  const periodo = watch("rate_period");
  const principal = convertCurrencyMaskToNumber(watch("principal")) ?? 0;
  const taxa = parseDecimal(watch("rate")) ?? 0;
  const exemplo = jurosPrimeiroMes(principal, taxa, periodo, tipo);

  return (
    <div className="row g-4">
      <div className="col-12">
        <label className="form-label d-block">Como será pago?</label>
        <div className="row g-2">
          {MODALIDADES.map((m) => (
            <div key={m.valor} className="col-12 col-md-6">
              <input
                type="radio"
                className="btn-check"
                id={`modalidade-${m.valor}`}
                checked={modalidade === m.valor}
                onChange={() => setValue("modality", m.valor)}
              />
              <label className="btn btn-outline-primary w-100 text-start p-3 h-100" htmlFor={`modalidade-${m.valor}`}>
                <i className={`bi ${m.icone} me-2`}></i>
                <strong>{m.titulo}</strong>
                <small className="d-block mt-1 opacity-75">{m.descricao}</small>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="col-12">
        <label className="form-label d-block">Juros</label>
        <div className="btn-group" role="group" aria-label="Tipo de juros">
          {[
            { valor: "SIMPLES", label: "Juros simples" },
            { valor: "COMPOSTO", label: "Juros compostos" },
            { valor: "SEM_JUROS", label: "Sem juros" },
          ].map((o) => (
            <button
              key={o.valor}
              type="button"
              className={`btn ${tipo === o.valor ? "btn-primary" : "btn-outline-primary"}`}
              aria-pressed={tipo === o.valor}
              onClick={() => setValue("interest_type", o.valor as EmprestimoFormValues["interest_type"])}
            >
              {o.label}
            </button>
          ))}
        </div>
        <small className="text-muted d-block mt-2">
          {tipo === "SIMPLES" && "Os juros incidem sempre sobre o valor que ainda se deve, sem juros sobre juros."}
          {tipo === "COMPOSTO" && "Os juros de um período entram na base de cálculo do próximo (juros sobre juros)."}
          {tipo === "SEM_JUROS" && "Devolve exatamente o valor emprestado."}
        </small>
      </div>

      {tipo !== "SEM_JUROS" && (
        <div className="col-12 col-md-8 col-lg-6">
          <label className="form-label" htmlFor="rate">Taxa <span className="text-danger">*</span></label>
          <div className="input-group">
            <input id="rate" inputMode="decimal" className="form-control" placeholder="2" {...register("rate")} />
            <span className="input-group-text">%</span>
            <select className="form-select" aria-label="Período da taxa" {...register("rate_period")}>
              <option value="MES">ao mês</option>
              <option value="ANO">ao ano</option>
              <option value="DIA">ao dia</option>
            </select>
          </div>
          <FieldError>{msg(errors.rate)}</FieldError>
          {exemplo > 0 && (
            <small className="text-muted d-block mt-1">
              Exemplo: {formatarMoeda(principal)} a {String(taxa).replace(".", ",")}% rendem cerca de <strong>{formatarMoeda(exemplo)}</strong> de juros no primeiro mês.
            </small>
          )}
          {tipo === "COMPOSTO" && (modalidade === "JUROS_PERIODICOS" || modalidade === "PRICE" || modalidade === "SAC") && (
            <small className="text-muted d-block mt-1">
              Como os juros são pagos a cada parcela, a diferença para juros simples aparece só na conversão da taxa (ex.: ao ano para ao mês). No pagamento único, os juros se acumulam.
            </small>
          )}
        </div>
      )}
    </div>
  );
}

/** Passo 3 — datas, parcelas e prévia (a prévia é renderizada pela página). */
export function PassoVencimentos({ form }: PassoProps) {
  const { register, watch, formState: { errors } } = form;
  const modalidade = watch("modality");
  const frequencia = watch("frequency");
  const primeiraData = watch("first_due_date");
  const prazoAberto = watch("prazo_aberto");
  const dia = diaDaData(primeiraData);

  if (modalidade === "LIVRE") return <ParcelasLivres form={form} />;

  const unico = modalidade === "PAGAMENTO_UNICO";

  return (
    <div className="row g-4">
      <div className="col-12 col-md-6">
        <label className="form-label" htmlFor="first_due_date">
          {unico ? "Data do pagamento" : "Primeiro vencimento"} <span className="text-danger">*</span>
        </label>
        <input id="first_due_date" type="date" className="form-control" {...register("first_due_date")} />
        <FieldError>{msg(errors.first_due_date)}</FieldError>
        {!unico && frequencia === "MENSAL" && dia && (
          <small className="text-muted d-block mt-1">As próximas parcelas vencem todo dia {dia}.</small>
        )}
      </div>

      {!unico && (
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="frequency">Frequência</label>
          <select id="frequency" className="form-select" {...register("frequency")}>
            {FREQUENCIAS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {!unico && frequencia === "MENSAL" && dia !== null && dia > 28 && (
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="due_day_adjustment">Em meses sem o dia {dia}</label>
          <select id="due_day_adjustment" className="form-select" {...register("due_day_adjustment")}>
            <option value="ULTIMO_DIA_MES">Vence no último dia do mês</option>
            <option value="PROXIMO_DIA">Vence no dia 1º do mês seguinte</option>
            <option value="ULTIMO_DIA_UTIL">Vence no último dia útil</option>
          </select>
        </div>
      )}

      {!unico && (
        <div className="col-12">
          {modalidade === "JUROS_PERIODICOS" && (
            <div className="form-check form-switch mb-3">
              <input id="prazo_aberto" type="checkbox" role="switch" className="form-check-input" {...register("prazo_aberto")} />
              <label htmlFor="prazo_aberto" className="form-check-label">Sem prazo final</label>
              <small className="text-muted d-block">
                Cobra só os juros todo período até você definir a data de devolução do valor emprestado.
              </small>
            </div>
          )}

          {!(modalidade === "JUROS_PERIODICOS" && prazoAberto) && (
            <div style={{ maxWidth: 240 }}>
              <label className="form-label" htmlFor="installments">Número de parcelas <span className="text-danger">*</span></label>
              <input id="installments" type="number" min={1} max={600} inputMode="numeric" className="form-control" {...register("installments")} />
              <FieldError>{msg(errors.installments)}</FieldError>
            </div>
          )}
        </div>
      )}

      {(modalidade === "PRICE" || modalidade === "SAC") && (
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="grace">Carência <small className="text-muted">(parcelas pagando só juros no início)</small></label>
          <input id="grace" type="number" min={0} inputMode="numeric" className="form-control" style={{ maxWidth: 160 }} {...register("grace_installments")} />
          <FieldError>{msg(errors.grace_installments)}</FieldError>
        </div>
      )}

      <div className="col-12">
        <label className="form-label" htmlFor="notes">Observações <small className="text-muted">(opcional)</small></label>
        <textarea id="notes" rows={2} className="form-control" {...register("notes")} />
      </div>
    </div>
  );
}

function ParcelasLivres({ form }: PassoProps) {
  const { watch, setValue, formState: { errors } } = form;
  const linhas = watch("custom_installments");
  const principal = convertCurrencyMaskToNumber(watch("principal")) ?? 0;
  const soma = linhas.reduce((t, l) => t + (convertCurrencyMaskToNumber(l.principal_amount) ?? 0), 0);
  const falta = Math.round((principal - soma) * 100) / 100;

  const atualizar = (indice: number, campo: "due_date" | "principal_amount" | "interest_amount", valor: string) =>
    setValue("custom_installments", linhas.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)), { shouldDirty: true });

  return (
    <div>
      <p className="text-muted">Informe a data e o valor de cada parcela. A soma do principal precisa ser igual ao valor emprestado.</p>

      {linhas.map((l, i) => (
        <div key={i} className="row g-2 align-items-end mb-2">
          <div className="col-12 col-md-4">
            {i === 0 && <label className="form-label">Vencimento</label>}
            <input type="date" className="form-control" aria-label={`Vencimento da parcela ${i + 1}`} value={l.due_date} onChange={(e) => atualizar(i, "due_date", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            {i === 0 && <label className="form-label">Principal</label>}
            <InputMoeda aria-label={`Principal da parcela ${i + 1}`} value={l.principal_amount} onChange={(e) => atualizar(i, "principal_amount", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            {i === 0 && <label className="form-label">Juros</label>}
            <InputMoeda aria-label={`Juros da parcela ${i + 1}`} value={l.interest_amount} onChange={(e) => atualizar(i, "interest_amount", e.target.value)} />
          </div>
          <div className="col-12 col-md-2">
            <button type="button" className="btn btn-outline-danger w-100" onClick={() => setValue("custom_installments", linhas.filter((_, j) => j !== i))} aria-label={`Remover parcela ${i + 1}`}>
              <i className="bi bi-trash"></i>
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-outline-primary mt-2" onClick={() => setValue("custom_installments", [...linhas, { due_date: "", principal_amount: "", interest_amount: "" }])}>
        <i className="bi bi-plus-circle me-2"></i>
        Adicionar parcela
      </button>

      <div className="mt-3">
        <small className={Math.abs(falta) < 0.01 && linhas.length > 0 ? "text-success" : "text-muted"}>
          Principal informado: {formatarMoeda(soma)} de {formatarMoeda(principal)}
          {Math.abs(falta) >= 0.01 && linhas.length > 0 && ` (${falta > 0 ? "faltam" : "passa"} ${formatarMoeda(Math.abs(falta))})`}
        </small>
        <div><FieldError>{msg(errors.custom_installments)}</FieldError></div>
      </div>
    </div>
  );
}
