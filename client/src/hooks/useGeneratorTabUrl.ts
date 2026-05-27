import { useCallback, useEffect, useState } from "react";

const VALID_TABS = new Set([
  "manual",
  "csv",
  "jira",
  "record",
  "failure",
  "api",
  "performance",
]);

export function readTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("tab");
  return t && VALID_TABS.has(t) ? t : null;
}

export function useGeneratorTabUrl<T extends string>(
  initial: T,
  isValid: (t: string) => t is T = (t): t is T => VALID_TABS.has(t) as boolean
): [T, (t: T) => void] {
  const [tab, setTabState] = useState<T>(() => {
    const fromUrl = readTabFromUrl();
    if (fromUrl && isValid(fromUrl)) return fromUrl as T;
    return initial;
  });

  useEffect(() => {
    const onPop = () => {
      const fromUrl = readTabFromUrl();
      if (fromUrl && isValid(fromUrl)) setTabState(fromUrl as T);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isValid]);

  const setTab = useCallback(
    (t: T) => {
      setTabState(t);
      const u = new URL(window.location.href);
      if (t === initial) u.searchParams.delete("tab");
      else u.searchParams.set("tab", t);
      window.history.replaceState({}, "", u);
    },
    [initial]
  );

  return [tab, setTab];
}
