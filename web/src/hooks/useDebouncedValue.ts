import { useEffect, useState } from "react";

/** Valor que só muda depois de `delay` ms sem novas alterações (evita uma requisição por tecla). */
export function useDebouncedValue<T>(valor: T, delay = 400): T {
  const [debounced, setDebounced] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(valor), delay);
    return () => clearTimeout(timer);
  }, [valor, delay]);

  return debounced;
}
