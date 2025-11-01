// src/components/Listagens/Listagem.tsx
import type { ReactNode } from "react";
import { Dropdown } from "react-bootstrap";

// ✅ COMPONENTE PRINCIPAL
interface ListagemProps {
  children: ReactNode;
}

export function Listagem({ children }: ListagemProps) {
  return <div className="listagem-container">{children}</div>;
}

// ✅ HEADER COM BOTÕES E FILTROS
interface HeaderProps {
  children: ReactNode;
}

Listagem.Header = function Header({ children }: HeaderProps) {
  return (
    <div className="d-flex justify-content-between align-items-center mb-4">
      {children}
    </div>
  );
};

// ✅ ÁREA DE AÇÕES (BOTÕES NO CANTO ESQUERDO)
interface AcoesProps {
  children: ReactNode;
}

Listagem.Acoes = function Acoes({ children }: AcoesProps) {
  return <div className="d-flex gap-2">{children}</div>;
};

// ✅ ÁREA DE CONTROLES (DIREITA: FILTROS, ORDENAR, ETC)
interface ControlesProps {
  children: ReactNode;
}

Listagem.Controles = function Controles({ children }: ControlesProps) {
  return <div className="d-flex gap-2">{children}</div>;
};

// ✅ SELECT DE LIMITE
interface LimiteSelectorProps {
  value: number;
  onChange: (limit: number) => void;
  options?: number[];
}

Listagem.LimiteSelector = function LimiteSelector({
  value,
  onChange,
  options = [25, 50, 75, 100],
}: LimiteSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="form-select form-select-sm"
      style={{ width: "80px" }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};

// ✅ DROPDOWN DE FILTROS
interface FiltrosDropdownProps {
  children: ReactNode;
  onAplicar: () => void;
  onLimpar: () => void;
}

Listagem.FiltrosDropdown = function FiltrosDropdown({
  children,
  onAplicar,
  onLimpar,
}: FiltrosDropdownProps) {
  return (
    <Dropdown>
      <Dropdown.Toggle variant="outline-secondary" id="filtros-dropdown">
        <i className="bi bi-funnel me-2"></i>
        Filtros
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ minWidth: "250px" }}>
        <Dropdown.Header>Filtrar por:</Dropdown.Header>

        {/* ✅ CONTEÚDO CUSTOMIZÁVEL */}
        <div className="px-3 py-2">{children}</div>

        <Dropdown.Divider />

        {/* ✅ BOTÕES FIXOS */}
        <div className="px-3 py-2 d-flex gap-2">
          <button
            onClick={onAplicar}
            className="btn btn-primary btn-sm flex-grow-1"
          >
            <i className="bi bi-check-circle-fill me-1"></i>
            Aplicar
          </button>
          <button
            onClick={onLimpar}
            className="btn btn-outline-secondary btn-sm"
          >
            <i className="bi bi-x-square-fill me-1"></i>
            Limpar
          </button>
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

// ✅ DROPDOWN DE ORDENAR
interface OrdenarDropdownProps {
  children: ReactNode;
}

Listagem.OrdenarDropdown = function OrdenarDropdown({
  children,
}: OrdenarDropdownProps) {
  return (
    <Dropdown>
      <Dropdown.Toggle variant="outline-secondary" id="ordenar-dropdown">
        <i className="bi bi-arrow-down-up me-2"></i>
        Ordenar
      </Dropdown.Toggle>

      <Dropdown.Menu style={{ minWidth: "250px" }}>
        <Dropdown.Header>Ordenar por:</Dropdown.Header>
        <div className="px-3 py-2">
          {children}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

// ✅ TABELA
interface TabelaProps {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  emptyMessage?: string;
}

Listagem.Tabela = function Tabela({
  headers,
  children,
  loading = false,
  emptyMessage = "Nenhum registro encontrado",
}: TabelaProps) {
  return (
    <div className="table-responsive">
      <table className="table table-bordered">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={headers.length} className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
      {!loading && !children && (
        <p className="text-muted text-center py-4">{emptyMessage}</p>
      )}
    </div>
  );
};

// ✅ PAGINAÇÃO
interface PaginacaoProps {
  children: ReactNode;
}

Listagem.Paginacao = function Paginacao({ children }: PaginacaoProps) {
  return <div className="mt-4">{children}</div>;
};
