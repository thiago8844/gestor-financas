import type { Transacao } from "../../types/transacao";

const CAMPOS_DATA = [
  { value: "", label: "Automática (transação › vencimento › cadastro)" },
  { value: "date", label: "Data da transação" },
  { value: "purchase_date", label: "Data da compra" },
  { value: "due_date", label: "Data de vencimento" },
  { value: "created_at", label: "Data de cadastro" },
];

interface CampoDataSelectProps {
  value: string;
  onChange: (valor: string) => void;
  incluirCompra?: boolean;
  incluirVencimento?: boolean;
}

export function CampoDataSelect({
  value,
  onChange,
  incluirCompra = true,
  incluirVencimento = true,
}: CampoDataSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-select form-select-sm"
    >
      {CAMPOS_DATA.filter(
        (c) =>
          (incluirCompra || c.value !== "purchase_date") &&
          (incluirVencimento || c.value !== "due_date")
      ).map((campo) => (
        <option key={campo.value} value={campo.value}>
          {campo.label}
        </option>
      ))}
    </select>
  );
}

// Datas da transação, uma por linha, destacando a que está sendo usada no filtro/ordenação
export function DatasTransacao({
  transacao,
  campoAtivo,
  mostrarVencimento = true,
  mostrarCompra = true,
}: {
  transacao: Transacao;
  campoAtivo: string;
  mostrarVencimento?: boolean;
  mostrarCompra?: boolean;
}) {
  const itens = [
    { campo: "date", rotulo: "Transação", valor: transacao.date },
    ...(mostrarCompra
      ? [{ campo: "purchase_date", rotulo: "Compra", valor: transacao.purchase_date_fmt }]
      : []),
    ...(mostrarVencimento
      ? [{ campo: "due_date", rotulo: "Vencimento", valor: transacao.due_date }]
      : []),
    { campo: "created_at", rotulo: "Cadastro", valor: transacao.created_at_fmt },
  ];

  return (
    <div className="small lh-sm">
      {itens.map((item) => (
        <div
          key={item.campo}
          className={item.campo === campoAtivo ? "fw-semibold" : "text-muted"}
        >
          <span className="me-1">{item.rotulo}:</span>
          {item.valor ?? "-"}
        </div>
      ))}
    </div>
  );
}

// Filtro de situação: tudo, só pendentes ou só concluídas (pagas/recebidas)
export function SituacaoSelect({
  value,
  onChange,
  rotuloConcluidas,
}: {
  value: string;
  onChange: (valor: string) => void;
  rotuloConcluidas: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-select form-select-sm"
    >
      <option value="">Todas</option>
      <option value="PENDING">Somente pendentes</option>
      <option value="PAID">Somente {rotuloConcluidas}</option>
    </select>
  );
}
