import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";
import { requestAuthOverride } from "./postmanAuthGenerator.js";
import { testEvent } from "./postmanTestScriptGenerator.js";
import type { AuthType } from "../apiCodeGenerator/types.js";
import type { ApiTestScenario } from "../apiArchitect/types.js";
import { metadataForScenario } from "../apiArchitect/scenarioGenerator.js";

function buildUrl(path: string): string {
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const u = new URL(path);
      return `{{baseUrl}}${u.pathname}${u.search}`;
    }
  } catch {
    /* use path as-is */
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `{{baseUrl}}${normalized}`;
}

function buildHeaders(ep: EnrichedApiEndpoint, missingContentType?: boolean): Record<string, unknown>[] {
  const headers: Record<string, unknown>[] = [];
  if (!missingContentType) {
    headers.push({ key: "Content-Type", value: "application/json", type: "text" });
  }
  headers.push({ key: "X-Request-Id", value: "{{requestId}}", type: "text" });
  headers.push({ key: "X-Correlation-Id", value: "{{correlationId}}", type: "text" });

  if (ep.headers) {
    for (const [k, v] of Object.entries(ep.headers)) {
      if (k.toLowerCase() !== "content-type" && !/^authorization$/i.test(k)) {
        headers.push({ key: k, value: v, type: "text" });
      }
    }
  }
  return headers;
}

function buildBody(
  ep: EnrichedApiEndpoint,
  bodyOverride?: Record<string, unknown>,
  rawBody?: string
): Record<string, unknown> | undefined {
  if (rawBody !== undefined) {
    return {
      mode: "raw",
      raw: rawBody,
      options: { raw: { language: "json" } },
    };
  }
  const payload = bodyOverride ?? ep.requestBodyExample;
  if (!payload || !Object.keys(payload).length) return undefined;
  if (ep.method === "GET" || ep.method === "HEAD") return undefined;
  return {
    mode: "raw",
    raw: JSON.stringify(payload, null, 2),
    options: { raw: { language: "json" } },
  };
}

export interface PostmanRequestItemOptions {
  name: string;
  ep: EnrichedApiEndpoint;
  bodyOverride?: Record<string, unknown>;
  rawBody?: string;
  pathOverride?: string;
  expectedStatuses?: number[];
  testScripts?: string[];
  prerequestScripts?: string[];
  globalAuth: AuthType;
  saveToken?: boolean;
  skipAuth?: boolean;
  useInvalidToken?: boolean;
  aiMetadata?: ApiTestScenario;
}

export function buildRequestItem(opts: PostmanRequestItemOptions): Record<string, unknown> {
  const events: Record<string, unknown>[] = [];
  const path = opts.pathOverride ?? opts.ep.pathTemplate ?? opts.ep.path;

  if (opts.testScripts?.length) {
    events.push(testEvent(opts.testScripts, "test"));
  }

  if (opts.prerequestScripts?.length) {
    events.push(testEvent(opts.prerequestScripts, "prerequest"));
  }

  const request: Record<string, unknown> = {
    method: opts.ep.method,
    header: buildHeaders(opts.ep, opts.aiMetadata?.missingContentType),
    url: buildUrl(path),
  };

  const body = buildBody(opts.ep, opts.bodyOverride, opts.rawBody);
  if (body) request.body = body;

  const useAuth = !opts.skipAuth && opts.globalAuth !== "none" && !opts.useInvalidToken;
  if (useAuth) {
    request.auth = requestAuthOverride(opts.globalAuth, true);
  } else if (opts.skipAuth || opts.useInvalidToken) {
    request.auth = requestAuthOverride(opts.globalAuth, false);
  }

  const meta = opts.aiMetadata ? metadataForScenario(opts.aiMetadata) : null;
  const description = [
    opts.ep.summary ?? "",
    meta ? `aiMetadata: ${JSON.stringify(meta)}` : "",
    `Module: ${opts.ep.semanticModule}`,
    `Path: ${opts.ep.method} ${path}`,
  ]
    .filter(Boolean)
    .join("\n");

  const item: Record<string, unknown> = {
    name: opts.name,
    request,
    description,
  };
  if (events.length) item.event = events;
  return item;
}
