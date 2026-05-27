import express from "express";
import {
  analyzeEndpointInput,
  generateApiCode,
  parseCurlCommand,
  parseOpenApiDocument,
  parsePostmanCollection,
  type ApiGeneratorOptions,
} from "../services/apiCodeGenerator/index.js";

function optionsFromBody(body: Record<string, unknown>): ApiGeneratorOptions {
  return {
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    testCaseName: typeof body.testCaseName === "string" ? body.testCaseName : undefined,
    includeNegative: body.includeNegative !== false,
    includeBoundary: body.includeBoundary !== false,
    includeHelpers: body.includeHelpers !== false,
    aiMemoryMode: typeof body.aiMemoryMode === "string" ? body.aiMemoryMode : undefined,
  };
}

export function createApiGeneratorRouter(): express.Router {
  const router = express.Router();

  router.post("/swagger", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const spec = typeof body.spec === "string" ? body.spec : typeof body.openapi === "string" ? body.openapi : "";
      if (!spec.trim()) {
        res.status(400).json({ error: "Provide Swagger or OpenAPI JSON or YAML in spec" });
        return;
      }
      const { endpoints, warnings } = parseOpenApiDocument(spec);
      const result = await generateApiCode(endpoints, optionsFromBody(body), warnings);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/postman", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const collection =
        typeof body.collection === "string"
          ? body.collection
          : typeof body.postman === "string"
            ? body.postman
            : "";
      if (!collection.trim()) {
        res.status(400).json({ error: "Provide Postman collection JSON in collection" });
        return;
      }
      const { endpoints, warnings } = parsePostmanCollection(collection);
      const result = await generateApiCode(endpoints, optionsFromBody(body), warnings);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/endpoint", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const endpoint = analyzeEndpointInput({
        method: typeof body.method === "string" ? body.method : undefined,
        path: typeof body.path === "string" ? body.path : undefined,
        url: typeof body.url === "string" ? body.url : undefined,
        requestJson: typeof body.requestJson === "string" ? body.requestJson : undefined,
        responseJson: typeof body.responseJson === "string" ? body.responseJson : undefined,
        name: typeof body.name === "string" ? body.name : undefined,
      });
      const result = await generateApiCode([endpoint], optionsFromBody(body));
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/curl", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const curl = typeof body.curl === "string" ? body.curl : "";
      if (!curl.trim()) {
        res.status(400).json({ error: "Provide cURL command in curl" });
        return;
      }
      const endpoint = parseCurlCommand(curl);
      const result = await generateApiCode([endpoint], optionsFromBody(body));
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
