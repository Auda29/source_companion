"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildHunkPatch,
  parseUnifiedDiffHunks,
  runHunkAction
} = require("../src/repository-hunk-actions");

const SAMPLE_DIFF = [
  "diff --git a/app.txt b/app.txt",
  "index 5626abf..f719efd 100644",
  "--- a/app.txt",
  "+++ b/app.txt",
  "@@ -1,3 +1,3 @@",
  " one",
  "-two",
  "+two changed",
  " three",
  "@@ -8,3 +8,3 @@",
  " eight",
  "-nine",
  "+nine changed",
  " ten",
  ""
].join("\n");

test("parses unified diff hunks and builds a single-hunk patch", () => {
  const hunks = parseUnifiedDiffHunks(SAMPLE_DIFF);
  assert.equal(hunks.length, 2);
  assert.equal(hunks[0].header, "@@ -1,3 +1,3 @@");
  assert.equal(hunks[1].header, "@@ -8,3 +8,3 @@");

  const patch = buildHunkPatch(SAMPLE_DIFF, 1);
  assert.equal(patch.ok, true);
  assert.match(patch.patch, /^diff --git a\/app.txt b\/app.txt/);
  assert.match(patch.patch, /@@ -8,3 \+8,3 @@/);
  assert.doesNotMatch(patch.patch, /@@ -1,3 \+1,3 @@/);
});

test("checks a hunk before applying it and reports stale or invalid hunks", async () => {
  const calls = [];
  const result = await runHunkAction({
    repositoryPath: "/repo",
    action: "stage-hunk",
    bucketId: "unstaged",
    file: { path: "app.txt", unstaged: true },
    diff: SAMPLE_DIFF,
    hunkIndex: 0,
    execute: async (request) => {
      calls.push(request);
      return {
        ok: request.options.check,
        args: ["apply", "--cached", request.options.check ? "--check" : null].filter(Boolean),
        stdout: "",
        stderr: request.options.check ? "" : "patch does not apply",
        exitCode: request.options.check ? 0 : 1,
        error: request.options.check ? null : { kind: "git-error", message: "Git command failed." }
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.check, true);
  assert.equal(calls[1].options.check, false);
  assert.equal(calls[0].input.includes("@@ -1,3 +1,3 @@"), true);
  assert.equal(result.ok, false);
  assert.match(result.message, /no longer applies|Git command failed|failed after validation/);

  const missing = await runHunkAction({
    repositoryPath: "/repo",
    action: "stage-hunk",
    bucketId: "unstaged",
    file: { path: "app.txt", unstaged: true },
    diff: SAMPLE_DIFF,
    hunkIndex: 4,
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /no longer available/);
});

test("stages and unstages one real hunk through the Git wrapper", async (t) => {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-hunk-"));
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));

  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Test"], { cwd: repositoryPath });

  const filePath = path.join(repositoryPath, "app.txt");
  fs.writeFileSync(filePath, [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    ""
  ].join("\n"), "utf8");
  assert.equal((await runGitCommand({
    action: "add",
    repositoryPath,
    options: { pathspecs: ["app.txt"] }
  })).ok, true);

  const commit = await runGitCommand({
    action: "commit",
    repositoryPath,
    options: { message: "initial" }
  });
  assert.equal(commit.ok, true, commit.error ? commit.error.message : commit.stderr);

  fs.writeFileSync(filePath, [
    "one",
    "two changed",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen changed",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    ""
  ].join("\n"), "utf8");
  const diff = await runGitCommand({
    action: "diff",
    repositoryPath,
    options: { pathspecs: ["app.txt"] }
  });
  assert.equal(diff.ok, true, diff.error ? diff.error.message : diff.stderr);

  const stageFirst = await runHunkAction({
    repositoryPath,
    action: "stage-hunk",
    bucketId: "unstaged",
    file: { path: "app.txt", unstaged: true },
    diff: diff.stdout,
    hunkIndex: 0
  });
  assert.equal(stageFirst.ok, true, stageFirst.message);

  const stagedDiff = await runGitCommand({
    action: "diff",
    repositoryPath,
    options: { staged: true, pathspecs: ["app.txt"] }
  });
  assert.match(stagedDiff.stdout, /two changed/);
  assert.doesNotMatch(stagedDiff.stdout, /sixteen changed/);

  const unstageFirst = await runHunkAction({
    repositoryPath,
    action: "unstage-hunk",
    bucketId: "staged",
    file: { path: "app.txt", staged: true },
    diff: stagedDiff.stdout,
    hunkIndex: 0
  });
  assert.equal(unstageFirst.ok, true, unstageFirst.message);

  const stagedAfterUnstage = await runGitCommand({
    action: "diff",
    repositoryPath,
    options: { staged: true, pathspecs: ["app.txt"] }
  });
  assert.equal(stagedAfterUnstage.stdout.trim(), "");
});
