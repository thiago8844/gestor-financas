// src/components/Listagens/Listagem.tsx
import { Children, useEffect, useState, type ReactNode } from "react";
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
    <div className="d-flex flex-column flex-lg-row justify-content-between align-items-stretch align-items-lg-center gap-2 mb-4">
      {children}
    </div>
  );
};

// ✅ ÁREA DE AÇÕES (BOTÕES NO CANTO ESQUERDO)
interface AcoesProps {
  children: ReactNode;
}

Listagem.Acoes = function Acoes({ children }: AcoesProps) {
  return <div className="d-flex flex-wrap gap-2">{children}</div>;
};

// ✅ ÁREA DE CONTROLES (DIREITA: FILTROS, ORDENAR, ETC)
interface ControlesProps {
  children: ReactNode;
}

Listagem.Controles = function Controles({ children }: ControlesProps) {
  return <div className="d-flex flex-wrap flex-lg-nowrap gap-2">{children}</div>;
};

// ✅ CAMPO DE BUSCA (aplica após uma pausa na digitação)
interface BuscaProps {
  value: string;
  onChange: (texto: string) => void;
  placeholder?: string;
  delay?: number;
}

Listagem.Busca = function Busca({
  value,
  onChange,
  placeholder = "Buscar por nome...",
  delay = 400,
}: BuscaProps) {
  const [texto, setTexto] = useState(value);

  // Mantém o campo sincronizado quando o filtro é limpo de fora (ex: botão Limpar)
  useEffect(() => {
    setTexto(value);
  }, [value]);

  useEffect(() => {
    if (texto === value) return;
    const timer = setTimeout(() => onChange(texto), delay);
    return () => clearTimeout(timer);
  }, [texto, value, onChange, delay]);

  return (
    <div
      className="input-group input-group-sm flex-grow-1 flex-lg-grow-0"
      style={{ minWidth: "180px", maxWidth: "320px", width: "240px" }}
    >
      <span className="input-group-text">
        <i className="bi bi-search"></i>
      </span>
      <input
        type="search"
        className="form-control"
        placeholder={placeholder}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
    </div>
  );
};

// ✅ SELECT DE LIMITE (0 = todos os registros)
interface LimiteSelectorProps {
  value: number;
  onChange: (limit: number) => void;
  options?: number[];
}

Listagem.LimiteSelector = function LimiteSelector({
  value,
  onChange,
  options = [25, 50, 75, 100, 0],
}: LimiteSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="form-select form-select-sm"
      style={{ width: "90px" }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === 0 ? "Todos" : opt}
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
  /** Quantidade de filtros ativos, exibida como badge no botão */
  ativos?: number;
}

Listagem.FiltrosDropdown = function FiltrosDropdown({
  children,
  onAplicar,
  onLimpar,
  ativos = 0,
}: FiltrosDropdownProps) {
  return (
    <Dropdown>
      <Dropdown.Toggle variant="outline-secondary" id="filtros-dropdown">
        <i className="bi bi-funnel me-2"></i>
        Filtros
        {ativos > 0 && (
          <span className="badge rounded-pill text-bg-primary ms-2">
            {ativos}
          </span>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        style={{ minWidth: "250px", maxHeight: "70vh", overflowY: "auto" }}
      >
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
        <div className="px-3 py-2">{children}</div>
      </Dropdown.Menu>
    </Dropdown>
  );
};

// ✅ SELETOR SEGMENTADO (ex: Todas | Contas financeiras | Cartão), aplicado na hora
interface SegmentadoOpcao {
  value: string;
  label: string;
  icon?: string;
}

interface SegmentadoProps {
  value: string;
  onChange: (valor: string) => void;
  opcoes: SegmentadoOpcao[];
  ariaLabel?: string;
}

Listagem.Segmentado = function Segmentado({
  value,
  onChange,
  opcoes,
  ariaLabel,
}: SegmentadoProps) {
  return (
    <div className="btn-group w-100 mb-3" role="group" aria-label={ariaLabel}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.value}
          type="button"
          className={`btn btn-sm ${
            value === opcao.value ? "btn-primary" : "btn-outline-secondary"
          }`}
          aria-pressed={value === opcao.value}
          onClick={() => onChange(opcao.value)}
        >
          {opcao.icon && <i className={`bi ${opcao.icon} me-1`}></i>}
          {opcao.label}
        </button>
      ))}
    </div>
  );
};

// ✅ TABELA
interface TabelaProps {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  emptyMessage?: string;
  /** Versão em cards para telas pequenas (< md). Se informada, a tabela só aparece a partir de md. */
  mobile?: ReactNode;
}

Listagem.Tabela = function Tabela({
  headers,
  children,
  loading = false,
  emptyMessage = "Nenhum registro encontrado",
  footer,
  mobile,
}: TabelaProps & { footer?: ReactNode }) {
  const vazio = Children.count(children) === 0;

  const semDados = !loading && vazio;

  return (
    <>
      {mobile !== undefined && (
        <div className="d-md-none">
          {loading ? (
            <div className="text-center py-5 bg-light rounded">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
            </div>
          ) : semDados ? (
            <div className="text-center py-5 bg-light rounded">
              <i className="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
              <p className="text-muted mb-0">{emptyMessage}</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">{mobile}</div>
          )}
          {!loading && footer && (
            <div className="shadow-sm rounded mt-2 overflow-hidden">{footer}</div>
          )}
        </div>
      )}
    <div
      className={`table-responsive shadow-sm rounded ${
        mobile !== undefined ? "d-none d-md-block" : ""
      }`}
    >
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="text-uppercase fw-semibold text-muted small py-3 px-2"
                style={{
                  borderBottom: "2px solid #dee2e6",
                  letterSpacing: "0.5px",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={headers.length}
                className="text-center py-5 bg-light"
              >
                <div className="d-flex flex-column align-items-center gap-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                  </div>
                  <p className="text-muted mb-0 small">Carregando dados...</p>
                </div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
        {(!loading && footer) && (
          <tfoot>
            <tr>
              <td colSpan={headers.length}>{footer}</td>
            </tr>
          </tfoot>
        )}
      </table>
      {!loading && vazio && (
        <div className="text-center py-5 bg-light">
          <i className="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
          <p className="text-muted mb-0">{emptyMessage}</p>
        </div>
      )}
    </div>
    </>
  );
};

// ✅ PAGINAÇÃO
interface PaginacaoProps {
  children: ReactNode;
}

Listagem.Paginacao = function Paginacao({ children }: PaginacaoProps) {
  return <div className="mt-4">{children}</div>;
};
