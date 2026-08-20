import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../lib/api";
import type { Settings } from "../lib/types";
import { useAuth } from "./AuthContext";

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  update: (next: Settings) => Promise<void>;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "signed-in") return;
    setLoading(true);
    api
      .getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, [status]);

  const update = useCallback(async (next: Settings) => {
    setSettings(next);
    await api.saveSettings(next);
  }, []);

  const value = useMemo(() => ({ settings, loading, update }), [settings, loading, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
