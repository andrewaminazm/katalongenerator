import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCurlCommand } from "./curlParser.js";
import { analyzeEndpointInput } from "./endpointAnalyzer.js";
import { parseOpenApiDocument } from "./swaggerParser.js";
import { generateApiCode } from "./apiCodeGenerator.js";

describe("apiCodeGenerator", () => {
  it("parses cURL with JSON body", () => {
    const ep = parseCurlCommand(
      `curl -X POST https://api.example.com/login -H "Content-Type: application/json" -d '{"username":"admin","password":"123456"}'`
    );
    assert.equal(ep.method, "POST");
    assert.equal(ep.path, "/login");
    assert.deepEqual(ep.requestBodyExample, { username: "admin", password: "123456" });
  });

  it("analyzes manual endpoint with response", () => {
    const ep = analyzeEndpointInput({
      method: "POST",
      path: "/login",
      requestJson: '{"username":"admin","password":"123456"}',
      responseJson: '{"token":"abc"}',
    });
    assert.equal(ep.method, "POST");
    assert.ok(ep.responseFields?.includes("token"));
  });

  it("parses minimal OpenAPI 3", () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: {
        "/users": {
          get: { operationId: "listUsers", responses: { "200": { description: "ok" } } },
        },
      },
    });
    const { endpoints } = parseOpenApiDocument(spec);
    assert.equal(endpoints.length, 1);
    assert.equal(endpoints[0].method, "GET");
  });

  it("generates Katalon WS groovy", async () => {
    const ep = analyzeEndpointInput({
      method: "POST",
      path: "/login",
      requestJson: '{"username":"admin","password":"123456"}',
      responseJson: '{"token":"abc"}',
      name: "Login",
    });
    const result = await generateApiCode([ep], { includeHelpers: true });
    assert.match(result.groovyCode, /ApiPayloadBuilder\.withBody/);
    assert.match(result.groovyCode, /ApiRequestBuilder\.prepare/);
    assert.match(result.groovyCode, /ResponseValidator\.assertStatus/);
    assert.ok(result.files.length >= 2);
    assert.ok(result.files.some((f) => f.path.includes("ApiPayloadBuilder")));
    assert.ok(result.files.some((f) => f.path.includes("Scripts/API/")));
    assert.ok(result.negativeTests.length > 0);
    const varNames = [...result.groovyCode.matchAll(/def (response[A-Za-z0-9_]+)/g)].map((m) => m[1]);
    const unique = new Set(varNames);
    assert.equal(varNames.length, unique.size, `duplicate response vars: ${varNames.filter((v, i) => varNames.indexOf(v) !== i)}`);
  });
});
