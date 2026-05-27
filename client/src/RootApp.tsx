import { lazy, Suspense } from "react";
import { PlatformShell } from "./components/layout/PlatformShell";
import { readTabFromUrl } from "./hooks/useGeneratorTabUrl";
import GeneratorPage from "./pages/GeneratorPage";
import { UiStoreProvider } from "./stores/uiStore";
import { ThemeProvider } from "./theme/ThemeProvider";
import { usePathname } from "./hooks/usePathname";

const HowToUse = lazy(() => import("./pages/HowToUse"));
const AIWorkspace = lazy(() => import("./pages/AIWorkspace"));
const CoverageAnalyzer = lazy(() => import("./pages/CoverageAnalyzer"));
const RefactoringAssistant = lazy(() => import("./pages/RefactoringAssistant"));

function PageFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
      Loading {label}…
    </div>
  );
}

function RoutedContent({ pathname }: { pathname: string }) {
  const generatorTab = pathname === "/" ? readTabFromUrl() : null;

  if (pathname === "/how-to-use" || pathname.startsWith("/how-to-use/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "Documentation",
          subtitle: "Guides, workflows, and troubleshooting",
        }}
      >
        <Suspense fallback={<PageFallback label="documentation" />}>
          <HowToUse />
        </Suspense>
      </PlatformShell>
    );
  }

  if (pathname === "/ai-workspace" || pathname.startsWith("/ai-workspace/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "Gosi Brain QA Workspace",
          subtitle: "Conversational QA engineering",
        }}
      >
        <Suspense fallback={<PageFallback label="AI Workspace" />}>
          <AIWorkspace />
        </Suspense>
      </PlatformShell>
    );
  }

  if (pathname === "/coverage" || pathname.startsWith("/coverage/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "Coverage Analyzer",
          subtitle: "SonarQube-style QA coverage intelligence",
        }}
      >
        <Suspense fallback={<PageFallback label="Coverage Analyzer" />}>
          <CoverageAnalyzer />
        </Suspense>
      </PlatformShell>
    );
  }

  if (pathname === "/refactor" || pathname.startsWith("/refactor/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "Refactoring Assistant",
          subtitle: "Framework maintainability and architecture insights",
        }}
      >
        <Suspense fallback={<PageFallback label="Refactoring Assistant" />}>
          <RefactoringAssistant />
        </Suspense>
      </PlatformShell>
    );
  }

  return <GeneratorPage pathname={pathname} generatorTab={generatorTab} />;
}

export default function RootApp() {
  const pathname = usePathname();

  return (
    <ThemeProvider>
      <UiStoreProvider>
        <div className="h-full min-h-screen">
          <RoutedContent pathname={pathname} />
        </div>
      </UiStoreProvider>
    </ThemeProvider>
  );
}
