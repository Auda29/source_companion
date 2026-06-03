"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildCommitActionRequest,
  runCommitAction
} = require("../src/repository-commit-actions");

test("maps commit actions to structured Git commands", () => {
  assert.deepEqual(buildCommitActionRequest({
    repositoryPath: "/repo",
    git: { staged: [{ path: "app.txt" }] },
    message: "Ship app",
    action: "commit"
  }).command, {
    action: "commit",
    repositoryPath: "/repo",
    options: { message: "Ship app", amend: false }
  });

  assert.deepEqual(buildCommitActionRequest({
    repositoryPath: "/repo",
    git: { staged: [{ path: "app.txt" }] },
    message: "Fix last commit",
    action: "amend"
  }).command, {
    action: "commit",
    repositoryPath: "/repo",
    options: { message: "Fix last commit", amend: true }
  });
});

test("rejects missing message and empty staging for normal commits", async () => {
  const missingMessage = await runCommitAction({
    repositoryPath: "/repo",
    git: { staged: [{ path: "app.txt" }] },
    message: " ",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missingMessage.ok, false);
  assert.match(missingMessage.message, /commit message/);

  const emptyStaging = await runCommitAction({
    repositoryPath: "/repo",
    git: { staged: [] },
    message: "Ship app",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(emptyStaging.ok, false);
  assert.match(emptyStaging.message, /Stage at least one/);
});

test("commits staged changes and amends through the Git wrapper", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-commit-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });

  fs.writeFileSync(path.join(repositoryPath, "app.txt"), "one\n");
  const stage = await runGitCommand({
    action: "add",
    repositoryPath,
    options: { pathspecs: ["app.txt"] }
  });
  assert.equal(stage.ok, true, stage.error ? stage.error.message : stage.stderr);

  const commit = await runCommitAction({
    repositoryPath,
    git: { staged: [{ path: "app.txt" }] },
    message: "Initial app",
    action: "commit-staged"
  });
  assert.equal(commit.ok, true, commit.message);
  assert.match(commit.command.args.join(" "), /commit/);

  const amend = await runCommitAction({
    repositoryPath,
    git: { staged: [] },
    message: "Initial app amended",
    action: "amend"
  });
  assert.equal(amend.ok, true, amend.message);

  const log = execFileSync("git", ["log", "--max-count=1", "--pretty=%s"], { cwd: repositoryPath, encoding: "utf8" }).trim();
  assert.equal(log, "Initial app amended");
});
