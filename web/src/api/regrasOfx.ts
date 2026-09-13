import { api } from "../api-client";
import type { OfxImportRuleResponse, OfxImportRulesResponse } from "../types/ofx";

export async function getRegrasOfx() {
  const response = await api.get<OfxImportRulesResponse>("/regras-importacao-ofx");
  return response.data;
}

export async function criarRegraOfx(dados: {
  name?: string;
  descricao_contains: string;
  tipo?: "INCOME" | "EXPENSE";
  descricao?: string;
  category_id?: number;
  budget_id?: number;
  ofx_import_id?: number;
  aplicar_ao_lote?: boolean;
}) {
  const response = await api.post<OfxImportRuleResponse>("/regras-importacao-ofx/criar", dados);
  return response.data;
}

export async function aplicarRegraOfx(id: number, ofxImportId?: number) {
  const response = await api.post(`/regras-importacao-ofx/${id}/aplicar`, {
    ofx_import_id: ofxImportId,
  });
  return response.data;
}

export async function alternarAtivoRegraOfx(id: number) {
  const response = await api.patch(`/regras-importacao-ofx/${id}/alternar-ativo`);
  return response.data;
}

export async function deletarRegraOfx(id: number) {
  const response = await api.delete(`/regras-importacao-ofx/deletar/${id}`);
  return response.status;
}
