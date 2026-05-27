import { createContext, useContext } from "react";

export type LayoutContextValue = {
  embedded: boolean;
  pageTitle?: string;
};

const LayoutContext = createContext<LayoutContextValue>({ embedded: false });

export function LayoutProvider({
  value,
  children,
}: {
  value: LayoutContextValue;
  children: React.ReactNode;
}) {
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayoutContext(): LayoutContextValue {
  return useContext(LayoutContext);
}
