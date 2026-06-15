import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("Usage: npm run version:set -- <major.minor.patch>");
  process.exit(1);
}

const files = [
  {
    path: "src/version.json",
    update(data) {
      data.version = version;
      return data;
    },
  },
  {
    path: "package.json",
    update(data) {
      data.version = version;
      return data;
    },
  },
  {
    path: "package-lock.json",
    update(data) {
      data.version = version;
      if (data.packages?.[""]) {
        data.packages[""].version = version;
      }
      return data;
    },
  },
];

for (const file of files) {
  const data = JSON.parse(readFileSync(file.path, "utf8"));
  writeFileSync(file.path, `${JSON.stringify(file.update(data), null, 2)}\n`);
}

for (const path of ["index.html", "admin.html"]) {
  const html = readFileSync(path, "utf8").replace(/\?v=\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/g, `?v=${version}`);
  writeFileSync(path, html);
}

console.log(`Set app version to ${version}`);
