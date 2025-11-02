// src/components/Paginator.tsx
interface PaginatorProps {
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
  };
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function Paginator({
  meta,
  onPageChange,
  isLoading = false,
}: PaginatorProps) {
  
  const { current_page, last_page, total, from, to } = meta;

  // ✅ GERA ARRAY DE PÁGINAS PARA MOSTRAR
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5; // Máximo de páginas visíveis

    if (last_page <= maxVisible) {
      // Se tem poucas páginas, mostra todas
      for (let i = 1; i <= last_page; i++) {
        pages.push(i);
      }
    } else {
      // Lógica para muitas páginas
      pages.push(1);

      if (current_page > 3) {
        pages.push("...");
      }

      for (
        let i = Math.max(2, current_page - 1);
        i <= Math.min(last_page - 1, current_page + 1);
        i++
      ) {
        pages.push(i);
      }

      if (current_page < last_page - 2) {
        pages.push("...");
      }

      pages.push(last_page);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="d-flex justify-content-between align-items-center mt-4">
      {/* ✅ INFORMAÇÕES DA PAGINAÇÃO */}
      <div className="text-muted">
        Mostrando {from} a {to} de {total} resultados
      </div>

      {/* ✅ NAVEGAÇÃO */}
      <nav aria-label="Navegação da paginação">
        <ul className="pagination mb-0">
          {/* ANTERIOR */}
          <li className={`page-item ${current_page === 1 ? "disabled" : ""}`}>
            <button
              className="page-link"
              onClick={() => onPageChange(current_page - 1)}
              disabled={current_page === 1 || isLoading}
            >
              <i className="bi bi-chevron-left"></i> 
            </button>
          </li>

          {/* NÚMEROS DAS PÁGINAS */}
          {pages.map((page, index) => (
            <li
              key={index}
              className={`page-item ${
                page === current_page
                  ? "active"
                  : page === "..."
                  ? "disabled"
                  : ""
              }`}
            >
              {page === "..." ? (
                <span className="page-link">...</span>
              ) : (
                <button
                  className="page-link"
                  onClick={() => onPageChange(page as number)}
                  disabled={isLoading}
                >
                  {page}
                </button>
              )}
            </li>
          ))}

          {/* PRÓXIMA */}
          <li
            className={`page-item ${
              current_page === last_page ? "disabled" : ""
            }`}
          >
            <button
              className="page-link"
              onClick={() => onPageChange(current_page + 1)}
              disabled={current_page === last_page || isLoading}
            >
               <i className="bi bi-chevron-right"></i>
            </button>
          </li>
        </ul>
      </nav>


    </div>
  );
}
