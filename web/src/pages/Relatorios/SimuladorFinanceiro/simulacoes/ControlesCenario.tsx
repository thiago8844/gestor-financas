import { useState } from "react";
import type { AjusteCenario, AlvoAjuste, CategoriaSimulador, CenarioConfig, RelatorioSimulador, TipoLancamento } from "../../../../types/simulador";
import type { AcoesCenario } from "../useCenario";
import { Alternador, BadgeConfianca, Secao } from "../ui";
import { ajusteDaCategoria, brl, descreverAjuste, idAjusteCategoria, mesCurto, nomeMes } from "../utils";

// -=-=-=- PEÇAS -=-=-=-

/** Slider para mexer rápido + campo numérico para o valor exato; os dois sempre em sincronia. */
export function SliderPercentual({
  valor,
  onChange,
  min = -100,
  max = 100,
  passo = 1,
  id,
  sufixo = "%",
}: {
  valor: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  id?: string;
  sufixo?: string;
}) {
  return (
    <div className="d-flex align-items-center gap-2">
      <input
        id={id}
        type="range"
        className="form-range flex-grow-1"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="input-group input-group-sm" style={{ width: 96 }}>
        <input
          type="number"
          className="form-control text-end"
          step={passo}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          aria-label="Valor exato"
        />
        <span className="input-group-text">{sufixo}</span>
      </div>
    </div>
  );
}

export function SeletorPeriodo({
  meses,
  inicio,
  fim,
  onChange,
}: {
  meses: string[];
  inicio?: string | null;
  fim?: string | null;
  onChange: (inicio: string | null, fim: string | null) => void;
}) {
  return (
    <div className="d-flex align-items-center gap-1 small">
      <select className="form-select form-select-sm" value={inicio ?? ""} onChange={(e) => onChange(e.target.value || null, fim ?? null)} aria-label="A partir de">
        <option value="">Desde já</option>
        {meses.map((m) => (
          <option key={m} value={m}>
            a partir de {mesCurto(m)}
          </option>
        ))}
      </select>
      <select className="form-select form-select-sm" value={fim ?? ""} onChange={(e) => onChange(inicio ?? null, e.target.value || null)} aria-label="Até">
        <option value="">até o fim</option>
        {meses.map((m) => (
          <option key={m} value={m}>
            até {mesCurto(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

// -=-=-=- AJUSTES GERAIS -=-=-=-

const GERAIS: { alvo: AlvoAjuste; titulo: string; ajuda: string }[] = [
  { alvo: "RECEITAS_RECORRENTES", titulo: "Receitas recorrentes", ajuda: "Ocorrências futuras de recorrências de receita (ex.: aumento de salário). Lançamentos já gerados não mudam." },
  { alvo: "RECEITAS_ESTIMADAS", titulo: "Receitas variáveis estimadas", ajuda: "Receitas previstas pelo histórico." },
  { alvo: "DESPESAS_ESTIMADAS", titulo: "Gastos variáveis estimados", ajuda: "Gastos do dia a dia previstos pelo histórico (incluindo contas de valor variável)." },
  { alvo: "DESPESAS_RECORRENTES", titulo: "Despesas recorrentes", ajuda: "Ocorrências futuras de recorrências de despesa (assinaturas, aluguel...)." },
];

const idGeral = (alvo: string) => `geral:${alvo}`;

export function AjustesGerais({ relatorio, cenario, acoes }: { relatorio: RelatorioSimulador; cenario: CenarioConfig; acoes: AcoesCenario }) {
  const meses = relatorio.periodo.meses;
  const cartoesComEstimativa = relatorio.cartoes.filter((c) =>
    relatorio.eventos.some((e) => e.fatura?.cartao_id === c.id && (e.composicao?.estimado ?? 0) > 0)
  );

  const atualizar = (id: string, base: Omit<AjusteCenario, "id">, mudanca: Partial<AjusteCenario>) => {
    const atual = cenario.ajustes.find((a) => a.id === id);
    const novo = { ...base, ...atual, ...mudanca, id } as AjusteCenario;
    novo.rotulo = `${base.rotulo}: ${descreverAjuste(novo)}`;
    acoes.definirAjuste(id, novo.valor === 0 && !novo.mes_inicio && !novo.mes_fim ? null : novo);
  };

  const linha = (id: string, titulo: string, base: Omit<AjusteCenario, "id">, ajuda?: string) => {
    const atual = cenario.ajustes.find((a) => a.id === id);
    return (
      <div key={id} className="py-2 border-bottom">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <label className="small fw-semibold mb-0" htmlFor={id} title={ajuda}>
            {titulo}
          </label>
          {atual && (
            <button type="button" className="btn btn-sm btn-link p-0 text-muted" onClick={() => acoes.removerAjuste(id)}>
              restaurar
            </button>
          )}
        </div>
        <SliderPercentual id={id} valor={atual?.valor ?? 0} onChange={(v) => atualizar(id, base, { valor: v })} />
        <SeletorPeriodo
          meses={meses}
          inicio={atual?.mes_inicio}
          fim={atual?.mes_fim}
          onChange={(mes_inicio, mes_fim) => atualizar(id, base, { mes_inicio, mes_fim })}
        />
      </div>
    );
  };

  return (
    <Secao titulo="Ajustes gerais" icone="bi-sliders2" ajuda="Percentuais aplicados só ao que é previsão. Compras reais e parcelas contratadas nunca são alteradas.">
      {GERAIS.map((g) =>
        linha(idGeral(g.alvo), g.titulo, { alvo: g.alvo, modo: "PERCENTUAL", valor: 0, rotulo: `${g.titulo}` }, g.ajuda)
      )}
      {cartoesComEstimativa.map((c) =>
        linha(idGeral(`CARTAO:${c.id}`), `Compras estimadas no ${c.nome}`, { alvo: "CARTAO", cartao_id: c.id, modo: "PERCENTUAL", valor: 0, rotulo: `Compras no ${c.nome}` })
      )}

      <div className="pt-3">
        <label className="small fw-semibold" htmlFor="inflacao">
          Inflação nas despesas estimadas (% ao mês)
        </label>
        <SliderPercentual id="inflacao" valor={cenario.inflacao_mensal} min={0} max={3} passo={0.05} onChange={acoes.definirInflacao} sufixo="%/m" />
        <div className="text-muted small">
          Composta mês a mês. {cenario.inflacao_mensal > 0 && `≈ ${((Math.pow(1 + cenario.inflacao_mensal / 100, 12) - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% ao ano.`} Nenhuma taxa externa é usada automaticamente.
        </div>
      </div>
    </Secao>
  );
}

// -=-=-=- TABELA DE CATEGORIAS -=-=-=-

type ModoTabela = "PERCENTUAL" | "DEFINIR";

export function TabelaCategoriasControle({
  relatorio,
  cenario,
  acoes,
  onAbrirCategoria,
}: {
  relatorio: RelatorioSimulador;
  cenario: CenarioConfig;
  acoes: AcoesCenario;
  onAbrirCategoria: (chave: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("EXPENSE");
  const [mostrarSemPrevisao, setMostrarSemPrevisao] = useState(false);
  const categorias = relatorio.categorias.filter((c) => c.tipo === tipo);
  const visiveis = categorias.filter((c) => mostrarSemPrevisao || c.projetada || ajusteDaCategoria(cenario, c.chave));
  const escondidas = categorias.length - visiveis.length;

  return (
    <Secao
      titulo="Previsões por categoria"
      icone="bi-table"
      ajuda="A estimativa automática é o total mensal previsto pelo histórico. O ajuste vale sobre esse total; o que já está cadastrado no mês é descontado depois (sem somar duas vezes)."
      acoes={
        <Alternador
          rotulo="Tipo"
          valor={tipo}
          onChange={setTipo}
          opcoes={[
            { valor: "EXPENSE", label: "Despesas" },
            { valor: "INCOME", label: "Receitas" },
          ]}
        />
      }
    >
      {categorias.length === 0 ? (
        <p className="text-muted small mb-0">Nenhuma {tipo === "EXPENSE" ? "despesa" : "receita"} variável no histórico analisado.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle small mb-0">
            <thead className="table-light">
              <tr>
                <th>Categoria</th>
                <th className="text-end text-nowrap">Estimativa automática</th>
                <th style={{ minWidth: 260 }}>Ajuste</th>
                <th className="text-end">Resultado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <LinhaCategoria key={c.chave} categoria={c} cenario={cenario} acoes={acoes} meses={relatorio.periodo.meses} onAbrir={() => onAbrirCategoria(c.chave)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {escondidas > 0 && (
        <button type="button" className="btn btn-sm btn-link px-0 mt-2" onClick={() => setMostrarSemPrevisao((v) => !v)}>
          {mostrarSemPrevisao ? "Ocultar" : "Mostrar"} {escondidas} categoria(s) sem previsão automática (dados insuficientes ou eventuais) — dá para definir uma previsão manual.
        </button>
      )}
    </Secao>
  );
}

function LinhaCategoria({
  categoria: c,
  cenario,
  acoes,
  meses,
  onAbrir,
}: {
  categoria: CategoriaSimulador;
  cenario: CenarioConfig;
  acoes: AcoesCenario;
  meses: string[];
  onAbrir: () => void;
}) {
  const id = idAjusteCategoria(c.chave);
  const ajuste = ajusteDaCategoria(cenario, c.chave);
  const automatica = c.projetada ? c.estimativa_mensal ?? 0 : 0;
  const modo: ModoTabela = ajuste?.modo === "DEFINIR" || (!c.projetada && !ajuste) ? "DEFINIR" : "PERCENTUAL";
  const excluida = ajuste?.modo === "PERCENTUAL" && ajuste.valor === -100;

  const salvar = (mudanca: Partial<AjusteCenario>) => {
    const novo: AjusteCenario = {
      id,
      alvo: "CATEGORIA",
      tipo: c.tipo,
      categoria_id: c.categoria_id,
      modo,
      valor: 0,
      rotulo: c.categoria,
      ...ajuste,
      ...mudanca,
    };
    const neutro = novo.modo === "PERCENTUAL" && novo.valor === 0 && !novo.mes_inicio && !novo.mes_fim;
    acoes.definirAjuste(id, neutro ? null : { ...novo, rotulo: rotuloCategoria(c.categoria, novo) });
  };

  const resultado = !ajuste ? automatica : ajuste.modo === "DEFINIR" ? ajuste.valor : Math.max(0, automatica * (1 + ajuste.valor / 100));
  const status = c.status === "PROJETADA" ? (c.projetada ? c.confianca : null) : c.status;

  return (
    <tr className={excluida ? "opacity-50" : ""}>
      <td>
        <button type="button" className="btn btn-link p-0 text-body fw-semibold text-start text-decoration-none" onClick={onAbrir}>
          {c.categoria}
        </button>
        <div className="d-flex flex-wrap gap-1 mt-1">
          <BadgeConfianca nivel={status} />
          {c.extraordinarios.length > 0 && (
            <span className="badge text-bg-light border fw-normal" title="Valores isolados muito acima do padrão, fora da previsão">
              <i className="bi bi-stars me-1"></i>
              {c.extraordinarios.length} extraordinário(s)
            </span>
          )}
        </div>
      </td>
      <td className="text-end text-nowrap">
        {c.projetada ? <>{brl(automatica)}<span className="text-muted">/mês</span></> : <span className="text-muted">—</span>}
      </td>
      <td>
        <div className="d-flex gap-2 align-items-center mb-1">
          <div className="btn-group btn-group-sm" role="group" aria-label="Modo do ajuste">
            <button type="button" className={`btn ${modo === "PERCENTUAL" ? "btn-secondary" : "btn-outline-secondary"}`} disabled={!c.projetada} onClick={() => salvar({ modo: "PERCENTUAL", valor: 0 })}>
              %
            </button>
            <button type="button" className={`btn ${modo === "DEFINIR" ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => salvar({ modo: "DEFINIR", valor: Math.round(automatica) })}>
              R$
            </button>
          </div>
          <div className="form-check form-switch mb-0 ms-auto small" title="Incluir esta previsão na simulação">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id={`incluir-${c.chave}`}
              checked={!excluida}
              disabled={!c.projetada && !ajuste}
              onChange={(e) => (e.target.checked ? acoes.removerAjuste(id) : salvar({ modo: "PERCENTUAL", valor: -100 }))}
            />
            <label className="form-check-label" htmlFor={`incluir-${c.chave}`}>
              incluir
            </label>
          </div>
        </div>
        {modo === "PERCENTUAL" ? (
          <SliderPercentual valor={ajuste?.valor ?? 0} onChange={(v) => salvar({ modo: "PERCENTUAL", valor: v })} />
        ) : (
          <div className="input-group input-group-sm">
            <span className="input-group-text">R$</span>
            <input
              type="number"
              min={0}
              className="form-control"
              placeholder={c.projetada ? undefined : "Previsão manual por mês"}
              value={ajuste?.modo === "DEFINIR" ? ajuste.valor : ""}
              onChange={(e) => (e.target.value === "" ? acoes.removerAjuste(id) : salvar({ modo: "DEFINIR", valor: Math.max(0, Number(e.target.value)) }))}
            />
            <span className="input-group-text">/mês</span>
          </div>
        )}
        <div className="mt-1">
          <SeletorPeriodo meses={meses} inicio={ajuste?.mes_inicio} fim={ajuste?.mes_fim} onChange={(mes_inicio, mes_fim) => ajuste && salvar({ mes_inicio, mes_fim })} />
        </div>
      </td>
      <td className={`text-end text-nowrap fw-semibold ${ajuste ? "text-primary" : ""}`}>
        {brl(resultado)}
        <span className="text-muted fw-normal">/mês</span>
      </td>
      <td className="text-end text-nowrap">
        <button type="button" className="btn btn-sm btn-outline-secondary me-1" title="Como foi calculado" onClick={onAbrir}>
          <i className="bi bi-search"></i>
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" title="Voltar à estimativa automática" disabled={!ajuste} onClick={() => acoes.removerAjuste(id)}>
          <i className="bi bi-arrow-counterclockwise"></i>
        </button>
      </td>
    </tr>
  );
}

function rotuloCategoria(nome: string, ajuste: AjusteCenario): string {
  const periodo = ajuste.mes_inicio || ajuste.mes_fim ? ` (${ajuste.mes_inicio ? nomeMes(ajuste.mes_inicio) : "já"}${ajuste.mes_fim ? ` a ${nomeMes(ajuste.mes_fim)}` : ""})` : "";
  if (ajuste.modo === "DEFINIR") return `${nome}: ${brl(ajuste.valor)}/mês${periodo}`;
  if (ajuste.valor === -100) return `Sem ${nome}${periodo}`;
  return `${nome} ${ajuste.valor > 0 ? "+" : ""}${ajuste.valor}%${periodo}`;
}
