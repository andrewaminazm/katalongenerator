/**
 * Video tutorial catalog for Utilities → Video Tutorials (/video-tutorials).
 *
 * Hosted videos live in `client/public/tutorials/{id}.webm`.
 * Regenerate (real UI screen capture): `npm run tutorials:videos --prefix server`
 * Duration labels sync from `tutorialDurations.json` after each generate run.
 *
 * Optional: set `youtubeId` instead of / in addition to `videoUrl` for YouTube hosting.
 */

import { tutorialDurationLabel } from "./durationLabels";

export type VideoTutorialCategory =
  | "getting-started"
  | "script-generator"
  | "gosi-brain"
  | "intelligence"
  | "utilities";

export type VideoTutorial = {
  id: string;
  title: string;
  description: string;
  category: VideoTutorialCategory;
  /** YouTube video ID (not full URL). */
  youtubeId?: string;
  /** Hosted WebM/MP4 under /tutorials/ */
  videoUrl?: string;
  durationLabel?: string;
  docSectionId?: string;
  relatedHref?: string;
};

/** Public URL for a generated tutorial WebM. */
export function tutorialVideoUrl(id: string): string {
  return `/tutorials/${id}.webm`;
}

export const VIDEO_TUTORIAL_CATEGORIES: { id: VideoTutorialCategory; label: string }[] = [
  { id: "getting-started", label: "Getting started" },
  { id: "script-generator", label: "Script Generator" },
  { id: "gosi-brain", label: "Gosi Brain" },
  { id: "intelligence", label: "Intelligence" },
  { id: "utilities", label: "Utilities" },
];

const VIDEO_TUTORIAL_DEFINITIONS: Omit<VideoTutorial, "durationLabel">[] = [
  {
    id: "platform-overview",
    title: "Platform overview",
    description:
      "Tour the generator layout, API health, project upload, and where Script Generator, Gosi Brain, and Utilities live in the sidebar.",
    category: "getting-started",
    videoUrl: tutorialVideoUrl("platform-overview"),
    docSectionId: "getting-started",
    relatedHref: "/",
  },
  {
    id: "manual-generation",
    title: "Manual test generation (WebUI)",
    description:
      "Write plain-language steps, add locators or Page URL auto-detect, choose code output, and generate Katalon Groovy.",
    category: "script-generator",
    videoUrl: tutorialVideoUrl("manual-generation"),
    docSectionId: "manual-test-generation",
    relatedHref: "/?tab=manual",
  },
  {
    id: "api-automation",
    title: "API Test tab",
    description:
      "Import Swagger, Postman, or cURL and export Katalon API keywords, test scripts, and Postman collections.",
    category: "script-generator",
    videoUrl: tutorialVideoUrl("api-automation"),
    docSectionId: "api-automation",
    relatedHref: "/?tab=api",
  },
  {
    id: "performance-testing",
    title: "Performance Test tab",
    description:
      "Generate JMeter and k6 load scripts with smoke, stress, spike, and soak strategies from the same API definitions.",
    category: "script-generator",
    videoUrl: tutorialVideoUrl("performance-testing"),
    docSectionId: "performance-testing",
    relatedHref: "/?tab=performance",
  },
  {
    id: "failure-analyzer",
    title: "Gosi Brain Failure Analyzer",
    description:
      "Paste Katalon execution logs to infer root cause, flakiness signals, and fix recommendations without screenshots.",
    category: "script-generator",
    videoUrl: tutorialVideoUrl("failure-analyzer"),
    relatedHref: "/?tab=failure",
  },
  {
    id: "ai-workspace",
    title: "Test Architect Chat",
    description:
      "Chat-first QA: intent routing, project context, Swagger/Postman attachments, and multi-agent responses.",
    category: "gosi-brain",
    videoUrl: tutorialVideoUrl("ai-workspace"),
    docSectionId: "ai-qa-workspace",
    relatedHref: "/ai-workspace",
  },
  {
    id: "coverage-analyzer",
    title: "AI Coverage Analyzer",
    description:
      "SonarQube-style coverage gaps, module heatmaps, API spec coverage, and Gosi Brain recommendations.",
    category: "gosi-brain",
    videoUrl: tutorialVideoUrl("coverage-analyzer"),
    docSectionId: "ai-coverage-analyzer",
    relatedHref: "/coverage",
  },
  {
    id: "refactoring-assistant",
    title: "AI Refactoring Assistant",
    description:
      "Maintainability scores, duplicate flows, OR/keyword health, and prioritized refactoring guidance.",
    category: "gosi-brain",
    videoUrl: tutorialVideoUrl("refactoring-assistant"),
    docSectionId: "ai-refactoring-assistant",
    relatedHref: "/refactor",
  },
  {
    id: "execution-report",
    title: "AI Execution Report Generator",
    description:
      "Turn CI pass/fail totals into release readiness, module risk, charts, and an executive PDF.",
    category: "gosi-brain",
    videoUrl: tutorialVideoUrl("execution-report"),
    docSectionId: "ai-execution-report",
    relatedHref: "/execution-report",
  },
  {
    id: "project-generator",
    title: "AI Katalon Project Generator",
    description:
      "Scaffold enterprise project structure, OR, keywords, suites, and framework health in a downloadable zip.",
    category: "gosi-brain",
    videoUrl: tutorialVideoUrl("project-generator"),
    docSectionId: "ai-project-generator",
    relatedHref: "/project-generator",
  },
  {
    id: "project-repair",
    title: "AI Project Repair Engine",
    description:
      "Analyze flaky scripts, preview safe repairs, and download a repaired project archive.",
    category: "gosi-brain",
    videoUrl: tutorialVideoUrl("project-repair"),
    docSectionId: "ai-project-repair-engine",
    relatedHref: "/project-repair",
  },
  {
    id: "project-intelligence",
    title: "Project Intelligence",
    description:
      "Upload a Katalon archive, index OR and keywords, run Project Analyze, heal locators, and enable AI memory.",
    category: "intelligence",
    videoUrl: tutorialVideoUrl("project-intelligence"),
    docSectionId: "project-intelligence",
    relatedHref: "/#project-intelligence",
  },
  {
    id: "workspace-memory",
    title: "Test Architect Chat Memory",
    description:
      "Index flows, repairs, and architecture into persistent memory injected into workspace chat.",
    category: "intelligence",
    videoUrl: tutorialVideoUrl("workspace-memory"),
    docSectionId: "ai-workspace-memory",
    relatedHref: "/ai-workspace",
  },
  {
    id: "documentation-center",
    title: "Documentation center",
    description:
      "Search guides, step workflows, tips, and troubleshooting — including links from each product area.",
    category: "utilities",
    videoUrl: tutorialVideoUrl("documentation-center"),
    docSectionId: "video-tutorials",
    relatedHref: "/how-to-use",
  },
];

export const VIDEO_TUTORIALS: VideoTutorial[] = VIDEO_TUTORIAL_DEFINITIONS.map((t) => ({
  ...t,
  durationLabel: tutorialDurationLabel(t.id),
}));

export function getVideoTutorialById(id: string): VideoTutorial | undefined {
  return VIDEO_TUTORIALS.find((v) => v.id === id);
}

export function hasPlayableVideo(video: VideoTutorial): boolean {
  return Boolean(video.youtubeId?.trim() || video.videoUrl?.trim());
}
