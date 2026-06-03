"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const { loadFileDiff } = require("../src/repository-diff");

test("loads staged and unstaged diffs with distinct Git options", async () => {
  const calls = [];
  const execute = async (request) => {
    calls.push(request);
    return {
      ok: true,
      stdout: "diff --git a/src/app.js b/src/app.js\n@@ -1 +1 @@\n-old\n+new\n",
      stderr: "",
      exitCode: 0,
      error: null
    };
  };

  const file = { path: "src/app.js", type: "modified" };
  const staged = await loadFileDiff({
    repositoryPath: process.cwd(),
    file,
    bucketId: "staged",
    execute
  });
  const unstaged = await loadFileDiff({
    repositoryPath: process.cwd(),
    file,
    bucketId: "unstaged",
    execute
  });

  assert.equal(staged.status, "ready");
  assert.equal(staged.mode, "staged");
  assert.equal(unstaged.mode, "unstaged");
  assert.equal(calls[0].options.staged, true);
  assert.equal(calls[1].options.staged, false);
  assert.deepEqual(calls[0].options.pathspecs, ["src/app.js"]);
});

test("returns replacement states for untracked, conflicted, binary, and failed diffs", async () => {
  const untracked = await loadFileDiff({
    repositoryPath: process.cwd(),
    file: { path: "new.txt", untracked: true, type: "untracked" },
    bucketId: "untracked",
    execute: async () => {
      throw new Error("untracked should not call git diff");
    }
  });
  assert.equal(untracked.status, "untracked");

  const conflicted = await loadFileDiff({
    repositoryPath: process.cwd(),
    file: { path: "conflict.txt", conflicted: true, type: "conflict" },
    bucketId: "conflicted"
  });
  assert.equal(conflicted.status, "conflict");

  const binary = await loadFileDiff({
    repositoryPath: process.cwd(),
    file: { path: "image.png", type: "modified" },
    bucketId: "unstaged",
    execute: async () => ({
      ok: true,
      stdout: "Binary files a/image.png and b/image.png differ\n",
      stderr: "",
      exitCode: 0,
      error: null
    })
  });
  assert.equal(binary.status, "binary");

  const failed = await loadFileDiff({
    repositoryPath: process.cwd(),
    file: { path: "src/app.js", type: "modified" },
    bucketId: "unstaged",
    execute: async () => ({
      ok: false,
      stdout: "",
      stderr: "fatal: bad pathspec",
      exitCode: 128,
      error: { kind: "git-error", message: "Git command failed." }
    })
  });
  assert.equal(failed.status, "error");
});

test("loads real unified diffs through the Git wrapper", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-diff-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);

  const filePath = path.join(repositoryPath, "tracked.txt");
  fs.writeFileSync(filePath, "one\n", "utf8");
  const add = await runGitCommand({
    action: "add",
    repositoryPath,
    options: { pathspecs: ["tracked.txt"] }
  });
  assert.equal(add.ok, true, add.error ? add.error.message : add.stderr);

  fs.writeFileSync(filePath, "two\n", "utf8");
  const diff = await loadFileDiff({
    repositoryPath,
    file: { path: "tracked.txt", type: "modified", unstaged: true },
    bucketId: "unstaged"
  });

  assert.equal(diff.status, "ready");
  assert.equal(diff.mode, "unstaged");
  assert.match(diff.diff, /-one/);
  assert.match(diff.diff, /\+two/);
});
