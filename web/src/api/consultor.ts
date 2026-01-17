import { api } from "../api-client";

export async function getPrompt() {
  const response = await api.get("/prompt");

  return response.data.prompt;
}
