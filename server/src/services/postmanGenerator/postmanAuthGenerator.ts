import type { AuthType } from "../apiCodeGenerator/types.js";

export function collectionAuth(auth: AuthType): Record<string, unknown> | undefined {
  if (auth === "bearer" || auth === "jwt") {
    return {
      type: "bearer",
      bearer: [{ key: "token", value: "{{token}}", type: "string" }],
    };
  }
  if (auth === "basic") {
    return {
      type: "basic",
      basic: [
        { key: "username", value: "{{username}}", type: "string" },
        { key: "password", value: "{{password}}", type: "string" },
      ],
    };
  }
  if (auth === "apiKey") {
    return {
      type: "apikey",
      apikey: [
        { key: "key", value: "X-API-Key", type: "string" },
        { key: "value", value: "{{apiKey}}", type: "string" },
        { key: "in", value: "header", type: "string" },
      ],
    };
  }
  return undefined;
}

export function requestAuthOverride(auth: AuthType, useAuth: boolean): Record<string, unknown> | undefined {
  if (!useAuth) return { type: "noauth" };
  return collectionAuth(auth);
}

export function bearerHeaderPrerequest(): string[] {
  return [
    "if (pm.environment.get('token')) {",
    "    pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + pm.environment.get('token') });",
    "}",
  ];
}
