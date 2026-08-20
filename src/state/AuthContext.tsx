import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import { listenEvent } from "../lib/tauri";
import type { AuthProfile } from "../lib/types";

interface AuthState {
  status: "checking" | "signed-out" | "signed-in";
  profile: AuthProfile | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("checking");
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .checkStoredLogin()
      .then((p) => {
        if (p) {
          setProfile(p);
          setStatus("signed-in");
        } else {
          setStatus("signed-out");
        }
      })
      .catch(() => setStatus("signed-out"));
  }, []);

  useEffect(() => {
    const un = listenEvent("auth://signed-out", () => {
      setProfile(null);
      setStatus("signed-out");
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  const login = useCallback(async () => {
    setError(null);
    try {
      const p = await api.startGoogleLogin();
      setProfile(p);
      setStatus("signed-in");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setProfile(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo(
    () => ({ status, profile, error, login, logout }),
    [status, profile, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
