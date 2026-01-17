import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCategorias, type Categoria } from "../../../api/categoria";

//TODO: ENTENDDER MELHOR ESSE COMPONENTE E REMOVER ESTADO DE LOADING

// ✅ CSS PARA ANIMAÇÃO DE LOADING
const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ✅ ADICIONA CSS NO HEAD SE NÃO EXISTIR
if (
  typeof document !== "undefined" &&
  !document.getElementById("categoria-select-styles")
) {
  const style = document.createElement("style");
  style.id = "categoria-select-styles";
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

type CategoriaSelectProps = {
  value?: string;
  onChange?: (value: string, categoryId?: number) => void;
  placeholder?: string;
};

export function CategoriaAutocomplete({
  value = "",
  onChange,
  placeholder = "Digite uma categoria...",
}: CategoriaSelectProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ✅ BUSCA CATEGORIAS DO BACKEND
  const {
    data: categorias = [],
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => getCategorias(),
    select: (response) => response.data, // ✅ Extrai só o array data
    staleTime: 30 * 1000, // ✅ 30 segundos - vai refetch mais frequentemente
  });

  // ✅ MOSTRA CATEGORIAS FILTRADAS OU TODAS
  const suggestions =
    inputValue.length > 0
      ? categorias.filter((cat: Categoria) =>
          cat.name.toLowerCase().includes(inputValue.toLowerCase())
        )
      : categorias; // ✅ SE NÃO TEM TEXTO, MOSTRA TODAS

  // ✅ FECHA DROPDOWN AO CLICAR FORA
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ MUDANÇA NO INPUT
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setInputValue(newValue);
    setShowSuggestions(true); // ✅ SEMPRE MOSTRA DROPDOWN AO DIGITAR
    onChange?.(newValue);
  };

  // ✅ CLIQUE NO INPUT = ATUALIZA CATEGORIAS E MOSTRA DROPDOWN
  const handleInputFocus = () => {
    setShowSuggestions(true);
    refetch(); // ✅ REFAZ A BUSCA NO BACKEND
  };

  // ✅ SELECIONA CATEGORIA
  const selectCategory = (categoria: Categoria) => {
    setInputValue(categoria.name);
    setShowSuggestions(false);
    onChange?.(categoria.name, categoria.id);
  };

  // ✅ ENCONTRA CATEGORIA EXISTENTE
  // const existingCategory = categorias.find(
  //   (c: Categoria) => c.name.toLowerCase() === inputValue.toLowerCase()
  // );

  return (
    <div ref={dropdownRef} className="position-relative">
      {/* ✅ INPUT SIMPLES */}
      <input
        type="text"
        className="form-control"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleInputFocus} // ✅ MOSTRA DROPDOWN AO CLICAR
        placeholder={placeholder}
      />

      {/* ✅ DROPDOWN SEMPRE COM SUGESTÕES */}
      {showSuggestions && (
        <div
          className="position-absolute w-100 mt-1 bg-white border rounded shadow-sm"
          style={{ zIndex: 1000, maxHeight: "200px", overflowY: "auto" }}
        >
          {/* ✅ INDICADOR DE LOADING */}
          {isFetching && (
            <div className="p-2 text-center text-muted">
              <i
                className="bi bi-arrow-clockwise me-2"
                style={{
                  animation: "spin 1s linear infinite",
                  transformOrigin: "center",
                }}
              ></i>
              Atualizando categorias...
            </div>
          )}

          {/* ✅ LISTA DE CATEGORIAS */}
          {!isFetching && suggestions.length > 0 ? (
            suggestions.map((categoria: Categoria) => (
              <div
                key={categoria.id}
                className="p-2 cursor-pointer hover:bg-light"
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) =>
                  ((e.target as HTMLDivElement).style.backgroundColor =
                    "#f8f9fa")
                }
                onMouseLeave={(e) =>
                  ((e.target as HTMLDivElement).style.backgroundColor = "white")
                }
                onClick={() => selectCategory(categoria)}
              >
                {categoria.name}
              </div>
            ))
          ) : !isFetching ? (
            // ✅ QUANDO NÃO ENCONTRA NADA (e não está carregando)
            <div className="p-2 text-muted">
              Nenhuma categoria encontrada para "{inputValue}"
            </div>
          ) : null}
        </div>
      )}

      {/* ✅ HELPER SIMPLES 
      <small className="form-text">
        {existingCategory ? (
          <span className="text-success">✓ Categoria existente</span>
        ) : inputValue ? (
          <span className="text-primary">+ Nova categoria "{inputValue}"</span>
        ) : (
          <span className="text-muted">
            Clique para ver categorias ou digite para criar nova
          </span>
        )}
      </small>
      */}
    </div>
  );
}

// ✅ TESTE ATUALIZADO COM DADOS REAIS
export function TesteCategoria() {
  const [categoria, setCategoria] = useState("");
  const [categoriaId, setCategoriaId] = useState<number>();

  return (
    <div className="container mt-4">
      <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div className="card-body">
          <h5>🧪 Teste Categoria - Backend Real</h5>

          <CategoriaAutocomplete
            value={categoria}
            onChange={(name, id) => {
              setCategoria(name);
              setCategoriaId(id);
            }}
          />

          <div className="mt-3 p-2 bg-light rounded">
            <strong>Nome:</strong> {categoria || "(vazio)"}
            <br />
            <strong>ID:</strong> {categoriaId || "Nova categoria"}
          </div>

          {/* ✅ SIMULAÇÃO */}
          <div className="alert alert-info mt-3">
            <strong>💡 Resultado:</strong>
            <br />
            {categoriaId ? (
              <>
                Usaria categoria existente: <strong>"{categoria}"</strong> (ID:{" "}
                {categoriaId})
              </>
            ) : categoria ? (
              <>
                Criaria nova categoria: <strong>"{categoria}"</strong>
              </>
            ) : (
              <>Sem categoria selecionada</>
            )}
          </div>

          {/* ✅ BOTÕES DE TESTE */}
          <div className="mt-3 d-flex gap-2">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setCategoria("");
                setCategoriaId(undefined);
              }}
            >
              Limpar
            </button>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => {
                setCategoria("ENERGIA");
                setCategoriaId(undefined);
              }}
            >
              Testar "ENERGIA"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
