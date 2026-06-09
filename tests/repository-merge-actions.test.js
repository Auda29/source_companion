"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildMergeActionRequest,
  runMergeAction
} = require("../src/repository-merge-actions");

test("maps merge action to a structured Git command", () => {
  const request = buildMergeActionRequest({
    repositoryPath: "/repo",
    git: { branch: { name: "main", detached: false }, staged: [], unstaged: [], untracked: [], conflicted: [] },
    target: "feature"
  });

  assert.equal(request.ok, true);
  assert.deepEqual(request.command, {
    action: "merge",
    repositoryPath: "/repo",
    options: { target: "feature" }
  });
});

test("rejects unsafe merge requests before Git execution", async () => {
  const dirty = await runMergeAction({
    repositoryPath: "/repo",
    git: {
      branch: { name: "main", detached: false },
      staged: [],
      unstaged: [{ path: "app.txt" }],
      untracked: [],
      conflicted: []
    },
    target: "feature",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(dirty.ok, false);
  assert.match(dirty.message, /local changes/);

  const sameBranch = await runMergeAction({
    repositoryPath: "/repo",
    git: { branch: { name: "main", detached: false }, staged: [], unstaged: [], untracked: [], conflicted: [] },
    target: "main",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(sameBranch.ok, false);
  assert.match(sameBranch.message, /different branch/);

  const conflict = await runMergeAction({
    repositoryPath: "/repo",
    git: {
      branch: { name: "main", detached: false },
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [{ path: "app.txt" }]
    },
    target: "feature",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(conflict.ok, false);
  assert.match(conflict.message, /conflicts/);
});

test("merges a selected branch and reports merge conflicts", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-merge-"));
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

  execFileSync("git", ["switch", "-c", "feature"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "feature.txt"), "feature\n");
  execFileSync("git", ["add", "feature.txt"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "feature"], { cwd: repositoryPath });
  execFileSync("git", ["switch", "main"], { cwd: repositoryPath });

  const cleanGit = {
    branch: { name: "main", detached: false },
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: []
  };
  const merged = await runMergeAction({
    repositoryPath,
    git: cleanGit,
    target: "feature"
  });
  assert.equal(merged.ok, true, merged.message);
  assert.equal(normalizeLines(fs.readFileSync(path.join(repositoryPath, "feature.txt"), "utf8")), "feature\n");

  execFileSync("git", ["switch", "-c", "conflict-a"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "conflict-a\n");
  execFileSync("git", ["commit", "-am", "conflict a"], { cwd: repositoryPath });
  execFileSync("git", ["switch", "main"], { cwd: repositoryPath });
  execFileSync("git", ["switch", "-c", "conflict-b"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "conflict-b\n");
  execFileSync("git", ["commit", "-am", "conflict b"], { cwd: repositoryPath });

  const conflicted = await runMergeAction({
    repositoryPath,
    git: {
      branch: { name: "conflict-b", detached: false },
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: []
    },
    target: "conflict-a"
  });
  assert.equal(conflicted.ok, false);
  assert.equal(conflicted.error.kind, "conflict");
  assert.match(conflicted.message, /conflicts/);
  assert.match(execFileSync("git", ["status", "--porcelain"], { cwd: repositoryPath, encoding: "utf8" }), /^UU app\.txt/m);
});

function configureUser(repositoryPath) {
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });
}

function normalizeLines(value) {
  return String(value).replace(/\r\n/g, "\n");
}
