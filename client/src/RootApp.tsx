import { lazy, Suspense } from "react";
import { SENIOR_QA_ENGINEER_DISPLAY } from "./data/seniorQaEngineer";
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
const ProjectGenerator = lazy(() => import("./pages/ProjectGenerator"));
const ProjectRepair = lazy(() => import("./pages/ProjectRepair"));
const ExecutionReport = lazy(() => import("./pages/ExecutionReport"));
const VideoTutorials = lazy(() => import("./pages/VideoTutorials"));

function PageFallback({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted">
      Loading {label}…
    </div>
  );
}

function RoutedContent({ pathname }: { pathname: string }) {
  const generatorTab = pathname === "/" ? readTabFromUrl() : null;

  if (pathname === "/video-tutorials" || pathname.startsWith("/video-tutorials/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "Video Tutorials",
          subtitle: "Walkthroughs for every major feature",
        }}
      >
        <Suspense fallback={<PageFallback label="Video Tutorials" />}>
          <VideoTutorials />
        </Suspense>
      </PlatformShell>
    );
  }

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
        mainClassName="min-h-0 flex-1 overflow-hidden"
        navbar={{
          title: "Test Architect Chat",
          subtitle: `${SENIOR_QA_ENGINEER_DISPLAY} — your new QA teammate`,
        }}
      >
        <Suspense fallback={<PageFallback label="Test Architect Chat" />}>
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

  if (pathname === "/project-generator" || pathname.startsWith("/project-generator/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "AI Project Generator",
          subtitle: "Enterprise Katalon project scaffolding",
        }}
      >
        <Suspense fallback={<PageFallback label="AI Project Generator" />}>
          <ProjectGenerator />
        </Suspense>
      </PlatformShell>
    );
  }

  if (pathname === "/project-repair" || pathname.startsWith("/project-repair/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "AI Project Repair Engine",
          subtitle: "Framework recovery with safe previews and diffs",
        }}
      >
        <Suspense fallback={<PageFallback label="AI Project Repair" />}>
          <ProjectRepair />
        </Suspense>
      </PlatformShell>
    );
  }

  if (pathname === "/execution-report" || pathname.startsWith("/execution-report/")) {
    return (
      <PlatformShell
        pathname={pathname}
        navbar={{
          title: "AI Execution Report",
          subtitle: "Executive PDF intelligence from CI execution data",
        }}
      >
        <Suspense fallback={<PageFallback label="Execution Report" />}>
          <ExecutionReport />
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
