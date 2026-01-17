import { api } from "../api-client";
import type { LoginRequest, RegisterUserRequest } from "../schemas/auth";
import type { User } from "../types";
import type { LoginResponse } from "../types/auth";

export const getUser = async (): Promise<User> => {
  const response = await api.get<{user: User}>("/user");
  return response.data.user;
};

export const login = async (payload: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>("/login", payload);
  return response.data;
};

export const registerUser = async (
  payload: RegisterUserRequest
): Promise<number> => {
  const response = await api.post("/cadastro", payload);
  return response.status;
};

export const logout = async (): Promise<number> => {
  const response = await api.post("/logout");
  return response.status;
};
