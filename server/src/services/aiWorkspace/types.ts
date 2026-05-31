import type { AiMemoryMode } from "../aiMemory/types.js";
import type { Platform } from "../../types/index.js";
import type { ProjectGenerationMode } from "../projectIntelligence/types.js";

export type WorkspaceIntent =
  | "generate"
  | "analyze"
  | "explain"
  | "optimize"
  | "document"
  | "review"
  | "heal"
  | "convert"
  | "performance"
  | "api"
  | "unknown";

export type WorkspaceAgent =
  | "script_generator"
  | "api_agent"
  | "performance_agent"
  | "project_intelligence"
  | "healing_agent"
  | "review_agent"
  | "documentation_agent"
  | "qa_advisor";

export interface WorkspaceContextPayload {
  activeTab?: string;
  platform?: Platform;
  projectId?: string;
  projectGenerationMode?: ProjectGenerationMode;
  aiMemoryMode?: AiMemoryMode;
  testCaseName?: string;
  pageUrl?: string;
  /** Optional OpenAPI/Swagger JSON or YAML pasted in workspace */
  swagger?: string;
  /** Optional Postman collection JSON */
  postmanCollection?: string;
  /** Recent steps/locators if synced from elsewhere (chat is the primary source) */
  steps?: string[];
  locators?: string;
  /** Enterprise workspace memory retrieval (default on when projectId set) */
  workspaceMemoryEnabled?: boolean;
}

export interface WorkspaceMemoryCitation {
  id: string;
  layer: string;
  title: string;
  score: number;
}

export interface WorkspaceChatRequest {
  sessionId?: string;
  message: string;
  context?: WorkspaceContextPayload;
  authorizationToken?: string;
  model?: string;
}

export interface WorkspaceAction {
  type: string;
  label: string;
  detail?: string;
}

export interface WorkspaceGeneratedAsset {
  kind: "groovy" | "api" | "performance" | "report" | "markdown";
  title: string;
  content: string;
  language?: string;
}

export interface WorkspaceChatResponse {
  sessionId: string;
  intent: WorkspaceIntent;
  agent: WorkspaceAgent;
  response: string;
  actions: WorkspaceAction[];
  generatedAssets: WorkspaceGeneratedAsset[];
  suggestions: string[];
  confidence: number;
  code?: string;
  model?: string;
  warnings?: string[];
  memoryCitations?: WorkspaceMemoryCitation[];
}

export interface WorkspaceSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  context: WorkspaceContextPayload;
  /** Rolling facts from long conversations — avoids re-asking established context. */
  conversationBrief?: {
    topics: string[];
    urls: string[];
    platforms: string[];
    userDecisions: string[];
  };
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    intent?: WorkspaceIntent;
    agent?: WorkspaceAgent;
  }>;
}
