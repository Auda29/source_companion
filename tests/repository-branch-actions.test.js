"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildBranchActionRequest,
  runBranchAction
} = require("../src/repository-branch-actions");

test("maps branch actions to structured Git commands", () => {
  assert.deepEqual(buildBranchActionRequest({
    repositoryPath: "/repo",
    action: "create",
    name: "feature",
    startPoint: "main"
  }).command, {
    action: "branch",
    repositoryPath: "/repo",
    options: { mode: "create", name: "feature", startPoint: "main" }
  });

  assert.deepEqual(buildBranchActionRequest({
    repositoryPath: "/repo",
    action: "switch",
    name: "feature"
  }).command, {
    action: "switch",
    repositoryPath: "/repo",
    options: { branch: "feature" }
  });

  assert.deepEqual(buildBranchActionRequest({
    repositoryPath: "/repo",
    git: { branch: { name: "main", detached: false } },
    action: "delete",
    name: "feature"
  }).command, {
    action: "branch",
    repositoryPath: "/repo",
    options: { mode: "delete", name: "feature", force: false }
  });

  assert.deepEqual(buildBranchActionRequest({
    repositoryPath: "/repo",
    action: "checkout-remote",
    remoteBranch: "origin/feature"
  }).command, {
    action: "switch",
    repositoryPath: "/repo",
    options: { branch: "origin/feature", track: true }
  });

  assert.deepEqual(buildBranchActionRequest({
    repositoryPath: "/repo",
    action: "checkout-remote",
    remoteBranch: "remotes/origin/feature",
    localName: "local-feature"
  }).command, {
    action: "switch",
    repositoryPath: "/repo",
    options: {
      branch: "local-feature",
      create: true,
      track: true,
      startPoint: "origin/feature"
    }
  });
});

test("rejects unsafe or incomplete branch requests before Git execution", async () => {
  const missing = await runBranchAction({
    repositoryPath: "/repo",
    action: "create",
    name: " ",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /branch name/);

  const currentDelete = await runBranchAction({
    repositoryPath: "/repo",
    git: { branch: { name: "main", detached: false } },
    action: "delete",
    name: "main",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(currentDelete.ok, false);
  assert.match(currentDelete.message, /current branch/);

  const remoteHead = await runBranchAction({
    repositoryPath: "/repo",
    action: "checkout-remote",
    remoteBranch: "origin/HEAD",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(remoteHead.ok, false);
  assert.match(remoteHead.message, /remote branch/);
});

test("creates, switches, safely deletes, and checks out remote branches", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-branches-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const seedPath = path.join(tempRoot, "seed");
  fs.mkdirSync(seedPath);
  const init = await runGitCommand({ action: "init", repositoryPath: seedPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: seedPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: seedPath });
  execFileSync("git", ["branch", "-M", "main"], { cwd: seedPath });
  fs.writeFileSync(path.join(seedPath, "app.txt"), "one\n");
  execFileSync("git", ["add", "app.txt"], { cwd: seedPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: seedPath });

  const originPath = path.join(tempRoot, "origin.git");
  execFileSync("git", ["init", "--bare", originPath]);
  execFileSync("git", ["remote", "add", "origin", originPath], { cwd: seedPath });
  execFileSync("git", ["push", "-u", "origin", "main"], { cwd: seedPath });
  execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], { cwd: originPath });
  execFileSync("git", ["switch", "-c", "remote-feature"], { cwd: seedPath });
  fs.writeFileSync(path.join(seedPath, "feature.txt"), "two\n");
  execFileSync("git", ["add", "feature.txt"], { cwd: seedPath });
  execFileSync("git", ["commit", "-m", "feature"], { cwd: seedPath });
  execFileSync("git", ["push", "-u", "origin", "remote-feature"], { cwd: seedPath });

  const repositoryPath = path.join(tempRoot, "clone");
  execFileSync("git", ["clone", originPath, repositoryPath]);

  const create = await runBranchAction({
    repositoryPath,
    action: "create",
    name: "local-work",
    startPoint: "main"
  });
  assert.equal(create.ok, true, create.message);

  const branchSwitch = await runBranchAction({
    repositoryPath,
    action: "switch",
    name: "local-work"
  });
  assert.equal(branchSwitch.ok, true, branchSwitch.message);
  assert.equal(execFileSync("git", ["branch", "--show-current"], { cwd: repositoryPath, encoding: "utf8" }).trim(), "local-work");

  execFileSync("git", ["switch", "main"], { cwd: repositoryPath });
  const deleteBranch = await runBranchAction({
    repositoryPath,
    git: { branch: { name: "main", detached: false } },
    action: "delete",
    name: "local-work"
  });
  assert.equal(deleteBranch.ok, true, deleteBranch.message);

  const checkoutRemote = await runBranchAction({
    repositoryPath,
    action: "checkout-remote",
    remoteBranch: "origin/remote-feature"
  });
  assert.equal(checkoutRemote.ok, true, checkoutRemote.message);
  assert.equal(execFileSync("git", ["branch", "--show-current"], { cwd: repositoryPath, encoding: "utf8" }).trim(), "remote-feature");
});
