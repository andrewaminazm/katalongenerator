import { lazy, Suspense, useEffect, useState } from "react";
import App from "./App";

const HowToUse = lazy(() => import("./pages/HowToUse"));
const AIWorkspace = lazy(() => import("./pages/AIWorkspace"));
const CoverageAnalyzer = lazy(() => import("./pages/CoverageAnalyzer"));
const RefactoringAssistant = lazy(() => import("./pages/RefactoringAssistant"));

function isHowToUseRoute(pathname: string): boolean {
  return pathname === "/how-to-use" || pathname.startsWith("/how-to-use/");
}

function isAiWorkspaceRoute(pathname: string): boolean {
  return pathname === "/ai-workspace" || pathname.startsWith("/ai-workspace/");
}

function isCoverageRoute(pathname: string): boolean {
  return pathname === "/coverage" || pathname.startsWith("/coverage/");
}

function isRefactorRoute(pathname: string): boolean {
  return pathname === "/refactor" || pathname.startsWith("/refactor/");
}

function usePathname(): string {
  const [pathname, setPathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : "/"
  );

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return pathname;
}

/**
 * Minimal pathname switch — mounts the main generator or the isolated docs center.
 * Does not modify App.tsx or any existing generator UI.
 */
export default function RootApp() {
  const pathname = usePathname();

  if (isHowToUseRoute(pathname)) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "system-ui, sans-serif",
              color: "#5c5c5c",
            }}
          >
            Loading documentation…
          </div>
        }
      >
        <HowToUse />
      </Suspense>
    );
  }

  if (isAiWorkspaceRoute(pathname)) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "system-ui, sans-serif",
              color: "#5c5c5c",
            }}
          >
            Loading AI Workspace…
          </div>
        }
      >
        <AIWorkspace />
      </Suspense>
    );
  }

  if (isCoverageRoute(pathname)) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "system-ui, sans-serif",
              color: "#5c5c5c",
            }}
          >
            Loading Coverage Analyzer…
          </div>
        }
      >
        <CoverageAnalyzer />
      </Suspense>
    );
  }

  if (isRefactorRoute(pathname)) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "system-ui, sans-serif",
              color: "#5c5c5c",
            }}
          >
            Loading Refactoring Assistant…
          </div>
        }
      >
        <RefactoringAssistant />
      </Suspense>
    );
  }

  return <App />;
}
