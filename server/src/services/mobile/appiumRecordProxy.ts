import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface RawWebDriverCommand {
  ts: number;
  method: string;
  path: string;
  bodyText?: string;
  bodyJson?: any;
  status?: number;
  responseText?: string;
  responseJson?: any;
}

export interface AppiumProxyRecording {
  id: string;
  proxyUrl: string;
  targetAppiumUrl: string;
  commands: RawWebDriverCommand[];
  startedAt: number;
  server: http.Server;
}

function safeJsonParse(s: string): any | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripHopByHopHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!v) continue;
    const key = k.toLowerCase();
    if (
      key === "host" ||
      key === "connection" ||
      key === "keep-alive" ||
      key === "transfer-encoding" ||
      key === "upgrade" ||
      key === "proxy-authorization" ||
      key === "proxy-authenticate" ||
      key === "te" ||
      key === "trailers"
    ) {
      continue;
    }
    out[key] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

export async function startAppiumRecordProxy(params: {
  targetAppiumUrl: string;
}): Promise<AppiumProxyRecording> {
  const target = new URL(params.targetAppiumUrl.trim().replace(/\/+$/, "") + "/");
  const commands: RawWebDriverCommand[] = [];
  const id = randomId();
  const startedAt = Date.now();

  const server = http.createServer((req, res) => {
    (async () => {
      const method = (req.method || "GET").toUpperCase();
      const path = req.url || "/";

      const chunks: Buffer[] = [];
      for await (const ch of req) {
        chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
      }
      const bodyBuf = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
      const bodyText = bodyBuf.length ? bodyBuf.toString("utf8") : undefined;
      const bodyJson = bodyText ? safeJsonParse(bodyText) : undefined;

      const cmd: RawWebDriverCommand = {
        ts: Date.now(),
        method,
        path,
        ...(bodyText ? { bodyText } : {}),
        ...(bodyJson !== undefined ? { bodyJson } : {}),
      };
      commands.push(cmd);

      const targetUrl = new URL(path.replace(/^\//, ""), target);
      const headers = stripHopByHopHeaders(req.headers as Record<string, string | string[] | undefined>);
      const isHttps = targetUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const proxyReq = client.request(
        {
          method,
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port ? Number(targetUrl.port) : isHttps ? 443 : 80,
          path: targetUrl.pathname + targetUrl.search,
          headers: {
            ...headers,
            ...(bodyBuf.length ? { "content-length": String(bodyBuf.length) } : {}),
          },
        },
        (proxyRes) => {
          const respChunks: Buffer[] = [];
          proxyRes.on("data", (d) => respChunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
          proxyRes.on("end", () => {
            const respBuf = respChunks.length ? Buffer.concat(respChunks) : Buffer.alloc(0);
            const respText = respBuf.length ? respBuf.toString("utf8") : "";
            const respJson = respText ? safeJsonParse(respText) : undefined;

            cmd.status = proxyRes.statusCode ?? 0;
            cmd.responseText = respText;
            if (respJson !== undefined) cmd.responseJson = respJson;

            // Copy response headers (avoid hop-by-hop)
            for (const [k, v] of Object.entries(proxyRes.headers)) {
              const key = k.toLowerCase();
              if (key === "connection" || key === "transfer-encoding") continue;
              if (typeof v === "string") res.setHeader(k, v);
              else if (Array.isArray(v)) res.setHeader(k, v);
            }
            res.statusCode = proxyRes.statusCode ?? 502;
            res.end(respBuf);
          });
        }
      );

      proxyReq.on("error", (err) => {
        cmd.status = 502;
        cmd.responseText = String(err?.message ?? err);
        res.statusCode = 502;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Proxy error", message: String(err?.message ?? err) }));
      });

      if (bodyBuf.length) proxyReq.write(bodyBuf);
      proxyReq.end();
    })().catch((err) => {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Proxy internal error", message: String(err?.message ?? err) }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("Could not bind proxy server");
  }
  const proxyUrl = `http://127.0.0.1:${addr.port}`;

  return { id, proxyUrl, targetAppiumUrl: target.toString().replace(/\/$/, ""), commands, startedAt, server };
}

export async function stopAppiumRecordProxy(rec: AppiumProxyRecording): Promise<void> {
  await new Promise<void>((resolve) => rec.server.close(() => resolve()));
}

// --- Conversion ---

function unwrapElementId(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      value["element-6066-11e4-a52e-4f735466cecf"] ||
      value.ELEMENT ||
      value["elementId"] ||
      value.id
    );
  }
  return undefined;
}

function selectorFromFind(bodyJson: any): { using?: string; value?: string } {
  if (!bodyJson || typeof bodyJson !== "object") return {};
  const using = typeof bodyJson.using === "string" ? bodyJson.using : undefined;
  const value = typeof bodyJson.value === "string" ? bodyJson.value : undefined;
  return { using, value };
}

function toLocatorLine(using: string | undefined, value: string | undefined): string | null {
  if (!using || !value) return null;
  const u = using.toLowerCase();
  if (u === "id") return `resource-id=${value}`;
  if (u === "accessibility id") return `accessibility id = ${value}`;
  if (u === "xpath") return `xpath=${value}`;
  if (u === "name") return `name=${value}`;
  // Fallback: keep as xpath-like (least-worst)
  return `xpath=${value}`;
}

function labelFromSelector(using: string | undefined, value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "Element";
  if (using?.toLowerCase() === "id" && v.includes(":id/")) return v.split(":id/").pop() || v;
  if (v.length > 48) return v.slice(0, 48);
  return v;
}

export function convertCommandsToMobileArtifacts(cmds: RawWebDriverCommand[]): {
  steps: string[];
  locatorsText: string;
} {
  const elementIdToLocator = new Map<string, { using?: string; value?: string }>();
  const locLineByLabel = new Map<string, string>();
  const steps: string[] = [];

  for (const c of cmds) {
    const path = c.path || "";
    const method = c.method.toUpperCase();

    // Find element
    if (method === "POST" && /\/session\/[^/]+\/element$/.test(path)) {
      const sel = selectorFromFind(c.bodyJson);
      const respVal = c.responseJson?.value;
      const elId = unwrapElementId(respVal);
      if (elId) {
        elementIdToLocator.set(elId, sel);
        const line = toLocatorLine(sel.using, sel.value);
        if (line) {
          const label = labelFromSelector(sel.using, sel.value);
          if (!locLineByLabel.has(label)) locLineByLabel.set(label, line);
        }
      }
      continue;
    }

    // Click
    const clickMatch = path.match(/\/session\/[^/]+\/element\/([^/]+)\/click$/);
    if (method === "POST" && clickMatch) {
      const elId = decodeURIComponent(clickMatch[1]);
      const sel = elementIdToLocator.get(elId);
      const label = labelFromSelector(sel?.using, sel?.value);
      steps.push(`tap ${label}`);
      continue;
    }

    // Send keys (W3C): /value with { text, value[] }
    const valueMatch = path.match(/\/session\/[^/]+\/element\/([^/]+)\/value$/);
    if (method === "POST" && valueMatch) {
      const elId = decodeURIComponent(valueMatch[1]);
      const sel = elementIdToLocator.get(elId);
      const label = labelFromSelector(sel?.using, sel?.value);
      const txt =
        typeof c.bodyJson?.text === "string"
          ? c.bodyJson.text
          : Array.isArray(c.bodyJson?.value)
            ? c.bodyJson.value.join("")
            : "";
      if (txt.trim()) {
        steps.push(`type ${label} "${txt.replace(/"/g, '\\"')}"`);
      } else {
        steps.push(`type ${label} ""`);
      }
      continue;
    }
  }

  const locatorsText = [...locLineByLabel.entries()]
    .map(([label, rhs]) => `${label} = ${rhs}`)
    .join("\n");

  return { steps, locatorsText };
}

