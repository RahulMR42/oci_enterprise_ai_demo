import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("app version manifest matches package metadata", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const versionJson = JSON.parse(readFileSync("src/version.json", "utf8"));
  const indexHtml = readFileSync("index.html", "utf8");
  const adminHtml = readFileSync("admin.html", "utf8");

  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.equal(versionJson.version, packageJson.version);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.match(indexHtml, new RegExp(`src/main\\.js\\?v=${packageJson.version}`));
  assert.match(indexHtml, new RegExp(`src/styles\\.css\\?v=${packageJson.version}`));
  assert.match(adminHtml, new RegExp(`src/admin\\.js\\?v=${packageJson.version}`));
  assert.match(adminHtml, new RegExp(`src/styles\\.css\\?v=${packageJson.version}`));
});
