import express from "express";
import { generatePerformanceSuite } from "../services/performanceEngine/index.js";
import type { PerformanceGenerateRequest } from "../services/performanceEngine/types.js";

function bodyToRequest(body: Record<string, unknown>): PerformanceGenerateRequest {
  const rawConfig = body.config as Record<string, unknown> | undefined;
  const config = rawConfig
    ? {
        vus: typeof rawConfig.vus === "number" ? rawConfig.vus : 10,
        duration: typeof rawConfig.duration === "string" ? rawConfig.duration : "5m",
        rampUp: typeof rawConfig.rampUp === "string" ? rawConfig.rampUp : "30s",
        ...(typeof rawConfig.environment === "string"
          ? {
              environment: rawConfig.environment as NonNullable<
                PerformanceGenerateRequest["config"]
              >["environment"],
            }
          : {}),
        ...(typeof rawConfig.baseUrl === "string" ? { baseUrl: rawConfig.baseUrl } : {}),
      }
    : undefined;
  return {
    inputType: body.inputType as PerformanceGenerateRequest["inputType"],
    input: body.input as Record<string, unknown> | undefined,
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
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    useProjectApis: body.useProjectApis === true,
    mode: body.mode as PerformanceGenerateRequest["mode"],
    config,
    output: Array.isArray(body.output)
      ? (body.output as PerformanceGenerateRequest["output"])
      : undefined,
  };
}

export function createPerformanceRouter(): express.Router {
  const router = express.Router();

  router.post("/generate", async (req, res) => {
    try {
      const result = await generatePerformanceSuite(bodyToRequest(req.body as Record<string, unknown>));
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
