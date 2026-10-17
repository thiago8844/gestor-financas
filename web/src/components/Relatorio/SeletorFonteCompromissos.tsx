import type { FonteProjecao } from "../../types/relatorio";

const OPCOES_FONTE: { valor: FonteProjecao; label: string; ajuda: string }[] = [
  {
    valor: "TODAS",
    label: "Tudo",
    ajuda: "Despesas já lançadas e recorrências que ainda vão ser lançadas.",
  },
  {
    valor: "LANCADAS",
    label: "Só já lançadas",
    ajuda:
      "Só o consolidado: despesas pendentes já cadastradas, parcelas, faturas e recorrências que o sistema já gerou. Ideal para saber como ficaria o saldo se você pagasse tudo isso hoje.",
  },
  {
    valor: "RECORRENCIAS",
    label: "Só recorrências a lançar",
    ajuda:
      "Só as ocorrências futuras de recorrências que ainda não foram lançadas. Recorrência que já foi lançada conta em \"Só já lançadas\", nunca aqui.",
  },
];

type Props = {
  valor: FonteProjecao;
  onChange: (valor: FonteProjecao) => void;
  /** Esconde o texto de ajuda (uso compacto, como no dashboard). */
  compacto?: boolean;
};

/** Escolhe se a conta considera o que já está lançado, só as recorrências futuras ou os dois. */
export function SeletorFonteCompromissos({ valor, onChange, compacto }: Props) {
  return (
    <div>
      <div className="btn-group w-100" role="group" aria-label="Quais despesas considerar">
        {OPCOES_FONTE.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            className={`btn btn-sm ${valor === opcao.valor ? "btn-primary" : "btn-outline-primary"}`}
            aria-pressed={valor === opcao.valor}
            onClick={() => onChange(opcao.valor)}
          >
            {opcao.label}
          </button>
        ))}
      </div>
      {!compacto && (
        <div className="text-muted small mt-2">
          <i className="bi bi-info-circle me-1"></i>
          {OPCOES_FONTE.find((o) => o.valor === valor)?.ajuda}
        </div>
      )}
    </div>
  );
}
