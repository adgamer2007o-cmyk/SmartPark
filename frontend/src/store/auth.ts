import { create } from "zustand";
import { http } from "../lib/api";
import type { User } from "../lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  load: async () => {
    try {
      const { user } = await http.get<{ user: User }>("/api/auth/me");
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const { user } = await http.post<{ user: User }>("/api/auth/login", { email, password });
    set({ user });
    return user;
  },
  register: async (payload) => {
    const { user } = await http.post<{ user: User }>("/api/auth/register", payload);
    set({ user });
    return user;
  },
  logout: async () => {
    await http.post("/api/auth/logout");
    set({ user: null });
  },
}));
