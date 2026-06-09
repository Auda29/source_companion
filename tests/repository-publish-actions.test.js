"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { runGitCommand } = require("../src/git-cli-wrapper");
const {
  buildPublishActionRequest,
  preparePublishPreflight,
  runPublishAction
} = require("../src/repository-publish-actions");

test("maps publish request to validated GitHub repository options", () => {
  const repositoryPath = path.join(os.tmpdir(), "source-companion-publish-request");
  const request = buildPublishActionRequest({
    repositoryPath,
    name: "source-companion",
    description: "Focused source control",
    visibility: "public",
    initIfNeeded: true
  });

  assert.equal(request.ok, true);
  assert.equal(request.repositoryPath, repositoryPath);
  assert.equal(request.name, "source-companion");
  assert.equal(request.description, "Focused source control");
  assert.equal(request.visibility, "public");
  assert.equal(request.initIfNeeded, true);
});

test("rejects invalid publish requests before GitHub or Git execution", async () => {
  const result = await runPublishAction({
    repositoryPath: "relative",
    name: "bad/name",
    githubClient: authenticatedGitHubClient(),
    execute: () => {
      throw new Error("should not execute Git");
    }
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /absolute/);
});

test("requires GitHub auth before inspecting local repository", async () => {
  let executed = false;
  const result = await runPublishAction({
    repositoryPath: path.join(os.tmpdir(), "source-companion-publish-auth"),
    name: "repo",
    githubClient: {
      getAuthStatus: async () => ({
        authenticated: false,
        error: {
          kind: "github-auth-missing",
          message: "GitHub login is required."
        }
      }),
      createRepository: async () => {
        throw new Error("should not create GitHub repo");
      }
    },
    execute: () => {
      executed = true;
      throw new Error("should not execute Git");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.kind, "github-auth-missing");
  assert.equal(executed, false);
});

test("preflight prepares confirmed Git init without running init", async () => {
  const repositoryPath = path.join(os.tmpdir(), "source-companion-publish-preflight-no-git");
  const executed = [];
  const result = await preparePublishPreflight({
    repositoryPath,
    name: "repo",
    initIfNeeded: true,
    publicConfirmed: false,
    githubClient: authenticatedGitHubClient(),
    execute: async (command) => {
      executed.push(command.action);
      return {
        ok: false,
        action: command.action,
        args: [],
        stdout: "",
        stderr: "fatal: not a git repository",
        exitCode: 128,
        error: {
          kind: "git-error",
          message: "Git command failed."
        }
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.action, "publish-preflight");
  assert.equal(result.needsGitInit, true);
  assert.deepEqual(executed, ["status"]);
});

test("preflight sends repositories without commits to commit flow", async () => {
  const repositoryPath = path.join(os.tmpdir(), "source-companion-publish-preflight-no-commits");
  const result = await preparePublishPreflight({
    repositoryPath,
    name: "repo",
    githubClient: authenticatedGitHubClient(),
    execute: async (command) => {
      assert.equal(command.action, "status");
      return gitResult(command, "## No commits yet on main\n");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.needsCommit, true);
  assert.equal(result.error.kind, "no-commits");
  assert.match(result.message, /commit/i);
});

test("preflight blocks repositories with existing remotes", async () => {
  const repositoryPath = path.join(os.tmpdir(), "source-companion-publish-preflight-remote");
  const result = await preparePublishPreflight({
    repositoryPath,
    name: "repo",
    githubClient: authenticatedGitHubClient(),
    execute: async (command) => {
      if (command.action === "status") return gitResult(command, "## main\n");
      if (command.action === "remote") {
        return gitResult(command, "origin\thttps://github.com/octo/repo.git (fetch)\norigin\thttps://github.com/octo/repo.git (push)\n");
      }
      throw new Error("unexpected command");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.kind, "remote-already-configured");
  assert.deepEqual(result.remotes, ["origin"]);
});

test("requires explicit init for folders without Git", async () => {
  const repositoryPath = path.join(os.tmpdir(), "source-companion-publish-no-git");
  const result = await runPublishAction({
    repositoryPath,
    name: "repo",
    githubClient: authenticatedGitHubClient(),
    execute: async (command) => ({
      ok: false,
      action: command.action,
      args: [],
      stdout: "",
      stderr: "fatal: not a git repository",
      exitCode: 128,
      error: {
        kind: "git-error",
        message: "Git command failed."
      }
    })
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.kind, "git-init-required");
});

test("refuses to publish repositories with existing remotes", async () => {
  const repositoryPath = path.join(os.tmpdir(), "source-companion-publish-remote");
  const result = await runPublishAction({
    repositoryPath,
    name: "repo",
    githubClient: authenticatedGitHubClient(),
    execute: async (command) => {
      if (command.action === "status") {
        return gitResult(command, "## main\n");
      }
      if (command.action === "remote") {
        return gitResult(command, "origin\thttps://github.com/octo/repo.git (fetch)\norigin\thttps://github.com/octo/repo.git (push)\n");
      }
      throw new Error("should not create additional Git commands");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.kind, "remote-already-configured");
});

test("publishes a committed local repository through Git wrapper", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-publish-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const repositoryPath = path.join(tempRoot, "repo");
  fs.mkdirSync(repositoryPath);
  const init = await runGitCommand({ action: "init", repositoryPath });
  if (init.error && init.error.kind === "git-not-found") {
    t.skip("Git executable is not available in this environment.");
    return;
  }

  assert.equal(init.ok, true, init.error ? init.error.message : init.stderr);
  configureUser(repositoryPath);
  fs.writeFileSync(path.join(repositoryPath, "README.md"), "# Repo\n");
  execFileSync("git", ["add", "README.md"], { cwd: repositoryPath });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: repositoryPath });

  const originPath = path.join(tempRoot, "origin.git");
  execFileSync("git", ["init", "--bare", originPath]);
  const githubClient = authenticatedGitHubClient({
    createRepository: async (options) => {
      assert.deepEqual(options, {
        name: "source-companion",
        description: "Focused source control",
        private: true
      });
      return {
        ok: true,
        repository: {
          owner: "octo",
          name: "source-companion",
          fullName: "octo/source-companion",
          cloneUrl: originPath
        },
        error: null
      };
    }
  });

  const result = await runPublishAction({
    repositoryPath,
    name: "source-companion",
    description: "Focused source control",
    visibility: "private",
    githubClient,
    execute: (command) => runGitCommand(command)
  });

  assert.equal(result.ok, true, result.message);
  assert.equal(result.repository.cloneUrl, originPath);
  assert.match(execFileSync("git", ["remote", "-v"], { cwd: repositoryPath, encoding: "utf8" }), /origin/);
  const remoteRefs = execFileSync("git", ["show-ref"], { cwd: originPath, encoding: "utf8" });
  assert.match(remoteRefs, /refs\/heads\//);
});

function authenticatedGitHubClient(overrides = {}) {
  return {
    getAuthStatus: async () => ({
      authenticated: true,
      user: "octo"
    }),
    createRepository: async () => ({
      ok: true,
      repository: {
        owner: "octo",
        name: "repo",
        fullName: "octo/repo",
        cloneUrl: "https://github.com/octo/repo.git"
      },
      error: null
    }),
    ...overrides
  };
}

function gitResult(command, stdout = "", stderr = "") {
  return {
    ok: true,
    action: command.action,
    args: [],
    stdout,
    stderr,
    exitCode: 0,
    error: null
  };
}

function configureUser(repositoryPath) {
  execFileSync("git", ["config", "user.email", "source-companion@example.invalid"], { cwd: repositoryPath });
  execFileSync("git", ["config", "user.name", "Source Companion Tests"], { cwd: repositoryPath });
}
