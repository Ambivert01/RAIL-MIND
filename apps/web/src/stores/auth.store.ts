import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: any, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        // CQ-018 FIX: Store only via Zustand persist — removed duplicate localStorage.setItem
        // api-client reads from the persisted zustand store key via getState().token
        set({ user, token, isAuthenticated: true });
      },
      clearAuth: () => {
        // CQ-021 FIX: Clear both the state and the persist store
        set({ user: null, token: null, isAuthenticated: false });
        // Ensure the persist key is wiped so rehydration doesn't restore stale token
        if (typeof window !== "undefined") {
          try { localStorage.removeItem("railmind-auth"); } catch { }
        }
      },
    }),
    {
      name: "railmind-auth",
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    },
  ),
);

// Helper to get token synchronously for axios interceptor
export const getAuthToken = (): string | null =>
  useAuthStore.getState().token;
