"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  ALLOWED_GIT_ACTIONS,
  buildGitArgs,
  runGitCommand
} = require("../src/git-cli-wrapper");

test("whitelists the planned baseline Git actions", () => {
  assert.deepEqual(ALLOWED_GIT_ACTIONS, [
    "status",
    "diff",
    "apply",
    "add",
    "clean",
    "rm",
    "restore",
    "commit",
    "branch",
    "switch",
    "fetch",
    "pull",
    "push",
    "merge",
    "remote",
    "clone",
    "init",
    "log",
    "stash"
  ]);
});

test("builds Git arguments from structured options", () => {
  assert.deepEqual(buildGitArgs("status"), ["status", "--porcelain=v1", "--branch"]);
  assert.deepEqual(buildGitArgs("diff", { staged: true, pathspecs: ["src/main.js"] }), [
    "diff",
    "--staged",
    "--",
    "src/main.js"
  ]);
  assert.deepEqual(buildGitArgs("apply", { cached: true, check: true, whitespaceError: true }), [
    "apply",
    "--cached",
    "--check",
    "--whitespace=error"
  ]);
  assert.deepEqual(buildGitArgs("stash", { mode: "push", message: "wip", includeUntracked: true }), [
    "stash",
    "push",
    "--include-untracked",
    "--message",
    "wip"
  ]);
  assert.deepEqual(buildGitArgs("stash", { mode: "apply", ref: "stash@{0}" }), [
    "stash",
    "apply",
    "stash@{0}"
  ]);
  assert.deepEqual(buildGitArgs("clean", { pathspecs: ["scratch.txt"] }), [
    "clean",
    "--force",
    "--",
    "scratch.txt"
  ]);
  assert.deepEqual(buildGitArgs("rm", { cached: true, pathspecs: ["new.txt"] }), [
    "rm",
    "--cached",
    "--",
    "new.txt"
  ]);
  assert.deepEqual(buildGitArgs("commit", { message: "Ship app", amend: true }), [
    "commit",
    "--message",
    "Ship app",
    "--amend"
  ]);
  assert.deepEqual(buildGitArgs("branch", { mode: "list", all: true }), [
    "branch",
    "--list",
    "--all"
  ]);
  assert.deepEqual(buildGitArgs("switch", { branch: "origin/feature", track: true }), [
    "switch",
    "--track",
    "origin/feature"
  ]);
  assert.deepEqual(buildGitArgs("log", { maxCount: 1, ref: "HEAD", patch: true, format: "empty" }), [
    "log",
    "--max-count=1",
    "--pretty=format:",
    "--patch",
    "HEAD"
  ]);
  assert.deepEqual(buildGitArgs("merge", { target: "feature/work" }), [
    "merge",
    "--no-edit",
    "feature/work"
  ]);
});

test("rejects non-whitelisted actions and force-push options", async () => {
  const unknown = await runGitCommand({
    action: "rebase",
    repositoryPath: process.cwd()
  });

  assert.equal(unknown.ok, false);
  assert.equal(unknown.error.kind, "unsupported-action");

  const forcePush = await runGitCommand({
    action: "push",
    repositoryPath: process.cwd(),
    options: { remote: "origin", branch: "main", force: true }
  });

  assert.equal(forcePush.ok, false);
  assert.equal(forcePush.error.kind, "unsupported-option");
});

test("keeps stdout, stderr, and exit code separate for Git execution", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-git-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({
    action: "init",
    repositoryPath
  });

  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  assert.equal(init.exitCode, 0);
  assert.equal(typeof init.stdout, "string");
  assert.equal(typeof init.stderr, "string");

  const status = await runGitCommand({
    action: "status",
    repositoryPath
  });

  assert.equal(status.ok, true, status.error ? status.error.message : status.stderr);
  assert.equal(status.exitCode, 0);
  assert.match(status.stdout, /^## /);
  assert.equal(status.error, null);
});
