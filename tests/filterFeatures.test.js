import assert from "node:assert/strict";
import test from "node:test";

import { aiFeatures } from "../src/data/aiFeatures.js";
import { filterFeatures } from "../src/lib/filterFeatures.js";

test("filters cards by title, category, and capability text", () => {
  assert.deepEqual(
    filterFeatures(aiFeatures, "guardrails").map((feature) => feature.id),
    ["guardrails", "governance-center"]
  );

  assert.deepEqual(
    filterFeatures(aiFeatures, "PII").map((feature) => feature.id),
    ["guardrails"]
  );

  assert.deepEqual(
    filterFeatures(aiFeatures, "streaming").map((feature) => feature.id),
    ["responses-api", "locus-sdk-agentic-workflows"]
  );

  assert.equal(filterFeatures(aiFeatures, "   ").length, aiFeatures.length);
});
