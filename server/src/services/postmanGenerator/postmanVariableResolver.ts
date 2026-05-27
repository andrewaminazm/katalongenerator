import type { AuthType } from "../apiCodeGenerator/types.js";

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

export function collectionVariables(baseUrl: string, auth: AuthType): PostmanVariable[] {
  const vars: PostmanVariable[] = [
    { key: "baseUrl", value: baseUrl.startsWith("{{") ? "" : baseUrl },
    { key: "environmentName", value: "local" },
    { key: "requestId", value: "" },
    { key: "correlationId", value: "" },
  ];
  if (auth === "bearer" || auth === "jwt") {
    vars.push({ key: "token", value: "" }, { key: "authToken", value: "" });
  }
  if (auth === "basic") {
    vars.push({ key: "username", value: "" }, { key: "password", value: "" });
  }
  if (auth === "apiKey") {
    vars.push({ key: "apiKey", value: "" });
  }
  return vars;
}

export function buildEnvironments(
  baseUrl: string,
  auth: AuthType
): { id: string; name: string; values: { key: string; value: string; enabled: boolean }[] }[] {
  const templates: { name: string; url: string }[] =
    baseUrl && !baseUrl.startsWith("{{")
      ? [
          { name: "Local", url: baseUrl },
          { name: "Development", url: baseUrl },
        ]
      : [
          { name: "Local", url: "http://localhost:8080" },
          { name: "Development", url: "https://api-dev.example.com" },
          { name: "QA", url: "https://api-qa.example.com" },
          { name: "Staging", url: "https://api-staging.example.com" },
          { name: "Production", url: "https://api.example.com" },
        ];

  return templates.map((t) => ({
    id: t.name.toLowerCase().replace(/\s+/g, "-"),
    name: t.name,
    values: collectionVariables(t.url, auth).map((v) => ({
      key: v.key,
      value: v.value,
      enabled: true,
    })),
  }));
}
