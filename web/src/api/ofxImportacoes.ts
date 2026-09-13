import { api } from "../api-client";
import type { OfxImportResponse, OfxImportsResponse } from "../types/ofx";

export async function getImportacoesOfx() {
  const response = await api.get<OfxImportsResponse>("/importacoes-ofx");
  return response.data;
}

export async function getImportacaoOfx(id: number) {
  const response = await api.get<OfxImportResponse>(`/importacoes-ofx/${id}`);
  return response.data;
}

export async function importarOfx(dados: {
  arquivo: File;
  conta_id?: number;
  lembrar_conta?: boolean;
}) {
  const formData = new FormData();
  formData.append("arquivo", dados.arquivo);
  if (dados.conta_id) formData.append("conta_id", String(dados.conta_id));
  if (dados.lembrar_conta) formData.append("lembrar_conta", "1");

  const response = await api.post<OfxImportResponse>("/importacoes-ofx", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function atualizarItemOfx(
  importacaoId: number,
  itemId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any
) {
  const response = await api.patch(`/importacoes-ofx/${importacaoId}/itens/${itemId}`, dados);
  return response.data;
}

export async function atualizarItensOfxEmMassa(
  importacaoId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any
) {
  const response = await api.patch(`/importacoes-ofx/${importacaoId}/itens/em-massa`, dados);
  return response.data;
}

export async function confirmarImportacaoOfx(importacaoId: number, ids: number[]) {
  const response = await api.post<OfxImportResponse>(`/importacoes-ofx/${importacaoId}/confirmar`, { ids });
  return response.data;
}

export async function desfazerImportacaoOfx(importacaoId: number, forcar = false) {
  const response = await api.post<OfxImportResponse>(`/importacoes-ofx/${importacaoId}/desfazer`, { forcar });
  return response.data;
}

export async function cancelarImportacaoOfx(importacaoId: number) {
  const response = await api.delete(`/importacoes-ofx/${importacaoId}/cancelar`);
  return response.data;
}
