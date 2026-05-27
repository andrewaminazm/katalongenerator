import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type UiState = {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setCommandOpen: (v: boolean) => void;
};

const UiContext = createContext<UiState | null>(null);

export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("katalon:sidebar_collapsed") === "1";
  });
  const [commandOpen, setCommandOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c;
      localStorage.setItem("katalon:sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      commandOpen,
      setSidebarCollapsed: (v: boolean) => {
        localStorage.setItem("katalon:sidebar_collapsed", v ? "1" : "0");
        setSidebarCollapsed(v);
      },
      toggleSidebar,
      setCommandOpen,
    }),
    [sidebarCollapsed, commandOpen, toggleSidebar]
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUiStore(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUiStore must be used within UiStoreProvider");
  return ctx;
}
