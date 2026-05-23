import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findTestObjectExactMatch,
  isWeakPrefixOrMatch,
  matchTestObjectByLocatorHint,
} from "./semanticMatcher.js";
import { buildGenerationPlan, bindingsByStepIndex } from "./generationPlanner.js";
import { extractLocatorHintFromStep } from "./stepReferenceExtractor.js";
import type { ParsedTestObject, ProjectIndex } from "./types.js";

function or(label: string, path: string): ParsedTestObject {
  return {
    label,
    path,
    selectorType: "XPATH",
    selector: `//dummy[@name='${label}']`,
    alternativeSelectors: [],
    sourceFile: `Object Repository/${path}.rs`,
  };
}

const objects: ParsedTestObject[] = [
  or("button_", "arabichomepage/Page_/button_"),
  or("button_Show more-board", "arabichomepage/Page_/button_Show more-board"),
  or("btn_Login", "Page_Login/btn_Login"),
];

describe("findTestObjectExactMatch", () => {
  it("prefers exact label over shorter prefix label", () => {
    const hit = findTestObjectExactMatch("button_Show more-board", objects);
    assert.equal(hit?.path, "arabichomepage/Page_/button_Show more-board");
    assert.equal(hit?.label, "button_Show more-board");
  });

  it("matches path leaf when label differs", () => {
    const objs = [
      or("short", "Page/foo/bar_Show more-board"),
      or("button_", "arabichomepage/Page_/button_"),
    ];
    const hit = findTestObjectExactMatch("bar_Show more-board", objs);
    assert.equal(hit?.path, "Page/foo/bar_Show more-board");
  });
});

describe("matchTestObjectByLocatorHint", () => {
  it("returns exact match with score 1", () => {
    const hits = matchTestObjectByLocatorHint("button_Show more-board", objects, 0.35);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].score, 1);
    assert.equal(hits[0].item.path, "arabichomepage/Page_/button_Show more-board");
  });

  it("does not rank weak prefix button_ above full name", () => {
    const hits = matchTestObjectByLocatorHint("button_Show more-board", objects, 0.1);
    assert.equal(hits[0].item.label, "button_Show more-board");
    const weak = hits.find((h) => h.item.label === "button_");
    assert.ok(!weak || weak.score < hits[0].score);
  });
});

describe("isWeakPrefixOrMatch", () => {
  it("flags button_ as weak prefix of button_Show more-board", () => {
    assert.equal(
      isWeakPrefixOrMatch("button_Show more-board", objects[0]),
      true
    );
    assert.equal(
      isWeakPrefixOrMatch("button_Show more-board", objects[1]),
      false
    );
  });
});

describe("buildGenerationPlan locator binding", () => {
  it("binds click step to exact OR name from project index", () => {
    const step = "click on button_Show more-board";
    const hint = extractLocatorHintFromStep(step, "web");
    assert.equal(hint, "button_Show more-board");

    const index: ProjectIndex = {
      projectId: "test",
      projectName: "test",
      testObjects: objects,
      keywords: [],
      testScripts: [],
      testCases: [],
      stats: { testObjects: objects.length, keywords: 0, testScripts: 0 },
    };
    const plan = buildGenerationPlan([step], index, "balanced", "web");
    const binding = bindingsByStepIndex(plan)[0];
    assert.equal(binding?.orPath, "arabichomepage/Page_/button_Show more-board");
    assert.equal(binding?.orLabel, "button_Show more-board");
  });
});
