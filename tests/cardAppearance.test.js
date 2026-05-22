import assert from "node:assert/strict";
import test from "node:test";

import { cardColorTunes, defaultCardAppearance, getCardAppearanceVars } from "../src/lib/cardAppearance.js";

test("card appearance settings convert slider values to CSS variable ratios", () => {
  assert.equal(getCardAppearanceVars(defaultCardAppearance)["--card-reflection"], "0.46");
  assert.equal(getCardAppearanceVars(defaultCardAppearance)["--card-darkness"], "0.28");

  const clampedVars = getCardAppearanceVars({ reflection: 125, darkness: -10 });

  assert.equal(clampedVars["--card-reflection"], "1.00");
  assert.equal(clampedVars["--card-darkness"], "0.00");
});

test("card appearance exposes at least three selectable color tunes", () => {
  assert.equal(cardColorTunes.length >= 3, true);

  const brightVars = getCardAppearanceVars({ ...defaultCardAppearance, tune: "bright" });

  assert.equal(brightVars["--accent-blue-1"], "#1d4ed8");
  assert.equal(brightVars["--accent-red-3"], "#facc15");
});

test("unknown card color tunes fall back to the default tune", () => {
  const defaultVars = getCardAppearanceVars(defaultCardAppearance);
  const unknownVars = getCardAppearanceVars({ ...defaultCardAppearance, tune: "unknown" });

  assert.equal(unknownVars["--accent-teal-1"], defaultVars["--accent-teal-1"]);
});
