import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("app version manifest matches package metadata", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const versionJson = JSON.parse(readFileSync("src/version.json", "utf8"));

  assert.equal(packageJson.version, "0.0.19");
  assert.equal(versionJson.version, packageJson.version);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
});
