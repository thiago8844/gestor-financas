import axios from "axios";
import { ACCESS_TOKEN_KEY } from "./config/config";
import { useAuthStore } from "./stores/auth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
});

api.defaults.headers.common["Accept"] = "application/json"; //Somente aceita json

//Usa o token em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  config.headers.Authorization = `Bearer ${token}`;

  return config;
});

//Revoga o token caso ele existe e receba resposta 401
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response.status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);
