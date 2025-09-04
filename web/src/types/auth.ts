import type { User } from ".";

export type LoginResponse = {
  token: string;
  user: User;
};

export type RegisterResponse = {
  status: number;
};