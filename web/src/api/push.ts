import { api } from "../api-client";

export async function getChavePublicaPush() {
  const response = await api.get<{ public_key: string | null }>("/push/chave-publica");
  return response.data.public_key;
}

export async function registrarInscricaoPush(inscricao: PushSubscriptionJSON) {
  await api.post("/push/inscricoes", inscricao);
}

export async function removerInscricaoPush(endpoint: string) {
  await api.delete("/push/inscricoes", { data: { endpoint } });
}
