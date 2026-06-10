"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildCloneActionRequest,
  runCloneAction
} = require("../src/repository-clone-actions");

test("maps clone request to a structured Git wrapper command", () => {
  const targetPath = path.join(os.tmpdir(), "source-companion-clone-target");
  const request = buildCloneActionRequest({
    url: "https://github.com/owner/repo.git",
    targetPath
  });

  assert.equal(request.ok, true);
  assert.equal(request.repoName, "repo");
  assert.deepEqual(request.commandRequest, {
    action: "clone",
    repositoryPath: targetPath,
    options: {
      url: "https://github.com/owner/repo.git",
      targetPath
    }
  });
});

test("accepts Windows absolute clone targets on non-Windows CI", () => {
  const request = buildCloneActionRequest({
    url: "https://github.com/owner/repo.git",
    targetPath: "C:\\code\\source-companion"
  });

  assert.equal(request.ok, true);
  assert.equal(request.commandRequest.repositoryPath, "C:\\code\\source-companion");
  assert.equal(request.commandRequest.options.targetPath, "C:\\code\\source-companion");
});

test("rejects invalid clone requests before Git execution", async () => {
  const invalidUrl = await runCloneAction({
    url: "file:///tmp/repo",
    targetPath: path.join(os.tmpdir(), "target"),
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(invalidUrl.ok, false);
  assert.match(invalidUrl.message, /HTTPS, SSH, or GitHub/);

  const relativeTarget = await runCloneAction({
    url: "git@github.com:owner/repo.git",
    targetPath: "repo",
    execute: () => {
      throw new Error("should not execute Git");
    }
  });
  assert.equal(relativeTarget.ok, false);
  assert.match(relativeTarget.message, /absolute/);
});

test("clones a repository through the Git wrapper", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-clone-"));
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
  fs.writeFileSync(path.join(seedPath, "app.txt"), "one\n");
  execFileSync("git", ["add", "app.txt"], { cwd: seedPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: seedPath });

  const originPath = path.join(tempRoot, "origin.git");
  execFileSync("git", ["init", "--bare", originPath]);
  execFileSync("git", ["remote", "add", "origin", originPath], { cwd: seedPath });
  execFileSync("git", ["push", "-u", "origin", "master"], { cwd: seedPath });

  const targetPath = path.join(tempRoot, "clone");
  const result = await runCloneAction({
    url: `file://${originPath.replace(/\\/g, "/")}`,
    targetPath,
    execute: (command) => runGitCommand(command)
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /HTTPS, SSH, or GitHub/);

  const localResult = await runCloneAction({
    url: "ssh://example.invalid/owner/repo.git",
    targetPath,
    execute: async (command) => runGitCommand({
      ...command,
      options: {
        ...command.options,
        url: originPath
      }
    })
  });
  assert.equal(localResult.ok, true, localResult.message);
  assert.equal(normalizeLines(fs.readFileSync(path.join(targetPath, "app.txt"), "utf8")), "one\n");
});

function configureUser(repositoryPath) {
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });
}

function normalizeLines(value) {
  return String(value).replace(/\r\n/g, "\n");
}
