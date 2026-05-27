import type { ClassifiedEndpoint, LoadModel } from "./types.js";

function groupClassified(endpoints: ClassifiedEndpoint[]): Map<string, ClassifiedEndpoint[]> {
  const groups = new Map<string, ClassifiedEndpoint[]>();
  for (const ep of endpoints) {
    const mod = ep.semanticModule ?? "General";
    const list = groups.get(mod) ?? [];
    list.push(ep);
    groups.set(mod, list);
  }
  return groups;
}
import { authEndpointFirst, buildCorrelationExtractors } from "./correlationEngine.js";

function jsString(s: string): string {
  return JSON.stringify(s);
}

function resolveUrl(baseUrl: string, ep: ClassifiedEndpoint): string {
  const path = ep.pathTemplate ?? ep.path;
  if (path.startsWith("http")) return path;
  const origin = baseUrl.replace(/\/$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function bodyInitSnippet(ep: ClassifiedEndpoint): string {
  if (!ep.requestBodyExample || !Object.keys(ep.requestBodyExample).length) return "";
  const sample = JSON.stringify(ep.requestBodyExample);
  return `
    const payload = ${sample};
    for (const k of Object.keys(payload)) {
      if (typeof payload[k] === 'string' && /email|user/i.test(k)) payload[k] = \`user_\${__VU}_\${__ITER}@load.test\`;
      if (typeof payload[k] === 'string' && /name/i.test(k)) payload[k] = \`LoadUser_\${__VU}\`;
      if (typeof payload[k] === 'number' && /id/i.test(k)) payload[k] = Math.floor(Math.random() * 9000) + 1000;
    }`;
}

function buildRequestSnippet(ep: ClassifiedEndpoint, baseUrl: string, varName: string): string {
  const url = resolveUrl(baseUrl, ep);
  const hasBody = ep.method !== "GET" && ep.method !== "HEAD";
  const bodyInit = hasBody ? bodyInitSnippet(ep) : "";
  const method = ep.method.toLowerCase();

  const headers =
    ep.loadCategory === "auth"
      ? `{ headers: { 'Content-Type': 'application/json' } }`
      : `{ headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${authToken}\` } }`;

  const call = hasBody
    ? `const ${varName} = http.${method}(${jsString(url)}, JSON.stringify(payload), ${headers});`
    : `const ${varName} = http.${method}(${jsString(url)}, ${headers});`;

  const extract =
    ep.loadCategory === "auth"
      ? `
    try {
      const b = ${varName}.json();
      authToken = b.token || b.access_token || authToken;
    } catch (_) {}`
      : "";

  return `${bodyInit}
    ${call}
    check(${varName}, { 'status OK': (r) => r.status === ${ep.successStatus ?? 200} });${extract}`;
}

export function generateK6Script(
  suiteName: string,
  baseUrl: string,
  endpoints: ClassifiedEndpoint[],
  loadModel: LoadModel
): string {
  const ordered = authEndpointFirst(endpoints);
  const extractors = buildCorrelationExtractors(ordered);
  const groups = groupClassified(ordered);

  const stagesJson = JSON.stringify(loadModel.stages, null, 2);

  let groupBlocks = "";
  for (const [moduleName, eps] of groups) {
    const requests = eps
      .map((ep, i) =>
        buildRequestSnippet(ep, baseUrl, `res_${ep.id.replace(/[^a-zA-Z0-9]/g, "_")}_${i}`)
      )
      .join("\n");
    groupBlocks += `
  group(${jsString(moduleName)}, () => {${requests}
    sleep(Math.random() * 0.5 + 0.3);
  });`;
  }

  const authSetup = ordered
    .filter((e) => e.loadCategory === "auth")
    .map((ep, i) => {
      const url = resolveUrl(baseUrl, ep);
      const body = ep.requestBodyExample ? JSON.stringify(ep.requestBodyExample) : "{}";
      return `  const authRes${i} = http.post(${jsString(url)}, ${jsString(body)}, { headers: { 'Content-Type': 'application/json' } });
  try { const b = authRes${i}.json(); token = b.token || b.access_token || token; } catch (_) {}`;
    })
    .join("\n");

  const setupFn = authSetup
    ? `
export function setup() {
  let token = __ENV.TOKEN || '';
${authSetup}
  return { authToken: token };
}`
    : "";

  const extractorComment =
    extractors.length > 0
      ? `// Correlation: ${extractors.map((e) => e.targetVar).join(", ")}`
      : "";

  return `import http from 'k6/http';
import { check, group, sleep } from 'k6';

/** ${suiteName} — ${loadModel.mode} — ${baseUrl} */
${extractorComment}

export const options = {
  stages: ${stagesJson},
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};
${setupFn}

export default function () {
  let authToken = __ENV.TOKEN || '';
  if (typeof __ITER !== 'undefined' && __ENV.AUTH_FROM_SETUP === '1') {
    authToken = __ENV.authToken || authToken;
  }
${groupBlocks}
}
`;
}
