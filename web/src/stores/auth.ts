import { create } from "zustand";
import type { User } from "../types";
import { getUser } from "../api/auth";
import { ACCESS_TOKEN_KEY } from "../config/config";
import { api } from "../api-client";

//Tipagem do estado global de autenticação
type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  fetchUser: () => Promise<void>;
  setToken: (token: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
};

//Closure com o estado e as ações
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(ACCESS_TOKEN_KEY) || null,
  loading: true,

  fetchUser: async () => {
    set({ loading: true });
    try {
      const user = await getUser();
      set({ user, loading: false });
    } catch (error) {
      console.error("Failed to fetch user:", error);
      set({ user: null, token: null, loading: false });
    }
  },

  setToken: (token: string) => {
    //Adicionar lógica de validação do token

    localStorage.setItem("ACCESS_TOKEN", token);
    set({ token });
  },

  setUser: (user: User | null) => set({ user }),

  logout: () => {
    api.post("/logout").catch((error) => {
      console.warn("Failed to revoke token in backend:", error);
    });
    
    localStorage.removeItem("ACCESS_TOKEN");
    set({ user: null, token: null });
  },
}));
