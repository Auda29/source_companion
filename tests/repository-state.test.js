"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  loadRepositoryState,
  parsePorcelainStatus,
  parseRemotes
} = require("../src/repository-state");

test("classifies missing and non-git folders explicitly", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-state-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const missing = await loadRepositoryState({ repositoryPath: path.join(tempRoot, "missing") });
  assert.equal(missing.kind, "no-folder");
  assert.equal(missing.error.kind, "missing-folder");

  const plainFolder = path.join(tempRoot, "plain");
  fs.mkdirSync(plainFolder);
  const plain = await loadRepositoryState({ repositoryPath: plainFolder });
  assert.equal(plain.kind, "folder-without-git");
  assert.equal(plain.health, "ready");
});

test("parses branch, divergence, file buckets, and conflicts from porcelain status", () => {
  const state = parsePorcelainStatus([
    "## main...origin/main [ahead 2, behind 1]",
    "M  staged.js",
    " M unstaged.js",
    "?? new-file.js",
    "UU conflicted.js",
    "R  old-name.js -> new-name.js"
  ].join("\n"));

  assert.deepEqual(state.branch, { name: "main", detached: false, headSha: null });
  assert.deepEqual(state.upstream, { name: "origin/main" });
  assert.deepEqual(state.divergence, { ahead: 2, behind: 1 });
  assert.equal(state.files.find((file) => file.path === "staged.js").staged, true);
  assert.equal(state.files.find((file) => file.path === "unstaged.js").unstaged, true);
  assert.equal(state.files.find((file) => file.path === "new-file.js").untracked, true);
  assert.equal(state.files.find((file) => file.path === "conflicted.js").conflicted, true);
  assert.deepEqual(
    state.files.find((file) => file.path === "new-name.js"),
    {
      path: "new-name.js",
      oldPath: "old-name.js",
      status: "R ",
      indexStatus: "R",
      worktreeStatus: " ",
      type: "renamed",
      staged: true,
      unstaged: false,
      untracked: false,
      conflicted: false
    }
  );
});

test("parses GitHub remotes and authenticated GitHub state", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-github-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);

  const remote = await runGitCommand({
    action: "remote",
    repositoryPath,
    options: {
      mode: "add",
      name: "origin",
      url: "https://github.com/example/source-companion.git"
    }
  });
  assert.equal(remote.ok, true, remote.error ? remote.error.message : remote.stderr);

  const state = await loadRepositoryState({
    repositoryPath,
    githubAuth: { authenticated: true, user: "wecke" }
  });

  assert.equal(state.kind, "github-authenticated");
  assert.equal(state.git.remote.kind, "github");
  assert.deepEqual(state.github, {
    owner: "example",
    name: "source-companion",
    host: "github.com",
    remote: "origin",
    authenticated: true,
    user: "wecke"
  });
});

test("marks queued or running repository work as operation-running", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-running-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  const state = await loadRepositoryState({
    repositoryPath,
    operations: {
      running: [{ id: "op-1", kind: "fetch", status: "running" }],
      queued: [],
      completed: [],
      lastCompleted: null
    }
  });

  assert.equal(state.health, "operation-running");
});

test("parses multiple remote URL styles", () => {
  const remotes = parseRemotes([
    "origin\thttps://github.com/example/source-companion.git (fetch)",
    "origin\thttps://github.com/example/source-companion.git (push)",
    "backup\tgit@example.com:elsewhere/source-companion.git (fetch)"
  ].join("\n"));

  assert.equal(remotes.length, 2);
  assert.equal(remotes[0].name, "origin");
  assert.equal(remotes[0].kind, "github");
  assert.deepEqual(remotes[0].github, {
    owner: "example",
    name: "source-companion",
    host: "github.com"
  });
  assert.equal(remotes[1].kind, "ssh");
  assert.equal(remotes[1].github, null);
});
