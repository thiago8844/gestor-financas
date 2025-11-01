import { api } from "../api-client";

export interface Categoria {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoriasResponse {
  data: Categoria[];
}

// ✅ BUSCAR TODAS AS CATEGORIAS
export function getCategorias(): Promise<CategoriasResponse> {
  return api.get("/categorias");
}

// ✅ CRIAR NOVA CATEGORIA (para implementar depois)
export function criarCategoria(name: string): Promise<{ data: Categoria }> {
  return api.post("/categorias", { name });
}
