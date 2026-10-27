import { api } from "../api-client";
import type {
  BaixaParcelaPayload,
  DirecaoEmprestimo,
  Emprestimo,
  EmprestimoPayload,
  EventoEmprestimo,
  ParcelaEmprestimo,
  PreviaEmprestimo,
  ResumoEmprestimos,
  StatusEmprestimo,
} from "../types/emprestimo";

export type FiltrosEmprestimos = {
  direction?: DirecaoEmprestimo;
  status?: StatusEmprestimo;
  overdue?: boolean;
};

export async function getEmprestimos(filtros: FiltrosEmprestimos = {}) {
  const response = await api.get<{ data: Emprestimo[] }>("/emprestimos", {
    params: { ...filtros, overdue: filtros.overdue ? 1 : undefined },
  });
  return response.data.data;
}

export async function getResumoEmprestimos() {
  const response = await api.get<{ data: ResumoEmprestimos }>("/emprestimos/resumo");
  return response.data.data;
}

export async function getEmprestimo(id: number) {
  const response = await api.get<{ data: Emprestimo }>(`/emprestimos/${id}`);
  return response.data.data;
}

export async function getHistoricoEmprestimo(id: number) {
  const response = await api.get<{ data: EventoEmprestimo[] }>(`/emprestimos/${id}/historico`);
  return response.data.data;
}

export async function previaEmprestimo(payload: EmprestimoPayload, signal?: AbortSignal) {
  const response = await api.post<{ data: PreviaEmprestimo }>("/emprestimos/previa", payload, { signal });
  return response.data.data;
}

export async function criarEmprestimo(payload: EmprestimoPayload) {
  const response = await api.post<{ data: Emprestimo; message?: string }>("/emprestimos/criar", payload);
  return response.data;
}

export async function atualizarEmprestimo(
  id: number,
  dados: Partial<Pick<Emprestimo, "counterparty" | "description" | "notes" | "account_id" | "category_id">>,
) {
  const response = await api.put<{ data: Emprestimo }>(`/emprestimos/atualizar/${id}`, dados);
  return response.data.data;
}

export async function deletarEmprestimo(id: number) {
  const response = await api.delete(`/emprestimos/deletar/${id}`);
  return response.status;
}

export async function encerrarEmprestimo(id: number, date: string) {
  const response = await api.post<{ data: Emprestimo }>(`/emprestimos/${id}/encerrar`, { date });
  return response.data.data;
}

export async function baixarParcela(emprestimoId: number, parcelaId: number, payload: BaixaParcelaPayload) {
  const response = await api.post<{ data: ParcelaEmprestimo }>(
    `/emprestimos/${emprestimoId}/parcelas/${parcelaId}/baixar`,
    payload,
  );
  return response.data.data;
}

export async function reverterParcela(emprestimoId: number, parcelaId: number) {
  const response = await api.post<{ data: ParcelaEmprestimo }>(
    `/emprestimos/${emprestimoId}/parcelas/${parcelaId}/reverter`,
  );
  return response.data.data;
}

export async function registrarNaoPaga(emprestimoId: number, parcelaId: number, note?: string) {
  const response = await api.post(`/emprestimos/${emprestimoId}/parcelas/${parcelaId}/nao-paga`, { note });
  return response.data;
}
