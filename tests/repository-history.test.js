"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  loadRepositoryHistory,
  parseCommitLog
} = require("../src/repository-history");

test("parses tab-delimited commit history", () => {
  const commits = parseCommitLog([
    "abc123456789\tAda Lovelace\t2026-06-09T10:00:00+02:00\tInitial commit",
    "def987654321\tGrace Hopper\t2026-06-09T10:10:00+02:00\tHandle\ttabs"
  ].join("\n"));

  assert.deepEqual(commits[0], {
    hash: "abc123456789",
    shortHash: "abc1234",
    author: "Ada Lovelace",
    authoredAt: "2026-06-09T10:00:00+02:00",
    subject: "Initial commit"
  });
  assert.equal(commits[1].subject, "Handle\ttabs");
});

test("loads commit history and HEAD commit diff", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-history-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "README.md"), "one\n");
  execFileSync("git", ["add", "README.md"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "Initial history"], { cwd: repositoryPath });
  fs.writeFileSync(path.join(repositoryPath, "README.md"), "one\ntwo\n");
  execFileSync("git", ["add", "README.md"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "Update history"], { cwd: repositoryPath });

  const history = await loadRepositoryHistory({ repositoryPath });

  assert.equal(history.status, "ready");
  assert.equal(history.commits.length, 2);
  assert.equal(history.head.subject, "Update history");
  assert.match(history.selectedDiff, /diff --git/);
  assert.match(history.selectedDiff, /\+two/);
});
