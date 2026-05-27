import express from "express";
import { generatePostmanCollection } from "../services/postmanGenerator/index.js";
import type { PostmanGenerateRequest } from "../services/postmanGenerator/types.js";

function bodyToRequest(body: Record<string, unknown>): PostmanGenerateRequest {
  return {
    inputType: body.inputType as PostmanGenerateRequest["inputType"],
    swagger: typeof body.swagger === "string" ? body.swagger : undefined,
    spec: typeof body.spec === "string" ? body.spec : undefined,
    collection: typeof body.collection === "string" ? body.collection : undefined,
    curl: typeof body.curl === "string" ? body.curl : undefined,
    method: typeof body.method === "string" ? body.method : undefined,
    path: typeof body.path === "string" ? body.path : undefined,
    url: typeof body.url === "string" ? body.url : undefined,
    requestJson: typeof body.requestJson === "string" ? body.requestJson : undefined,
    responseJson: typeof body.responseJson === "string" ? body.responseJson : undefined,
    testCaseName: typeof body.testCaseName === "string" ? body.testCaseName : undefined,
    baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    aiMemoryEnabled: body.aiMemoryEnabled === true,
    aiMemoryMode: typeof body.aiMemoryMode === "string" ? body.aiMemoryMode : undefined,
    includeNegative: body.includeNegative !== false,
    includeBoundary: body.includeBoundary !== false,
    generatedApiFlow: body.generatedApiFlow !== false,
    endpoints: Array.isArray(body.endpoints) ? (body.endpoints as PostmanGenerateRequest["endpoints"]) : undefined,
  };
}

export function createPostmanRouter(): express.Router {
  const router = express.Router();

  router.post("/generate", async (req, res) => {
    try {
      const result = await generatePostmanCollection(bodyToRequest(req.body as Record<string, unknown>));
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
