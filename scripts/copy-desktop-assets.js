"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "desktop-dist");
const files = ["index.html"];
const directories = ["src"];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(outputDir, file));
}

for (const directory of directories) {
  fs.cpSync(path.join(projectRoot, directory), path.join(outputDir, directory), {
    recursive: true
  });
}

console.log(`Desktop assets copied to ${path.relative(projectRoot, outputDir)}`);
