import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfirmModalStore } from "../../../../stores/confirmModal";
import { excluirCenarioSimulador, listarCenariosSimulador, salvarCenarioSimulador } from "../../../../api/simulador";
import type { CenarioSalvo, ConfiguracaoSalva, NomeCenario, RelatorioSimulador } from "../../../../types/simulador";
import { Secao } from "../ui";
import { COR_CENARIO, LABEL_CENARIO, brl, brlSinal, formatarDataBR, pct } from "../utils";

// -=-=-=- COMPARAÇÃO -=-=-=-

export function ComparacaoCenarios({ relatorio }: { relatorio: RelatorioSimulador }) {
  const nomes: NomeCenario[] = relatorio.cenario_ativo ? ["base", "otimista", "pessimista", "personalizado"] : ["base", "otimista", "pessimista"];
  const base = relatorio.cenarios.base.resumo;

  const linhas: { rotulo: string; valor: (n: NomeCenario) => string; destaque?: (n: NomeCenario) => string }[] = [
    { rotulo: "Saldo final", valor: (n) => brl(relatorio.cenarios[n].resumo.saldo_final), destaque: (n) => (relatorio.cenarios[n].resumo.saldo_final < 0 ? "text-danger" : "fw-semibold") },
    { rotulo: "Receitas", valor: (n) => brl(relatorio.cenarios[n].resumo.receitas.total) },
    { rotulo: "Despesas", valor: (n) => brl(relatorio.cenarios[n].resumo.despesas.total) },
    { rotulo: "Poupança (resultado)", valor: (n) => brlSinal(relatorio.cenarios[n].resumo.resultado) },
    { rotulo: "Taxa de poupança", valor: (n) => pct(relatorio.cenarios[n].resumo.taxa_poupanca_pct) },
    { rotulo: "Menor saldo", valor: (n) => brl(relatorio.cenarios[n].resumo.menor_saldo.valor), destaque: (n) => (relatorio.cenarios[n].resumo.menor_saldo.valor < 0 ? "text-danger" : "") },
    { rotulo: "Dias com saldo negativo", valor: (n) => String(relatorio.cenarios[n].resumo.dias_negativos), destaque: (n) => (relatorio.cenarios[n].resumo.dias_negativos > 0 ? "text-danger" : "") },
    {
      rotulo: "Diferença no saldo final vs. automática",
      valor: (n) => (n === "base" ? "—" : brlSinal(relatorio.cenarios[n].resumo.saldo_final - base.saldo_final)),
      destaque: (n) => (n === "base" ? "text-muted" : relatorio.cenarios[n].resumo.saldo_final >= base.saldo_final ? "text-success" : "text-danger"),
    },
  ];

  return (
    <Secao
      titulo="Comparação de cenários"
      icone="bi-columns-gap"
      ajuda="Otimista e pessimista mexem só no que é estimativa (um desvio típico do histórico por mês); compromissos confirmados e salários cadastrados ficam iguais nos três."
    >
      <div className="table-responsive">
        <table className="table table-sm align-middle small mb-0">
          <thead>
            <tr>
              <th></th>
              {nomes.map((n) => (
                <th key={n} className="text-end text-nowrap">
                  <span className="d-inline-block me-1 align-middle" style={{ width: 12, borderTop: `3px solid ${COR_CENARIO[n]}` }} />
                  {LABEL_CENARIO[n]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <td className="text-muted">{l.rotulo}</td>
                {nomes.map((n) => (
                  <td key={n} className={`text-end text-nowrap ${l.destaque?.(n) ?? ""}`}>
                    {l.valor(n)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Secao>
  );
}

// -=-=-=- CENÁRIOS SALVOS -=-=-=-

type Props = {
  configuracaoAtual: ConfiguracaoSalva;
  carregadoId: number | null;
  onCarregar: (cenario: CenarioSalvo) => void;
  onSalvo: (cenario: CenarioSalvo) => void;
};

export function CenariosSalvos({ configuracaoAtual, carregadoId, onCarregar, onSalvo }: Props) {
  const queryClient = useQueryClient();
  const { data: cenarios = [], isLoading } = useQuery({ queryKey: ["simulador-cenarios"], queryFn: listarCenariosSimulador });
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const carregado = cenarios.find((c) => c.id === carregadoId);
  const { openModal } = useConfirmModalStore();

  const salvar = useMutation({
    mutationFn: salvarCenarioSimulador,
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: ["simulador-cenarios"] });
      setNome("");
      setErro(null);
      onSalvo(salvo);
    },
    onError: () => setErro("Não foi possível salvar o cenário."),
  });

  const excluir = useMutation({
    mutationFn: excluirCenarioSimulador,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["simulador-cenarios"] }),
  });

  return (
    <Secao
      titulo="Cenários salvos"
      icone="bi-bookmark-star"
      ajuda="Um cenário salvo guarda só as suas escolhas (filtros, ajustes e eventos simulados). Ao abrir, ele é REAPLICADO sobre os seus dados financeiros de hoje — lançamentos novos entram, os já pagos saem."
    >
      <div className="input-group input-group-sm mb-2">
        <input
          className="form-control"
          maxLength={100}
          placeholder="Nome (ex.: Comprando uma moto)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!nome.trim() || salvar.isPending}
          onClick={() => salvar.mutate({ name: nome.trim(), settings: configuracaoAtual })}
        >
          Salvar como novo
        </button>
      </div>
      {carregado && (
        <button
          type="button"
          className="btn btn-sm btn-outline-primary mb-2"
          disabled={salvar.isPending}
          onClick={() => salvar.mutate({ id: carregado.id, name: carregado.name, description: carregado.description, settings: configuracaoAtual })}
        >
          <i className="bi bi-save me-1"></i>Atualizar "{carregado.name}"
        </button>
      )}
      {erro && <div className="text-danger small mb-2">{erro}</div>}

      {isLoading ? (
        <div className="text-muted small">Carregando...</div>
      ) : cenarios.length === 0 ? (
        <p className="text-muted small mb-0">Nenhum cenário salvo ainda.</p>
      ) : (
        <ul className="list-unstyled mb-0 small">
          {cenarios.map((c) => (
            <li key={c.id} className={`d-flex justify-content-between align-items-center gap-2 py-2 border-bottom ${c.id === carregadoId ? "fw-semibold" : ""}`}>
              <div>
                {c.id === carregadoId && <i className="bi bi-check2 text-primary me-1"></i>}
                {c.name}
                <div className="text-muted fw-normal">
                  {(c.settings.cenario?.ajustes.length ?? 0)} ajuste(s) · {(c.settings.cenario?.eventos.length ?? 0)} evento(s) · salvo em {formatarDataBR(c.updated_at)}
                </div>
              </div>
              <div className="d-flex gap-1">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onCarregar(c)}>
                  Abrir
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  aria-label="Excluir cenário"
                  onClick={() =>
                    openModal({
                      title: "Excluir cenário",
                      message: "O cenário salvo será excluído. Seus lançamentos não são afetados.",
                      callback: () => excluir.mutate(c.id),
                    })
                  }
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
