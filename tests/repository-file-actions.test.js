"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildFileActionRequest,
  runFileAction
} = require("../src/repository-file-actions");

test("maps file actions to structured Git commands", () => {
  assert.deepEqual(buildFileActionRequest({
    action: "stage",
    bucketId: "unstaged",
    file: { path: "src/app.js", unstaged: true },
    repositoryPath: "/repo"
  }).command, {
    action: "add",
    repositoryPath: "/repo",
    options: { pathspecs: ["src/app.js"] }
  });

  assert.deepEqual(buildFileActionRequest({
    action: "unstage",
    bucketId: "staged",
    file: { path: "src/app.js", status: "M ", type: "modified", staged: true },
    repositoryPath: "/repo"
  }).command, {
    action: "restore",
    repositoryPath: "/repo",
    options: { staged: true, worktree: false, pathspecs: ["src/app.js"] }
  });

  assert.deepEqual(buildFileActionRequest({
    action: "unstage",
    bucketId: "staged",
    file: { path: "new.js", status: "A ", type: "added", staged: true },
    repositoryPath: "/repo"
  }).command, {
    action: "rm",
    repositoryPath: "/repo",
    options: { cached: true, pathspecs: ["new.js"] }
  });

  assert.deepEqual(buildFileActionRequest({
    action: "discard",
    bucketId: "untracked",
    file: { path: "scratch.txt", untracked: true },
    repositoryPath: "/repo"
  }).command, {
    action: "clean",
    repositoryPath: "/repo",
    options: { pathspecs: ["scratch.txt"] }
  });

  assert.deepEqual(buildFileActionRequest({
    action: "discard",
    bucketId: "unstaged",
    file: { path: "mixed.js", status: "MM", type: "modified", staged: true, unstaged: true },
    repositoryPath: "/repo"
  }).command, {
    action: "restore",
    repositoryPath: "/repo",
    options: { worktree: true, pathspecs: ["mixed.js"] }
  });
});

test("rejects conflicts and actions that do not match the selected file state", async () => {
  const conflict = await runFileAction({
    repositoryPath: "/repo",
    action: "stage",
    bucketId: "conflicted",
    file: { path: "src/app.js", conflicted: true },
    execute: () => {
      throw new Error("should not execute Git");
    }
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.kind, "invalid-request");
  assert.match(conflict.message, /Resolve conflicts/);

  const mismatch = await runFileAction({
    repositoryPath: "/repo",
    action: "unstage",
    bucketId: "unstaged",
    file: { path: "src/app.js", unstaged: true },
    execute: () => {
      throw new Error("should not execute Git");
    }
  });

  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /not staged/);
});

test("stages, unstages, and discards files through the Git wrapper", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-actions-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);

  fs.writeFileSync(path.join(repositoryPath, "tracked.txt"), "one\n");
  const stageNew = await runFileAction({
    repositoryPath,
    action: "stage",
    bucketId: "untracked",
    file: { path: "tracked.txt", untracked: true }
  });
  assert.equal(stageNew.ok, true, stageNew.message);

  const unstageNew = await runFileAction({
    repositoryPath,
    action: "unstage",
    bucketId: "staged",
    file: { path: "tracked.txt", status: "A ", type: "added", staged: true }
  });
  assert.equal(unstageNew.ok, true, unstageNew.message);
  assert.equal(fs.existsSync(path.join(repositoryPath, "tracked.txt")), true);

  const restageNew = await runFileAction({
    repositoryPath,
    action: "stage",
    bucketId: "untracked",
    file: { path: "tracked.txt", untracked: true }
  });
  assert.equal(restageNew.ok, true, restageNew.message);

  const discardStagedNew = await runFileAction({
    repositoryPath,
    action: "discard",
    bucketId: "staged",
    file: { path: "tracked.txt", status: "A ", type: "added", staged: true }
  });
  assert.equal(discardStagedNew.ok, true, discardStagedNew.message);
  assert.equal(fs.existsSync(path.join(repositoryPath, "tracked.txt")), false);

  fs.writeFileSync(path.join(repositoryPath, "scratch.txt"), "scratch\n");
  const discardUntracked = await runFileAction({
    repositoryPath,
    action: "discard",
    bucketId: "untracked",
    file: { path: "scratch.txt", untracked: true }
  });
  assert.equal(discardUntracked.ok, true, discardUntracked.message);
  assert.equal(fs.existsSync(path.join(repositoryPath, "scratch.txt")), false);
});

test("discard from the unstaged bucket preserves staged content for mixed files", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-mixed-discard-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });

  const trackedPath = path.join(repositoryPath, "tracked.txt");
  fs.writeFileSync(trackedPath, "one\n");

  const stageInitial = await runFileAction({
    repositoryPath,
    action: "stage",
    bucketId: "untracked",
    file: { path: "tracked.txt", untracked: true }
  });
  assert.equal(stageInitial.ok, true, stageInitial.message);

  const commit = await runGitCommand({
    action: "commit",
    repositoryPath,
    options: { message: "Initial commit" }
  });
  assert.equal(commit.ok, true, commit.error ? commit.error.message : commit.stderr);

  fs.writeFileSync(trackedPath, "two\n");
  const stageChange = await runFileAction({
    repositoryPath,
    action: "stage",
    bucketId: "unstaged",
    file: { path: "tracked.txt", status: " M", type: "modified", unstaged: true }
  });
  assert.equal(stageChange.ok, true, stageChange.message);

  fs.writeFileSync(trackedPath, "three\n");
  const discardUnstaged = await runFileAction({
    repositoryPath,
    action: "discard",
    bucketId: "unstaged",
    file: { path: "tracked.txt", status: "MM", type: "modified", staged: true, unstaged: true }
  });
  assert.equal(discardUnstaged.ok, true, discardUnstaged.message);

  assert.equal(fs.readFileSync(trackedPath, "utf8").replace(/\r\n/g, "\n"), "two\n");

  const status = await runGitCommand({
    action: "status",
    repositoryPath,
    options: { porcelain: true, branch: false }
  });
  assert.equal(status.ok, true, status.error ? status.error.message : status.stderr);
  assert.match(status.stdout, /^M  tracked\.txt$/m);
  assert.doesNotMatch(status.stdout, /^ M tracked\.txt$/m);
});
