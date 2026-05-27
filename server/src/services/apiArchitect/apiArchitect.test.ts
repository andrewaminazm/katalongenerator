import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifySemanticModule, businessActionLabel } from "./semanticClassifier.js";
import { enrichEndpoints } from "./enrichEndpoints.js";
import { generateNegativeScenarios, generateBoundaryScenarios } from "./scenarioGenerator.js";
import { analyzeEndpointInput } from "../apiCodeGenerator/endpointAnalyzer.js";

describe("apiArchitect", () => {
  it("classifies login as Authentication", () => {
    const mod = classifySemanticModule({
      id: "1",
      name: "login",
      method: "POST",
      path: "/auth/login",
    });
    assert.equal(mod, "Authentication");
  });

  it("classifies users resource", () => {
    const mod = classifySemanticModule({
      id: "2",
      name: "get_users",
      method: "GET",
      path: "/users",
    });
    assert.equal(mod, "Users");
  });

  it("enriches endpoint with path template and readable boundary sizes", () => {
    const ep = analyzeEndpointInput({
      method: "POST",
      path: "/users",
      requestJson: '{"email":"a@b.com","name":"Test"}',
      responseJson: '{"id":1,"email":"a@b.com"}',
    });
    const [enriched] = enrichEndpoints([ep]);
    assert.equal(enriched.semanticModule, "Users");
    assert.ok(enriched.businessAction.includes("Create"));
    assert.equal(enriched.pathTemplate, "/users");
    const boundary = generateBoundaryScenarios(enriched);
    const maxLen = boundary.find((s) => s.title.includes("max length"));
    assert.ok(maxLen);
    const body = maxLen!.bodyOverride!.email as string;
    assert.ok(body.length <= 1024);
  });

  it("negative scenarios use validation status range", () => {
    const ep = analyzeEndpointInput({
      method: "POST",
      path: "/orders",
      requestJson: '{"amount":10}',
    });
    const [enriched] = enrichEndpoints([ep]);
    const neg = generateNegativeScenarios(enriched);
    const missing = neg.find((s) => s.title.includes("Missing"));
    assert.ok(missing?.expectedStatuses.includes(400) || missing?.expectedStatuses.includes(422));
  });
});
