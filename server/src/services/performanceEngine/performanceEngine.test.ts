import assert from "node:assert/strict";
import { test } from "node:test";
import { generatePerformanceSuite } from "./index.js";

const MINIMAL_OPENAPI = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Perf Demo", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/login": {
      post: {
        operationId: "login",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { username: { type: "string" }, password: { type: "string" } } },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
    },
    "/users": {
      get: { operationId: "listUsers", responses: { "200": { description: "OK" } } },
    },
    "/orders": {
      post: {
        operationId: "createOrder",
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": { description: "Created" } },
      },
    },
  },
});

test("generatePerformanceSuite returns jmeter, k6, and strategy", async () => {
  const result = await generatePerformanceSuite({
    inputType: "openapi",
    swagger: MINIMAL_OPENAPI,
    mode: "smoke",
    config: { vus: 5, duration: "2m", rampUp: "15s" },
  });

  assert.ok(result.jmeter.includes("jmeterTestPlan"));
  assert.ok(result.jmeter.includes("ThreadGroup"));
  assert.ok(result.jmeter.includes("HTTPSamplerProxy"));
  assert.ok(result.k6.includes("export const options"));
  assert.ok(result.k6.includes("group("));
  assert.ok(result.strategy.scenarios.length >= 1);
  assert.ok(result.strategy.loadModel.mode === "smoke");
  assert.ok(result.endpointCount >= 3);
  assert.equal(result.baseUrl, "https://api.example.com");
});

test("stress mode increases load model VUs", async () => {
  const baseline = await generatePerformanceSuite({
    inputType: "openapi",
    swagger: MINIMAL_OPENAPI,
    mode: "baseline",
    config: { vus: 10, duration: "5m", rampUp: "30s" },
  });
  const stress = await generatePerformanceSuite({
    inputType: "openapi",
    swagger: MINIMAL_OPENAPI,
    mode: "stress",
    config: { vus: 10, duration: "5m", rampUp: "30s" },
  });
  assert.ok(stress.strategy.loadModel.totalVus >= baseline.strategy.loadModel.totalVus);
});

test("endpoint-only input produces correlation hints for auth", async () => {
  const result = await generatePerformanceSuite({
    inputType: "endpoint",
    method: "POST",
    path: "/api/auth/login",
    requestJson: JSON.stringify({ email: "a@b.com", password: "secret" }),
    mode: "baseline",
    config: { vus: 3, duration: "1m", rampUp: "10s", baseUrl: "https://qa.example.com" },
  });
  assert.ok(result.jmeter.includes("JSONPostProcessor") || result.jmeter.includes("authToken"));
  assert.ok(result.strategy.dependencyRisks.length > 0 || result.warnings.length > 0);
});
