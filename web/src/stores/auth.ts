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
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(ACCESS_TOKEN_KEY) || null,
  loading: true,

  fetchUser: async () => {
    set({ loading: true });
    try {
      const user = await getUser();
      console.log("Fetched user:", user);
      set({ user, loading: false });
    } catch (error) {
      console.error("Failed to fetch user:", error);
      set({ user: null, token: null, loading: false });
    }
  },

  setToken: (token: string) => {
    //Adicionar lógica de validação do token

    localStorage.setItem(ACCESS_TOKEN_KEY, token);
    set({ token });
  },

  setUser: (user: User | null) => set({ user }),

  logout: () => {
    //TODO: COLOCAR PRA RETORNAR TRUE OR FALSE PARA SABER O LOGOUT FOI BEM SUCEDIDO E ELIMNAR O CACHE
    const token = get().token; // 👈 pega o token do estado

    if (token) {
      api
        .post("/logout")
        .then(() => {
          set({ user: null, token: null });
        })
        .catch((error) => {
          console.warn("Failed to revoke token in backend:", error);
          set({ user: null, token: null });
        });
    }

    localStorage.removeItem(ACCESS_TOKEN_KEY); // 👈 usa a mesma constante
  },
}));
