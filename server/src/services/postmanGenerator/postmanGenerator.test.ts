import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePostmanCollection } from "./index.js";

describe("postmanGenerator", () => {
  it("generates v2.1 collection from endpoint input", async () => {
    const result = await generatePostmanCollection({
      inputType: "endpoint",
      method: "POST",
      path: "/login",
      requestJson: '{"username":"admin","password":"test"}',
      responseJson: '{"token":"abc"}',
      testCaseName: "Auth API",
    });

    assert.equal(
      (result.collection.info as Record<string, unknown>).schema,
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    );
    assert.ok(result.environments.length >= 2);
    assert.ok(result.generatedTests.length > 0);
    assert.match(result.collectionJson, /pm.test/);
    assert.match(result.collectionJson, /{{baseUrl}}/);
    assert.match(result.collectionJson, /aiMetadata/);
    assert.match(result.collectionJson, /responseTime/);
  });
});
