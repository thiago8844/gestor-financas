import { useCallback, useMemo, useState } from "react";
import type { AjusteCenario, CenarioConfig, EventoHipotetico } from "../../../types/simulador";
import { CENARIO_VAZIO } from "./utils";

export type AcoesCenario = {
  /** Cria, substitui (mesmo id) ou remove (null) um ajuste. */
  definirAjuste: (id: string, ajuste: AjusteCenario | null) => void;
  adicionarAjuste: (ajuste: AjusteCenario) => void;
  removerAjuste: (id: string) => void;
  salvarEvento: (evento: EventoHipotetico) => void;
  removerEvento: (id: string) => void;
  alternarEvento: (id: string) => void;
  definirInflacao: (valor: number) => void;
  substituir: (cenario: CenarioConfig) => void;
  restaurar: () => void;
};

/**
 * Estado do cenário personalizado. Só vive no navegador (e no cenário salvo, se o usuário salvar):
 * nada daqui altera lançamentos — o backend aplica por cima dos dados reais a cada recálculo.
 */
export function useCenario(inicial: CenarioConfig = CENARIO_VAZIO): [CenarioConfig, AcoesCenario] {
  const [cenario, setCenario] = useState<CenarioConfig>(inicial);

  const definirAjuste = useCallback((id: string, ajuste: AjusteCenario | null) => {
    setCenario((c) => {
      const existe = c.ajustes.some((a) => a.id === id);
      if (!ajuste) return { ...c, ajustes: c.ajustes.filter((a) => a.id !== id) };
      return {
        ...c,
        ajustes: existe ? c.ajustes.map((a) => (a.id === id ? { ...ajuste, id } : a)) : [...c.ajustes, { ...ajuste, id }],
      };
    });
  }, []);

  const acoes = useMemo<AcoesCenario>(
    () => ({
      definirAjuste,
      adicionarAjuste: (ajuste) => definirAjuste(ajuste.id, ajuste),
      removerAjuste: (id) => definirAjuste(id, null),
      salvarEvento: (evento) =>
        setCenario((c) => ({
          ...c,
          eventos: c.eventos.some((e) => e.id === evento.id)
            ? c.eventos.map((e) => (e.id === evento.id ? evento : e))
            : [...c.eventos, evento],
        })),
      removerEvento: (id) => setCenario((c) => ({ ...c, eventos: c.eventos.filter((e) => e.id !== id) })),
      alternarEvento: (id) =>
        setCenario((c) => ({ ...c, eventos: c.eventos.map((e) => (e.id === id ? { ...e, ativo: e.ativo === false } : e)) })),
      definirInflacao: (valor) => setCenario((c) => ({ ...c, inflacao_mensal: valor })),
      substituir: (novo) => setCenario({ ...CENARIO_VAZIO, ...novo }),
      restaurar: () => setCenario(CENARIO_VAZIO),
    }),
    [definirAjuste]
  );

  return [cenario, acoes];
}
