import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TopNavbarProps } from "./TopNavbar";

export type GeneratorChromeState = TopNavbarProps & {
  dark?: boolean;
};

type Ctx = {
  chrome: GeneratorChromeState;
  setChrome: (patch: Partial<GeneratorChromeState>) => void;
};

const GeneratorChromeContext = createContext<Ctx | null>(null);

export function GeneratorChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<GeneratorChromeState>({
    title: "Katalon Script Generator",
    subtitle: "AI-native QA automation studio",
  });

  const setChrome = useCallback((patch: Partial<GeneratorChromeState>) => {
    setChromeState((c) => ({ ...c, ...patch }));
  }, []);

  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);

  return (
    <GeneratorChromeContext.Provider value={value}>{children}</GeneratorChromeContext.Provider>
  );
}

export function useGeneratorChrome(): Ctx {
  const ctx = useContext(GeneratorChromeContext);
  if (!ctx) {
    return {
      chrome: {},
      setChrome: () => {},
    };
  }
  return ctx;
}
