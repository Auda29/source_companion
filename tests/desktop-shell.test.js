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
  assert.equal(config.app.withGlobalTauri, true);
  assert.equal(config.app.windows.length, 1);
  assert.equal(config.app.windows[0].label, "main");
  assert.equal(Object.hasOwn(config.app.windows[0], "icon"), false);
  assert.deepEqual(config.bundle.icon, [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.png",
    "icons/icon.ico"
  ]);
  assert.deepEqual(config.bundle.resources, {
    "../src": "src"
  });
  assert.equal(Object.values(config.bundle.resources).includes("node"), false);
  for (const iconPath of config.bundle.icon) {
    assert.equal(fs.existsSync(path.join(projectRoot, "src-tauri", iconPath)), true);
  }
  const windowsIcon = readWindowsIcon(path.join(projectRoot, "src-tauri", "icons", "icon.ico"));
  assert.deepEqual(windowsIcon.sizes, ["32x32", "128x128", "256x256"]);
  assert.equal(fs.existsSync(path.join(projectRoot, "src", "desktop-bridge-worker.js")), true);
  assert.match(config.app.security.csp, /script-src 'self'/);
  assert.doesNotMatch(config.app.security.csp, /unsafe-eval/);

  const capabilityPath = path.join(projectRoot, "src-tauri", "capabilities", "default.json");
  const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.permissions, ["core:default"]);
});

function readWindowsIcon(iconPath) {
  const icon = fs.readFileSync(iconPath);
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  const count = icon.readUInt16LE(4);
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = icon.readUInt8(offset) || 256;
    const height = icon.readUInt8(offset + 1) || 256;
    const bytes = icon.readUInt32LE(offset + 8);
    const imageOffset = icon.readUInt32LE(offset + 12);
    assert.equal(icon.slice(imageOffset, imageOffset + 8).toString("hex"), "89504e470d0a1a0a");
    assert.ok(bytes > 0);
    sizes.push(`${width}x${height}`);
  }
  return { count, sizes };
}

test("desktop bridge docs do not claim a bundled node runtime", () => {
  const bridgeDoc = fs.readFileSync(path.join(projectRoot, "docs", "desktop-bridge.md"), "utf8");
  assert.doesNotMatch(bridgeDoc, /bundled Node runtime/i);
  assert.doesNotMatch(bridgeDoc, /missing bundled runtime/i);
  assert.match(bridgeDoc, /does not include a Node binary/);
  assert.match(bridgeDoc, /desktop-bridge-runtime-missing/);
});

test("desktop package versions stay aligned for release assets", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const tauriConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "src-tauri", "tauri.conf.json"), "utf8"));
  const cargoManifest = fs.readFileSync(path.join(projectRoot, "src-tauri", "Cargo.toml"), "utf8");
  const cargoVersion = cargoManifest.match(/^version\s*=\s*"([^"]+)"/m);

  assert.ok(cargoVersion, "Cargo manifest must declare a package version.");
  assert.equal(packageJson.version, tauriConfig.version);
  assert.equal(packageJson.version, cargoVersion[1]);
});

test("windows release workflow syncs app version from the release tag before building", () => {
  const workflow = fs.readFileSync(path.join(projectRoot, ".github", "workflows", "release-windows.yml"), "utf8");
  assert.ok(
    workflow.indexOf("Sync app version from release tag") < workflow.indexOf("Install Node dependencies"),
    "release workflow must sync versions before installing and building"
  );
  assert.ok(
    workflow.indexOf("Sync app version from release tag") < workflow.lastIndexOf("Build Windows desktop bundle"),
    "release workflow must sync versions before tauri build"
  );
  assert.match(workflow, /package\.json/);
  assert.match(workflow, /src-tauri\/tauri\.conf\.json/);
  assert.match(workflow, /src-tauri\/Cargo\.toml/);
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
