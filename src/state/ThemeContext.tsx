import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";

type Theme = "dark" | "light";

const STORAGE_KEY = "deskmate-theme";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

interface ThemeState {
  theme: Theme;
  /** Toggles the theme with a circular-reveal animation centered on (x, y) — pass a click's clientX/clientY. */
  toggleTheme: (x: number, y: number) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(
    (x: number, y: number) => {
      const next: Theme = theme === "dark" ? "light" : "dark";

      const apply = () => setTheme(next);

      const canAnimate =
        typeof document !== "undefined" &&
        "startViewTransition" in document &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!canAnimate) {
        apply();
        return;
      }

      const root = document.documentElement;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      root.style.setProperty("--reveal-x", `${x}px`);
      root.style.setProperty("--reveal-y", `${y}px`);
      root.style.setProperty("--reveal-r", `${radius}px`);

      document.startViewTransition(() => {
        flushSync(apply);
      });
    },
    [theme],
  );

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
