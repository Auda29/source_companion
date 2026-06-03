"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildStashActionRequest,
  parseStashList,
  runStashAction
} = require("../src/repository-stash-actions");

test("maps stash actions to structured Git commands", () => {
  assert.deepEqual(buildStashActionRequest({
    repositoryPath: "/repo",
    action: "list"
  }).command, {
    action: "stash",
    repositoryPath: "/repo",
    options: { mode: "list" }
  });

  assert.deepEqual(buildStashActionRequest({
    repositoryPath: "/repo",
    action: "push",
    message: "wip",
    includeUntracked: true
  }).command, {
    action: "stash",
    repositoryPath: "/repo",
    options: { mode: "push", message: "wip", includeUntracked: true }
  });

  assert.deepEqual(buildStashActionRequest({
    repositoryPath: "/repo",
    action: "apply",
    ref: "stash@{0}"
  }).command, {
    action: "stash",
    repositoryPath: "/repo",
    options: { mode: "apply", ref: "stash@{0}" }
  });

  assert.deepEqual(buildStashActionRequest({
    repositoryPath: "/repo",
    action: "drop",
    ref: "stash@{0}"
  }).command, {
    action: "stash",
    repositoryPath: "/repo",
    options: { mode: "drop", ref: "stash@{0}" }
  });
});

test("rejects incomplete stash requests before Git execution", async () => {
  const missingPath = await runStashAction({
    action: "list",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missingPath.ok, false);
  assert.match(missingPath.message, /repository path/);

  const missingRef = await runStashAction({
    repositoryPath: "/repo",
    action: "apply",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missingRef.ok, false);
  assert.match(missingRef.message, /stash entry/);
});

test("parses stash list output", () => {
  assert.deepEqual(parseStashList("stash@{0}: On main: wip ui\nstash@{1}: WIP on feature: abc123 work\n"), [
    {
      ref: "stash@{0}",
      summary: "On main: wip ui",
      branch: "main",
      message: "wip ui"
    },
    {
      ref: "stash@{1}",
      summary: "WIP on feature: abc123 work",
      branch: null,
      message: "WIP on feature: abc123 work"
    }
  ]);
});

test("stashes, lists, applies, and deletes changes", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-stash-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  configureUser(repositoryPath);
  execFileSync("git", ["branch", "-M", "main"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "one\n");
  execFileSync("git", ["add", "app.txt"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: repositoryPath });

  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "one\ntwo\n");
  fs.writeFileSync(path.join(repositoryPath, "note.txt"), "untracked\n");

  const push = await runStashAction({
    repositoryPath,
    action: "push",
    message: "save work",
    includeUntracked: true
  });
  assert.equal(push.ok, true, push.message);
  assert.equal(fs.existsSync(path.join(repositoryPath, "note.txt")), false);
  assert.equal(normalizeLines(fs.readFileSync(path.join(repositoryPath, "app.txt"), "utf8")), "one\n");

  const list = await runStashAction({ repositoryPath, action: "list" });
  assert.equal(list.ok, true, list.message);
  assert.equal(list.stashes.length, 1);
  assert.equal(list.stashes[0].ref, "stash@{0}");
  assert.equal(list.stashes[0].message, "save work");

  const apply = await runStashAction({ repositoryPath, action: "apply", ref: "stash@{0}" });
  assert.equal(apply.ok, true, apply.message);
  assert.equal(normalizeLines(fs.readFileSync(path.join(repositoryPath, "app.txt"), "utf8")), "one\ntwo\n");
  assert.equal(normalizeLines(fs.readFileSync(path.join(repositoryPath, "note.txt"), "utf8")), "untracked\n");

  const drop = await runStashAction({ repositoryPath, action: "drop", ref: "stash@{0}" });
  assert.equal(drop.ok, true, drop.message);

  const emptyList = await runStashAction({ repositoryPath, action: "list" });
  assert.equal(emptyList.ok, true, emptyList.message);
  assert.equal(emptyList.stashes.length, 0);
});

test("reports conflicts when applying a stash fails", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-stash-conflict-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  configureUser(repositoryPath);
  execFileSync("git", ["branch", "-M", "main"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "base\n");
  execFileSync("git", ["add", "app.txt"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: repositoryPath });

  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "stash\n");
  const push = await runStashAction({
    repositoryPath,
    action: "push",
    message: "conflicting work"
  });
  assert.equal(push.ok, true, push.message);

  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "current\n");
  execFileSync("git", ["commit", "-am", "current change"], { cwd: repositoryPath });

  const apply = await runStashAction({
    repositoryPath,
    action: "apply",
    ref: "stash@{0}"
  });
  assert.equal(apply.ok, false);
  assert.match(apply.message, /conflict/i);
  assert.equal(apply.error.kind, "conflict");
});

function configureUser(repositoryPath) {
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });
}

function normalizeLines(value) {
  return String(value).replace(/\r\n/g, "\n");
}
