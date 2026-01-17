import { api } from "../api-client";

export const getDashboardData = async () => {
  const response = await api.get("/dashboard-data");
  return response.data;
}