import Select, { type StylesConfig } from "react-select";

export type OpcaoSelect = { value: number; label: string };

type Props = {
  opcoes: OpcaoSelect[];
  valor: number[];
  onChange: (valor: number[]) => void;
  placeholder?: string;
  id?: string;
};

// Aparência alinhada ao form-select do Bootstrap (bordas, raio, foco, cores do tema).
const estilos: StylesConfig<OpcaoSelect, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: "calc(1.5em + 0.75rem + 2px)",
    borderRadius: "var(--bs-border-radius)",
    borderColor: state.isFocused ? "#86b7fe" : "var(--bs-border-color)",
    boxShadow: state.isFocused ? "0 0 0 0.25rem rgba(13, 110, 253, 0.25)" : "none",
    "&:hover": { borderColor: state.isFocused ? "#86b7fe" : "var(--bs-border-color)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0.125rem 0.5rem" }),
  placeholder: (base) => ({ ...base, color: "var(--bs-secondary-color)" }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: "rgba(13, 110, 253, 0.1)",
    borderRadius: "var(--bs-border-radius-pill)",
    padding: "0 0.125rem",
  }),
  multiValueLabel: (base) => ({ ...base, color: "#0a58ca", fontSize: "0.85em" }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#0a58ca",
    borderRadius: "var(--bs-border-radius-pill)",
    "&:hover": { backgroundColor: "#0d6efd", color: "#fff" },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#0d6efd"
      : state.isFocused
        ? "rgba(13, 110, 253, 0.1)"
        : "transparent",
    color: state.isSelected ? "#fff" : "var(--bs-body-color)",
    cursor: "pointer",
  }),
  menu: (base) => ({ ...base, zIndex: 1050, borderRadius: "var(--bs-border-radius)" }),
  indicatorSeparator: () => ({ display: "none" }),
};

export function SelectMultiplo({ opcoes, valor, onChange, placeholder = "Todas", id }: Props) {
  return (
    <Select<OpcaoSelect, true>
      inputId={id}
      isMulti
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      options={opcoes}
      value={opcoes.filter((o) => valor.includes(o.value))}
      onChange={(selecionadas) => onChange(selecionadas.map((o) => o.value))}
      placeholder={placeholder}
      noOptionsMessage={() => "Nenhuma opção"}
      styles={estilos}
    />
  );
}
