import { api } from "../api-client";
import type { DadosFinanceirosResponse, HistoryMessage } from "../types/chatbot";

export async function getPrompt(): Promise<DadosFinanceirosResponse> {
  const response = await api.get("/prompt");
  return response.data;
}

export async function enviarMensagemChatbot(
  message: string,
  data: DadosFinanceirosResponse,
  history: HistoryMessage[],
): Promise<string> {
  const response = await api.post<{ reply: string }>("/chatbot", {
    message,
    dados_financeiros: data.dados_financeiros,
    history,
  });
  return response.data.reply;
}
