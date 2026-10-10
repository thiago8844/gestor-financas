import { useState, type ReactNode } from "react";
import { Modal } from "react-bootstrap";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { Categoria } from "../../../../api/categoria";
import type { Conta } from "../../../../types";
import type {
  CenarioConfig,
  EventoHipotetico,
  FrequenciaEvento,
  ImpactoDecisao,
  RelatorioSimulador,
  TipoLancamento,
} from "../../../../types/simulador";
import type { AcoesCenario } from "../useCenario";
import { CaixaTooltip, Secao } from "../ui";
import { COR, brl, brlSinal, descreverAjuste, formatarDataBR, hojeISO, mesCurto, nomeMes, novoId, rotuloAlvo, somarMeses } from "../utils";

type Contexto = {
  relatorio: RelatorioSimulador;
  cenario: CenarioConfig;
  acoes: AcoesCenario;
  contas: Conta[];
  categorias: Categoria[];
};

const LABEL_FREQUENCIA: Record<FrequenciaEvento, string> = { WEEKLY: "toda semana", MONTHLY: "todo mês", YEARLY: "todo ano" };

function descreverEvento(e: EventoHipotetico, cartoes: RelatorioSimulador["cartoes"]): string {
  const partes = [`${e.tipo === "INCOME" ? "Receita" : "Despesa"} de ${brl(e.valor)}`];
  if ((e.parcelas ?? 1) > 1) partes.push(`em ${e.parcelas}x`);
  if (e.frequencia) partes.push(LABEL_FREQUENCIA[e.frequencia]);
  partes.push(`${e.frequencia ? "a partir de" : "em"} ${formatarDataBR(e.data)}`);
  if (e.data_fim) partes.push(`até ${formatarDataBR(e.data_fim)}`);
  const cartao = cartoes.find((c) => c.id === e.cartao_id);
  if (cartao) partes.push(`no ${cartao.nome}`);
  return partes.join(" ");
}

// -=-=-=- EVENTOS HIPOTÉTICOS -=-=-=-

export function EventosHipoteticos(ctx: Contexto) {
  const { relatorio, cenario, acoes } = ctx;
  const [editando, setEditando] = useState<EventoHipotetico | null>(null);
  const impactos = new Map(relatorio.impactos.map((i) => [i.id, i]));

  const novo = (): EventoHipotetico => ({
    id: novoId("evento"),
    descricao: "",
    tipo: "EXPENSE",
    valor: 0,
    data: hojeISO(),
    parcelas: 1,
    frequencia: null,
  });

  return (
    <Secao
      titulo="Eventos simulados"
      icone="bi-lightbulb"
      ajuda="Receitas e despesas que existem só nesta simulação — nunca são gravadas como lançamentos."
      acoes={
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditando(novo())}>
          <i className="bi bi-plus-lg me-1"></i>Adicionar evento
        </button>
      }
    >
      {cenario.eventos.length === 0 ? (
        <p className="text-muted small mb-0">Ex.: comprar uma moto de R$ 20.000, viajar, receber um extra, começar a pagar aluguel...</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {cenario.eventos.map((e) => {
            const impacto = impactos.get(e.id);
            const inativo = e.ativo === false;
            return (
              <li key={e.id} className={`d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 border-bottom ${inativo ? "opacity-50" : ""}`}>
                <div className="small">
                  <div className="fw-semibold">
                    <i className={`bi ${e.tipo === "INCOME" ? "bi-arrow-down-circle text-success" : "bi-arrow-up-circle text-danger"} me-1`}></i>
                    {e.descricao}
                  </div>
                  <div className="text-muted">{descreverEvento(e, relatorio.cartoes)}</div>
                  {impacto && !inativo && (
                    <div className={impacto.impacto_saldo_final >= 0 ? "text-success" : "text-danger"}>
                      Saldo final {brlSinal(impacto.impacto_saldo_final)} · menor saldo {brlSinal(impacto.impacto_menor_saldo)}
                    </div>
                  )}
                </div>
                <div className="d-flex gap-1">
                  <div className="form-check form-switch mb-0 me-2" title="Ligar/desligar sem apagar">
                    <input className="form-check-input" type="checkbox" role="switch" checked={!inativo} onChange={() => acoes.alternarEvento(e.id)} aria-label="Ativo" />
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditando(e)} aria-label="Editar">
                    <i className="bi bi-pencil"></i>
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => acoes.removerEvento(e.id)} aria-label="Remover">
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editando && (
        <FormularioEvento
          evento={editando}
          ctx={ctx}
          onCancelar={() => setEditando(null)}
          onSalvar={(e) => {
            acoes.salvarEvento(e);
            setEditando(null);
          }}
        />
      )}
    </Secao>
  );
}

function FormularioEvento({
  evento,
  ctx,
  onSalvar,
  onCancelar,
}: {
  evento: EventoHipotetico;
  ctx: Contexto;
  onSalvar: (e: EventoHipotetico) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<EventoHipotetico>(evento);
  const [forma, setForma] = useState<"CONTA" | "CARTAO">(evento.cartao_id ? "CARTAO" : "CONTA");
  const set = (parcial: Partial<EventoHipotetico>) => setForm((f) => ({ ...f, ...parcial }));
  const cartoes = ctx.relatorio.cartoes.filter((c) => c.ativo);

  const erros: string[] = [];
  if (!form.descricao.trim()) erros.push("Informe a descrição.");
  if (!(form.valor > 0)) erros.push("O valor deve ser maior que zero.");
  if (form.data < hojeISO()) erros.push("A data precisa ser hoje ou futura.");
  if (forma === "CARTAO" && !form.cartao_id) erros.push("Escolha o cartão.");

  const salvar = () => {
    if (erros.length) return;
    onSalvar({
      ...form,
      cartao_id: form.tipo === "EXPENSE" && forma === "CARTAO" ? form.cartao_id : null,
      conta_id: forma === "CONTA" || form.tipo === "INCOME" ? form.conta_id ?? null : null,
      parcelas: form.frequencia ? 1 : form.parcelas ?? 1,
      data_fim: form.frequencia ? form.data_fim ?? null : null,
    });
  };

  return (
    <Modal show onHide={onCancelar} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{evento.descricao ? "Editar evento simulado" : "Novo evento simulado"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="row g-3 small">
          <div className="col-12">
            <div className="btn-group w-100" role="group">
              {(["EXPENSE", "INCOME"] as TipoLancamento[]).map((t) => (
                <button key={t} type="button" className={`btn btn-sm ${form.tipo === t ? (t === "INCOME" ? "btn-success" : "btn-danger") : "btn-outline-secondary"}`} onClick={() => set({ tipo: t })}>
                  {t === "INCOME" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Descrição</label>
            <input className="form-control form-control-sm" maxLength={150} value={form.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex.: Comprar uma moto" autoFocus />
          </div>
          <div className="col-6">
            <label className="form-label">Valor {(form.parcelas ?? 1) > 1 ? "total" : ""} (R$)</label>
            <input type="number" min={0} step="0.01" className="form-control form-control-sm" value={form.valor || ""} onChange={(e) => set({ valor: Number(e.target.value) })} />
          </div>
          <div className="col-6">
            <label className="form-label">{form.frequencia ? "Primeira data" : form.tipo === "EXPENSE" && forma === "CARTAO" ? "Data da compra" : "Data"}</label>
            <input type="date" className="form-control form-control-sm" min={hojeISO()} value={form.data} onChange={(e) => set({ data: e.target.value })} />
          </div>
          <div className="col-12">
            <label className="form-label">Categoria (opcional)</label>
            <select className="form-select form-select-sm" value={form.categoria_id ?? ""} onChange={(e) => set({ categoria_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sem categoria</option>
              {ctx.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {form.tipo === "EXPENSE" && (
            <div className="col-12">
              <label className="form-label">Forma de pagamento</label>
              <div className="btn-group w-100" role="group">
                <button type="button" className={`btn btn-sm ${forma === "CONTA" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setForma("CONTA")}>
                  Conta (débito/Pix/boleto)
                </button>
                <button type="button" className={`btn btn-sm ${forma === "CARTAO" ? "btn-secondary" : "btn-outline-secondary"}`} disabled={!cartoes.length} onClick={() => setForma("CARTAO")}>
                  Cartão de crédito
                </button>
              </div>
            </div>
          )}

          {form.tipo === "EXPENSE" && forma === "CARTAO" ? (
            <div className="col-12">
              <label className="form-label">Cartão</label>
              <select className="form-select form-select-sm" value={form.cartao_id ?? ""} onChange={(e) => set({ cartao_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Escolha...</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} (fecha dia {c.fechamento}, vence dia {c.vencimento})
                  </option>
                ))}
              </select>
              <div className="text-muted mt-1">Cai na fatura pelo fechamento do cartão; cada parcela vai para uma fatura.</div>
            </div>
          ) : (
            <div className="col-12">
              <label className="form-label">Conta</label>
              <select className="form-select form-select-sm" value={form.conta_id ?? ""} onChange={(e) => set({ conta_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Conta principal</option>
                {ctx.contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="col-6">
            <label className="form-label">Repetir</label>
            <select
              className="form-select form-select-sm"
              value={form.frequencia ?? ""}
              onChange={(e) => set({ frequencia: (e.target.value || null) as FrequenciaEvento | null, parcelas: 1 })}
            >
              <option value="">Não repete</option>
              <option value="MONTHLY">Todo mês</option>
              <option value="WEEKLY">Toda semana</option>
              <option value="YEARLY">Todo ano</option>
            </select>
          </div>
          {form.frequencia ? (
            <div className="col-6">
              <label className="form-label">Até (opcional)</label>
              <input type="date" className="form-control form-control-sm" min={form.data} value={form.data_fim ?? ""} onChange={(e) => set({ data_fim: e.target.value || null })} />
            </div>
          ) : (
            <div className="col-6">
              <label className="form-label">Parcelas</label>
              <input type="number" min={1} max={72} className="form-control form-control-sm" value={form.parcelas ?? 1} onChange={(e) => set({ parcelas: Math.max(1, Math.min(72, Number(e.target.value) || 1)) })} />
              {(form.parcelas ?? 1) > 1 && form.valor > 0 && <div className="text-muted mt-1">{form.parcelas}x de ≈ {brl(form.valor / (form.parcelas ?? 1))}</div>}
            </div>
          )}
        </div>
        {erros.length > 0 && form.descricao && <div className="text-danger small mt-3">{erros.join(" ")}</div>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={erros.length > 0} onClick={salvar}>
          Simular
        </button>
      </Modal.Footer>
    </Modal>
  );
}

// -=-=-=- "E SE EU...?" -=-=-=-

function proximoMes(relatorio: RelatorioSimulador): string {
  return relatorio.periodo.meses[1] ?? relatorio.periodo.meses[0];
}

/** Uma decisão = um formulário curto + botão; vira ajuste ou evento no cenário. */
function CartaoDecisao({ titulo, icone, children, onSimular, desabilitado }: { titulo: string; icone: string; children: ReactNode; onSimular: () => void; desabilitado?: boolean }) {
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className="border rounded p-3 h-100 d-flex flex-column small">
        <div className="fw-semibold mb-2">
          <i className={`bi ${icone} text-primary me-2`}></i>
          {titulo}
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 flex-grow-1">{children}</div>
        <button type="button" className="btn btn-sm btn-outline-primary mt-2 align-self-start" disabled={desabilitado} onClick={onSimular}>
          Simular
        </button>
      </div>
    </div>
  );
}

const Num = ({ valor, onChange, largura = 100, min = 0 }: { valor: number; onChange: (v: number) => void; largura?: number; min?: number }) => (
  <input type="number" min={min} className="form-control form-control-sm" style={{ width: largura }} value={valor} onChange={(e) => onChange(Number(e.target.value) || 0)} />
);

const SelMes = ({ meses, valor, onChange }: { meses: string[]; valor: string; onChange: (v: string) => void }) => (
  <select className="form-select form-select-sm w-auto" value={valor} onChange={(e) => onChange(e.target.value)}>
    {meses.map((m) => (
      <option key={m} value={m}>
        {mesCurto(m)}
      </option>
    ))}
  </select>
);

export function DecisoesRapidas(ctx: Contexto) {
  const { relatorio, acoes } = ctx;
  const meses = relatorio.periodo.meses;
  const inicio = proximoMes(relatorio);
  const ultimo = meses[meses.length - 1];
  const dataDoMes = (mes: string, dia = 10) => `${mes}-${String(dia).padStart(2, "0")}`;
  const limitarMes = (mes: string) => (mes > ultimo ? ultimo : mes);

  const [economia, setEconomia] = useState({ valor: 200, meses: 12 });
  const [renda, setRenda] = useState({ valor: 500, mes: inicio });
  const [vista, setVista] = useState({ valor: 4000, mes: inicio });
  const [parcelado, setParcelado] = useState({ valor: 5000, parcelas: 10, mes: inicio, cartao: relatorio.cartoes.find((c) => c.ativo)?.id ?? 0 });
  const categoriasDespesa = relatorio.categorias.filter((c) => c.tipo === "EXPENSE" && c.projetada);
  const [pausa, setPausa] = useState({ chave: categoriasDespesa[0]?.chave ?? "", meses: 3, mes: inicio });
  const [prestacao, setPrestacao] = useState({ valor: 800, meses: 12, mes: inicio });
  const cartoesEstimados = relatorio.cartoes.filter((c) => relatorio.eventos.some((e) => e.fatura?.cartao_id === c.id && (e.composicao?.estimado ?? 0) > 0));
  const [cartao, setCartao] = useState({ id: cartoesEstimados[0]?.id ?? 0, pct: 20 });
  const [extra, setExtra] = useState({ valor: 2000, mes: inicio });

  const evento = (e: Omit<EventoHipotetico, "id">) => acoes.salvarEvento({ ...e, id: novoId("decisao") });

  return (
    <Secao titulo="E se eu...?" icone="bi-signpost-split" ajuda="Atalhos para as perguntas mais comuns. Cada um vira um ajuste ou evento simulado — dá para editar ou desligar depois.">
      <div className="row g-3">
        <CartaoDecisao
          titulo="Economizar todo mês"
          icone="bi-piggy-bank"
          desabilitado={relatorio.cenarios.base.resumo.despesas.estimadas <= 0}
          onSimular={() =>
            acoes.adicionarAjuste({
              id: novoId("economia"),
              alvo: "DESPESAS_ESTIMADAS",
              modo: "DELTA",
              valor: -economia.valor,
              mes_inicio: inicio,
              mes_fim: limitarMes(somarMeses(inicio, economia.meses - 1)),
              rotulo: `Economizar ${brl(economia.valor)}/mês por ${economia.meses} meses`,
            })
          }
        >
          R$ <Num valor={economia.valor} onChange={(v) => setEconomia((s) => ({ ...s, valor: v }))} /> por mês, durante
          <Num valor={economia.meses} onChange={(v) => setEconomia((s) => ({ ...s, meses: Math.max(1, v) }))} largura={64} /> meses
          {relatorio.cenarios.base.resumo.despesas.estimadas <= 0 && <span className="text-muted">(sem gastos estimados para reduzir)</span>}
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Aumentar minha renda"
          icone="bi-graph-up"
          onSimular={() => evento({ descricao: `Renda extra de ${brl(renda.valor)}/mês`, tipo: "INCOME", valor: renda.valor, data: dataDoMes(renda.mes, 5), frequencia: "MONTHLY" })}
        >
          + R$ <Num valor={renda.valor} onChange={(v) => setRenda((s) => ({ ...s, valor: v }))} /> por mês a partir de
          <SelMes meses={meses} valor={renda.mes} onChange={(m) => setRenda((s) => ({ ...s, mes: m }))} />
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Comprar algo à vista"
          icone="bi-bag-check"
          onSimular={() => evento({ descricao: `Compra à vista de ${brl(vista.valor)}`, tipo: "EXPENSE", valor: vista.valor, data: dataDoMes(vista.mes) })}
        >
          R$ <Num valor={vista.valor} onChange={(v) => setVista((s) => ({ ...s, valor: v }))} /> em
          <SelMes meses={meses} valor={vista.mes} onChange={(m) => setVista((s) => ({ ...s, mes: m }))} />
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Parcelar uma compra"
          icone="bi-credit-card"
          onSimular={() =>
            evento({
              descricao: `Compra de ${brl(parcelado.valor)} em ${parcelado.parcelas}x`,
              tipo: "EXPENSE",
              valor: parcelado.valor,
              data: dataDoMes(parcelado.mes),
              parcelas: parcelado.parcelas,
              cartao_id: parcelado.cartao || null,
            })
          }
        >
          R$ <Num valor={parcelado.valor} onChange={(v) => setParcelado((s) => ({ ...s, valor: v }))} /> em
          <Num valor={parcelado.parcelas} onChange={(v) => setParcelado((s) => ({ ...s, parcelas: Math.max(1, Math.min(72, v)) }))} largura={60} min={1} />x, em
          <SelMes meses={meses} valor={parcelado.mes} onChange={(m) => setParcelado((s) => ({ ...s, mes: m }))} />
          <select className="form-select form-select-sm w-auto" value={parcelado.cartao} onChange={(e) => setParcelado((s) => ({ ...s, cartao: Number(e.target.value) }))}>
            <option value={0}>na conta (boleto/carnê)</option>
            {relatorio.cartoes.filter((c) => c.ativo).map((c) => (
              <option key={c.id} value={c.id}>
                no {c.nome}
              </option>
            ))}
          </select>
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Ficar sem uma categoria"
          icone="bi-slash-circle"
          desabilitado={!pausa.chave}
          onSimular={() => {
            const c = categoriasDespesa.find((x) => x.chave === pausa.chave);
            if (!c) return;
            acoes.adicionarAjuste({
              id: novoId("pausa"),
              alvo: "CATEGORIA",
              tipo: "EXPENSE",
              categoria_id: c.categoria_id,
              modo: "PERCENTUAL",
              valor: -100,
              mes_inicio: pausa.mes,
              mes_fim: limitarMes(somarMeses(pausa.mes, pausa.meses - 1)),
              rotulo: `${pausa.meses} meses sem ${c.categoria}`,
            });
          }}
        >
          <Num valor={pausa.meses} onChange={(v) => setPausa((s) => ({ ...s, meses: Math.max(1, v) }))} largura={60} min={1} /> meses sem
          <select className="form-select form-select-sm w-auto" value={pausa.chave} onChange={(e) => setPausa((s) => ({ ...s, chave: e.target.value }))}>
            {categoriasDespesa.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.categoria}
              </option>
            ))}
          </select>
          a partir de <SelMes meses={meses} valor={pausa.mes} onChange={(m) => setPausa((s) => ({ ...s, mes: m }))} />
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Começar uma prestação"
          icone="bi-calendar2-week"
          onSimular={() =>
            evento({
              descricao: `Prestação de ${brl(prestacao.valor)}/mês`,
              tipo: "EXPENSE",
              valor: prestacao.valor,
              data: dataDoMes(prestacao.mes),
              frequencia: "MONTHLY",
              data_fim: dataDoMes(somarMeses(prestacao.mes, prestacao.meses - 1)),
            })
          }
        >
          R$ <Num valor={prestacao.valor} onChange={(v) => setPrestacao((s) => ({ ...s, valor: v }))} /> por
          <Num valor={prestacao.meses} onChange={(v) => setPrestacao((s) => ({ ...s, meses: Math.max(1, v) }))} largura={60} min={1} /> meses, a partir de
          <SelMes meses={meses} valor={prestacao.mes} onChange={(m) => setPrestacao((s) => ({ ...s, mes: m }))} />
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Usar menos um cartão"
          icone="bi-credit-card-2-back"
          desabilitado={!cartao.id}
          onSimular={() => {
            const c = relatorio.cartoes.find((x) => x.id === cartao.id);
            acoes.adicionarAjuste({ id: novoId("cartao"), alvo: "CARTAO", cartao_id: cartao.id, modo: "PERCENTUAL", valor: -cartao.pct, rotulo: `Usar ${cartao.pct}% menos o ${c?.nome ?? "cartão"}` });
          }}
        >
          {cartoesEstimados.length === 0 ? (
            <span className="text-muted">Nenhum cartão com compras estimadas no período.</span>
          ) : (
            <>
              Reduzir em <Num valor={cartao.pct} onChange={(v) => setCartao((s) => ({ ...s, pct: Math.max(0, Math.min(100, v)) }))} largura={64} />% as compras no
              <select className="form-select form-select-sm w-auto" value={cartao.id} onChange={(e) => setCartao((s) => ({ ...s, id: Number(e.target.value) }))}>
                {cartoesEstimados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </>
          )}
        </CartaoDecisao>

        <CartaoDecisao
          titulo="Ter uma despesa extraordinária"
          icone="bi-exclamation-diamond"
          onSimular={() => evento({ descricao: `Despesa extraordinária de ${brl(extra.valor)}`, tipo: "EXPENSE", valor: extra.valor, data: dataDoMes(extra.mes, 15) })}
        >
          R$ <Num valor={extra.valor} onChange={(v) => setExtra((s) => ({ ...s, valor: v }))} /> em
          <SelMes meses={meses} valor={extra.mes} onChange={(m) => setExtra((s) => ({ ...s, mes: m }))} />
        </CartaoDecisao>
      </div>
    </Secao>
  );
}

// -=-=-=- EFEITO DE CADA DECISÃO -=-=-=-

export function ImpactosDecisoes({ relatorio, cenario, acoes }: Pick<Contexto, "relatorio" | "cenario" | "acoes">) {
  const impactos = relatorio.impactos;
  const ajustes = new Map(cenario.ajustes.map((a) => [a.id, a]));

  if (!impactos.length) {
    return (
      <Secao titulo="Efeito de cada decisão" icone="bi-lightning-charge">
        <p className="text-muted small mb-0">Faça um ajuste ou adicione um evento para ver, separadamente, quanto cada decisão muda o seu saldo.</p>
      </Secao>
    );
  }

  return (
    <Secao
      titulo="Efeito de cada decisão"
      icone="bi-lightning-charge"
      ajuda="Cada efeito é a simulação completa menos a mesma simulação sem aquela decisão — considerando datas, faturas e o que já está cadastrado, não uma simples multiplicação."
    >
      <ul className="list-unstyled mb-0">
        {impactos.map((i) => (
          <LinhaImpacto
            key={i.id}
            impacto={i}
            detalhe={ajustes.get(i.id) ? `${rotuloAlvo(ajustes.get(i.id)!)} · ${descreverAjuste(ajustes.get(i.id)!)}` : undefined}
            onRemover={
              i.id === "inflacao"
                ? () => acoes.definirInflacao(0)
                : ajustes.has(i.id)
                  ? () => acoes.removerAjuste(i.id)
                  : () => acoes.removerEvento(i.id)
            }
          />
        ))}
      </ul>
    </Secao>
  );
}

function LinhaImpacto({ impacto, detalhe, onRemover }: { impacto: ImpactoDecisao; detalhe?: string; onRemover: () => void }) {
  const positivo = impacto.impacto_saldo_final >= 0;
  return (
    <li className="py-2 border-bottom">
      <div className="d-flex justify-content-between gap-2">
        <div className="small">
          <div className="fw-semibold">{impacto.rotulo}</div>
          {detalhe && <div className="text-muted">{detalhe}</div>}
          <div className="d-flex flex-wrap gap-3 mt-1">
            <span className={positivo ? "text-success" : "text-danger"}>Saldo final {brlSinal(impacto.impacto_saldo_final)}</span>
            <span className="text-muted">Menor saldo {brlSinal(impacto.impacto_menor_saldo)}</span>
            {impacto.impacto_despesas !== 0 && <span className="text-muted">Despesas {brlSinal(impacto.impacto_despesas)}</span>}
            {impacto.impacto_receitas !== 0 && <span className="text-muted">Receitas {brlSinal(impacto.impacto_receitas)}</span>}
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-link text-danger p-0 align-self-start" onClick={onRemover} aria-label="Remover decisão">
          <i className="bi bi-x-lg"></i>
        </button>
      </div>
      <ResponsiveContainer width="100%" height={56}>
        <BarChart data={impacto.mensal.map((m) => ({ ...m, rotulo: mesCurto(m.mes) }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="rotulo" hide />
          <ReferenceLine y={0} stroke={COR.neutro} />
          <Tooltip
            cursor={{ fill: "rgba(13,110,253,0.05)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { mes: string; diferenca: number };
              return (
                <CaixaTooltip titulo={nomeMes(d.mes)}>
                  <div className="small">Diferença acumulada no saldo: {brlSinal(d.diferenca)}</div>
                </CaixaTooltip>
              );
            }}
          />
          <Bar dataKey="diferenca" radius={2} isAnimationActive={false}>
            {impacto.mensal.map((m) => (
              <Cell key={m.mes} fill={m.diferenca >= 0 ? COR.receita : COR.despesa} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </li>
  );
}
