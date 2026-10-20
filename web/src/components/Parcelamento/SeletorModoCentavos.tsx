import { MODOS_CENTAVOS, type ModoCentavos } from "../../utils/parcelas";

type Props = {
  valor: ModoCentavos;
  onChange: (modo: ModoCentavos) => void;
};

/** Cada banco/vendedor distribui os centavos da divisão de um jeito; o usuário escolhe o do seu caso. */
export function SeletorModoCentavos({ valor, onChange }: Props) {
  const atual = MODOS_CENTAVOS.find((m) => m.valor === valor);

  return (
    <div>
      <label className="form-label mb-1">Como distribuir os centavos que sobram</label>
      <select
        className="form-select form-select-sm"
        value={valor}
        onChange={(e) => onChange(e.target.value as ModoCentavos)}
      >
        {MODOS_CENTAVOS.map((m) => (
          <option key={m.valor} value={m.valor}>
            {m.rotulo}
          </option>
        ))}
      </select>
      {atual && <div className="form-text">{atual.ajuda}. Depois você ainda pode ajustar cada parcela.</div>}
    </div>
  );
}
