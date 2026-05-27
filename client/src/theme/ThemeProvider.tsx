import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  dark: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("katalon:theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  controlledDark,
  onControlledDarkChange,
}: {
  children: ReactNode;
  /** When set, syncs with App.tsx existing dark state */
  controlledDark?: boolean;
  onControlledDarkChange?: (dark: boolean) => void;
}) {
  const [internalTheme, setInternalTheme] = useState<Theme>(readInitialTheme);

  const theme = controlledDark !== undefined ? (controlledDark ? "dark" : "light") : internalTheme;
  const dark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("katalon:theme", theme);
  }, [theme]);

  const setTheme = useCallback(
    (t: Theme) => {
      if (onControlledDarkChange) {
        onControlledDarkChange(t === "dark");
      } else {
        setInternalTheme(t);
      }
    },
    [onControlledDarkChange]
  );

  const toggleTheme = useCallback(() => {
    setTheme(dark ? "light" : "dark");
  }, [dark, setTheme]);

  const value = useMemo(
    () => ({ theme, dark, setTheme, toggleTheme }),
    [theme, dark, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
