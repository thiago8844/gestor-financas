import { api } from "../api-client";

export interface Categoria {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
  icon: string | null;
  qtd_transacoes?: number;
  created_at: string;
  updated_at: string;
}

export interface CategoriasResponse {
  data: Categoria[];
}

// ✅ BUSCAR TODAS AS CATEGORIAS
export function getCategorias(filtros?: {
  search?: string;
}): Promise<CategoriasResponse> {
  return api.get("/categorias", { params: filtros });
}

// ✅ CRIAR NOVA CATEGORIA (para implementar depois)
export function criarCategoria(name: string): Promise<{ data: Categoria }> {
  return api.post("/categorias/criar", { name });
}

export function editarCategoria(id: number, name: string): Promise<{ data: Categoria }> {
  return api.patch(`/categorias/editar/${id}`, { name });
}

export function deleteCategoria(id: number) {
  return api.delete(`/categorias/delete/${id}`);
}