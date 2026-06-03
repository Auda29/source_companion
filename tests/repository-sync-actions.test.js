"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildSyncActionRequest,
  runSyncAction
} = require("../src/repository-sync-actions");

test("maps sync actions to structured Git commands", () => {
  const git = {
    branch: { name: "main", detached: false },
    remote: { name: "origin" },
    upstream: { name: "origin/main" },
    staged: [{ path: "app.txt" }]
  };

  assert.deepEqual(buildSyncActionRequest({
    repositoryPath: "/repo",
    git,
    action: "fetch"
  }).commands, [
    { action: "fetch", repositoryPath: "/repo", options: { remote: "origin" } }
  ]);

  assert.deepEqual(buildSyncActionRequest({
    repositoryPath: "/repo",
    git,
    action: "pull"
  }).commands, [
    { action: "pull", repositoryPath: "/repo", options: { remote: "origin", branch: "main", ffOnly: true } }
  ]);

  assert.deepEqual(buildSyncActionRequest({
    repositoryPath: "/repo",
    git,
    action: "push"
  }).commands, [
    { action: "push", repositoryPath: "/repo", options: { remote: "origin", branch: "main", setUpstream: false } }
  ]);

  assert.deepEqual(buildSyncActionRequest({
    repositoryPath: "/repo",
    git,
    action: "publish-branch"
  }).commands, [
    { action: "push", repositoryPath: "/repo", options: { remote: "origin", branch: "main", setUpstream: true } }
  ]);

  assert.deepEqual(buildSyncActionRequest({
    repositoryPath: "/repo",
    git,
    action: "sync"
  }).commands.map((command) => command.action), ["fetch", "pull", "push"]);

  assert.deepEqual(buildSyncActionRequest({
    repositoryPath: "/repo",
    git,
    action: "commit-and-push",
    message: "Ship app"
  }).commands.map((command) => command.action), ["commit", "push"]);
});

test("rejects incomplete sync requests before Git execution", async () => {
  const missingRemote = await runSyncAction({
    repositoryPath: "/repo",
    git: { branch: { name: "main", detached: false } },
    action: "fetch",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missingRemote.ok, false);
  assert.match(missingRemote.message, /remote/);

  const missingUpstream = await runSyncAction({
    repositoryPath: "/repo",
    git: {
      branch: { name: "main", detached: false },
      remote: { name: "origin" }
    },
    action: "push",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missingUpstream.ok, false);
  assert.match(missingUpstream.message, /upstream/);

  const detached = await runSyncAction({
    repositoryPath: "/repo",
    git: {
      branch: { name: "HEAD", detached: true },
      remote: { name: "origin" },
      upstream: { name: "origin/main" }
    },
    action: "publish-branch",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(detached.ok, false);
  assert.match(detached.message, /local branch/);
});

test("fetches, pulls, pushes, publishes, and commits then pushes", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-sync-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const seedPath = path.join(tempRoot, "seed");
  fs.mkdirSync(seedPath);
  const init = await runGitCommand({ action: "init", repositoryPath: seedPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  configureUser(seedPath);
  execFileSync("git", ["branch", "-M", "main"], { cwd: seedPath });
  fs.writeFileSync(path.join(seedPath, "app.txt"), "one\n");
  execFileSync("git", ["add", "app.txt"], { cwd: seedPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: seedPath });

  const originPath = path.join(tempRoot, "origin.git");
  execFileSync("git", ["init", "--bare", originPath]);
  execFileSync("git", ["remote", "add", "origin", originPath], { cwd: seedPath });
  execFileSync("git", ["push", "-u", "origin", "main"], { cwd: seedPath });
  execFileSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"], { cwd: originPath });

  const repositoryPath = path.join(tempRoot, "clone");
  execFileSync("git", ["clone", originPath, repositoryPath]);
  configureUser(repositoryPath);

  fs.writeFileSync(path.join(seedPath, "app.txt"), "one\ntwo\n");
  execFileSync("git", ["commit", "-am", "remote change"], { cwd: seedPath });
  execFileSync("git", ["push"], { cwd: seedPath });

  const baseGit = {
    branch: { name: "main", detached: false },
    remote: { name: "origin" },
    upstream: { name: "origin/main" },
    staged: []
  };

  const fetch = await runSyncAction({ repositoryPath, git: baseGit, action: "fetch" });
  assert.equal(fetch.ok, true, fetch.message);

  const pull = await runSyncAction({ repositoryPath, git: baseGit, action: "pull" });
  assert.equal(pull.ok, true, pull.message);
  assert.equal(normalizeLines(fs.readFileSync(path.join(repositoryPath, "app.txt"), "utf8")), "one\ntwo\n");

  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "one\ntwo\nthree\n");
  execFileSync("git", ["commit", "-am", "local change"], { cwd: repositoryPath });
  const push = await runSyncAction({ repositoryPath, git: baseGit, action: "push" });
  assert.equal(push.ok, true, push.message);
  assert.equal(bareLogSubject(originPath, "main"), "local change");

  execFileSync("git", ["switch", "-c", "feature"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "feature.txt"), "feature\n");
  execFileSync("git", ["add", "feature.txt"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "feature start"], { cwd: repositoryPath });
  const featureGit = {
    branch: { name: "feature", detached: false },
    remote: { name: "origin" },
    upstream: null,
    staged: []
  };
  const publish = await runSyncAction({ repositoryPath, git: featureGit, action: "publish-branch" });
  assert.equal(publish.ok, true, publish.message);
  assert.equal(execFileSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
    cwd: repositoryPath,
    encoding: "utf8"
  }).trim(), "origin/feature");

  fs.writeFileSync(path.join(repositoryPath, "feature.txt"), "feature\nnext\n");
  execFileSync("git", ["add", "feature.txt"], { cwd: repositoryPath });
  const commitAndPush = await runSyncAction({
    repositoryPath,
    git: {
      ...featureGit,
      upstream: { name: "origin/feature" },
      staged: [{ path: "feature.txt" }]
    },
    action: "commit-and-push",
    message: "feature next"
  });
  assert.equal(commitAndPush.ok, true, commitAndPush.message);
  assert.equal(bareLogSubject(originPath, "feature"), "feature next");
});

function configureUser(repositoryPath) {
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });
}

function bareLogSubject(originPath, branch) {
  return execFileSync("git", ["--git-dir", originPath, "log", "--max-count=1", "--pretty=%s", branch], {
    encoding: "utf8"
  }).trim();
}

function normalizeLines(value) {
  return String(value).replace(/\r\n/g, "\n");
}
