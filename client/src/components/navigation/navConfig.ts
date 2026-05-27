import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Brain,
  FileCode2,
  Gauge,
  History,
  Layers,
  MessageSquare,
  Microscope,
  Package,
  Wrench,
  Zap,
  Hammer,
} from "lucide-react";

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  generatorTab?: string;
  icon: LucideIcon;
  badge?: string;
  external?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "script-generator",
    label: "Script Generator",
    items: [
      { id: "manual", label: "Functional Test", generatorTab: "manual", icon: FileCode2 },
      { id: "api", label: "API Test", generatorTab: "api", icon: Zap },
      { id: "performance", label: "Performance Test", generatorTab: "performance", icon: Gauge },
      { id: "failure", label: "Failure Analyzer", generatorTab: "failure", icon: Microscope },
    ],
  },
  {
    id: "ai",
    label: "Gosi Brain",
    items: [
      { id: "workspace", label: "QA Workspace", href: "/ai-workspace", icon: MessageSquare, badge: "AI" },
      { id: "coverage", label: "Coverage Analyzer", href: "/coverage", icon: Layers, badge: "AI" },
      { id: "refactor", label: "Refactoring Assistant", href: "/refactor", icon: Wrench, badge: "AI" },
      { id: "project-generator", label: "AI Project Generator", href: "/project-generator", icon: Package, badge: "AI" },
      { id: "project-repair", label: "AI Project Repair", href: "/project-repair", icon: Hammer, badge: "AI" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { id: "project", label: "Project Intelligence", href: "/#project-intelligence", icon: Brain },
      { id: "memory", label: "Gosi Brain Memory", href: "/#ai-memory", icon: Bot },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    items: [
      { id: "docs", label: "Documentation", href: "/how-to-use", icon: BookOpen },
      { id: "history", label: "Generation History", href: "/#history", icon: History },
    ],
  },
];

export type CommandAction = {
  id: string;
  label: string;
  keywords: string[];
  href?: string;
  generatorTab?: string;
};

export const COMMAND_ACTIONS: CommandAction[] = [
  { id: "gen-login", label: "Generate login test (Functional)", keywords: ["generate", "login", "test", "functional"], generatorTab: "manual" },
  { id: "open-workspace", label: "Open Gosi Brain Workspace", keywords: ["chat", "workspace", "ai"], href: "/ai-workspace" },
  { id: "open-coverage", label: "Analyze API coverage", keywords: ["coverage", "gaps", "sonar"], href: "/coverage" },
  { id: "open-refactor", label: "Open Refactoring Assistant", keywords: ["refactor", "duplication", "maintainability"], href: "/refactor" },
  { id: "open-project-generator", label: "Open AI Project Generator", keywords: ["project", "generator", "framework", "scaffold", "architecture"], href: "/project-generator" },
  { id: "open-project-repair", label: "Open AI Project Repair Engine", keywords: ["repair", "fix", "heal", "flaky", "framework recovery"], href: "/project-repair" },
  { id: "open-project", label: "Open Project Intelligence", keywords: ["project", "upload", "or", "keywords"], href: "/#project-intelligence" },
  { id: "api-suite", label: "Create API regression suite", keywords: ["api", "postman", "swagger"], generatorTab: "api" },
  { id: "perf-smoke", label: "Create performance smoke suite", keywords: ["k6", "jmeter", "load", "performance"], generatorTab: "performance" },
  { id: "docs", label: "Open Documentation", keywords: ["help", "guide", "how to"], href: "/how-to-use" },
];
