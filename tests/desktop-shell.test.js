"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");

test("tauri shell packages only copied full-ui assets", () => {
  const configPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(config.build.frontendDist, "../desktop-dist");
  assert.equal(config.app.windows.length, 1);
  assert.equal(config.app.windows[0].label, "main");
  assert.equal(Object.hasOwn(config.app.windows[0], "icon"), false);
  assert.deepEqual(config.bundle.icon, [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.png"
  ]);
  assert.deepEqual(config.bundle.resources, {
    "../src": "src"
  });
  for (const iconPath of config.bundle.icon) {
    assert.equal(fs.existsSync(path.join(projectRoot, "src-tauri", iconPath)), true);
  }
  assert.equal(fs.existsSync(path.join(projectRoot, "src", "desktop-bridge-worker.js")), true);
  assert.match(config.app.security.csp, /script-src 'self'/);
  assert.doesNotMatch(config.app.security.csp, /unsafe-eval/);

  const capabilityPath = path.join(projectRoot, "src-tauri", "capabilities", "default.json");
  const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.permissions, ["core:default"]);
});

test("desktop asset copy keeps the current html ui entry and src assets", () => {
  const outputDir = path.join(projectRoot, "desktop-dist");
  fs.rmSync(outputDir, { recursive: true, force: true });

  const scriptPath = path.join(projectRoot, "scripts", "copy-desktop-assets.js");
  delete require.cache[require.resolve(scriptPath)];
  require(scriptPath);

  assert.equal(fs.existsSync(path.join(outputDir, "index.html")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "src", "main.js")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "src", "styles.css")), true);
  assert.equal(fs.existsSync(path.join(outputDir, "docs")), false);
  assert.equal(fs.existsSync(path.join(outputDir, "tests")), false);

  fs.rmSync(outputDir, { recursive: true, force: true });
});
