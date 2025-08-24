import { create } from "zustand";

//Tipagem do usuário
type User = {
  id: string;
  name: string;
  email: string;
};

//Tipagem do estado global de autenticação
type AuthState = {
  user: User | null;
  token: string | null;
  setToken: (token: string) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
};

//Closure com o estado e as ações
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setToken: (token: string) => {
    //Adicionar lógica de validação do token 

    localStorage.setItem("ACCESS_TOKEN", token);
    set({ token });
  },
  setUser: (user: User | null) => set({ user }),
  logout: () => {
    localStorage.removeItem("ACCESS_TOKEN");
    set({ user: null, token: null });
  },
}));
