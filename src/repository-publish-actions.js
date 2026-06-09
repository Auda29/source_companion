"use strict";

const path = require("node:path");

const { runGitCommand } = require("./git-cli-wrapper");

async function runPublishAction({
  repositoryPath,
  name,
  description = "",
  visibility = "private",
  initIfNeeded = false,
  githubClient,
  execute = runGitCommand
} = {}) {
  const request = buildPublishActionRequest({
    repositoryPath,
    name,
    description,
    visibility,
    initIfNeeded
  });
  if (!request.ok) return request;

  if (!githubClient || typeof githubClient.getAuthStatus !== "function" ||
    typeof githubClient.createRepository !== "function") {
    return createInvalidResult("GitHub publish is not available in this runtime.", "github-api-unavailable");
  }

  const auth = await githubClient.getAuthStatus();
  if (!auth || !auth.authenticated) {
    return createInvalidResult(
      auth && auth.error && auth.error.message ? auth.error.message : "GitHub login is required before publishing.",
      auth && auth.error && auth.error.kind ? auth.error.kind : "github-auth-missing"
    );
  }

  const local = await prepareLocalRepository({
    repositoryPath: request.repositoryPath,
    initIfNeeded: request.initIfNeeded,
    execute
  });
  if (!local.ok) return local;

  const remoteCheck = await execute(remoteListCommand(request.repositoryPath));
  if (!remoteCheck.ok) {
    return createPublishResult({
      ok: false,
      request,
      steps: [...local.steps, remoteCheck],
      message: publishFailureMessage(remoteCheck, "Could not inspect existing remotes."),
      error: remoteCheck.error
    });
  }

  if (parseRemotes(remoteCheck.stdout).length > 0) {
    return createPublishResult({
      ok: false,
      request,
      steps: [...local.steps, remoteCheck],
      message: "This repository already has a remote. Source Companion will not overwrite or add publish remotes silently.",
      error: {
        kind: "remote-already-configured",
        message: "Existing remotes must be reviewed before publishing."
      }
    });
  }

  let created;
  try {
    created = await githubClient.createRepository({
      name: request.name,
      description: request.description,
      private: request.visibility === "private"
    });
  } catch (error) {
    return createPublishResult({
      ok: false,
      request,
      steps: [...local.steps, remoteCheck],
      message: error && error.message ? error.message : "GitHub repository could not be created.",
      error: error && error.kind ? error : {
        kind: "github-api-error",
        message: error && error.message ? error.message : "GitHub repository could not be created."
      }
    });
  }

  if (!created || !created.ok || !created.repository || !clean(created.repository.cloneUrl)) {
    const error = created && created.error ? created.error : {
      kind: "github-api-error",
      message: "GitHub repository could not be created."
    };
    return createPublishResult({
      ok: false,
      request,
      steps: [...local.steps, remoteCheck],
      message: error.message || "GitHub repository could not be created.",
      error
    });
  }

  const remoteAdd = await execute(remoteAddCommand(request.repositoryPath, clean(created.repository.cloneUrl)));
  if (!remoteAdd.ok) {
    return createPublishResult({
      ok: false,
      request,
      repository: created.repository,
      steps: [...local.steps, remoteCheck, remoteAdd],
      message: publishFailureMessage(remoteAdd, "GitHub repository was created, but origin could not be set."),
      error: remoteAdd.error
    });
  }

  const push = await execute(pushCommand(request.repositoryPath, local.branch));
  if (!push.ok) {
    return createPublishResult({
      ok: false,
      request,
      repository: created.repository,
      steps: [...local.steps, remoteCheck, remoteAdd, push],
      message: publishFailureMessage(push, "GitHub repository was created, but the initial push failed."),
      error: push.error
    });
  }

  return createPublishResult({
    ok: true,
    request,
    repository: created.repository,
    steps: [...local.steps, remoteCheck, remoteAdd, push],
    message: `${request.name} was published to GitHub.`
  });
}

function buildPublishActionRequest({
  repositoryPath,
  name,
  description = "",
  visibility = "private",
  initIfNeeded = false
} = {}) {
  const normalizedPath = clean(repositoryPath);
  const normalizedName = clean(name);
  const normalizedVisibility = clean(visibility) || "private";

  if (!normalizedPath) return createInvalidResult("Enter an absolute local folder.");
  if (!path.isAbsolute(normalizedPath)) return createInvalidResult("Local folder must be an absolute path.");
  if (!isValidRepositoryName(normalizedName)) {
    return createInvalidResult("Enter a GitHub repository name using letters, numbers, dots, dashes, or underscores.");
  }
  if (!["private", "public"].includes(normalizedVisibility)) {
    return createInvalidResult("Choose private or public visibility.");
  }

  return {
    ok: true,
    action: "publish",
    repositoryPath: normalizedPath,
    name: normalizedName,
    description: clean(description),
    visibility: normalizedVisibility,
    initIfNeeded: Boolean(initIfNeeded),
    command: null,
    message: "Publish request is valid."
  };
}

async function prepareLocalRepository({ repositoryPath, initIfNeeded, execute }) {
  const steps = [];
  let status = await execute(statusCommand(repositoryPath));
  steps.push(status);

  if (!status.ok && isNotGitRepository(status)) {
    if (!initIfNeeded) {
      return createPublishResult({
        ok: false,
        steps,
        message: "This folder is not a Git repository. Confirm Git init before publishing.",
        error: {
          kind: "git-init-required",
          message: "Git init must be explicitly confirmed."
        }
      });
    }

    const init = await execute(initCommand(repositoryPath));
    steps.push(init);
    if (!init.ok) {
      return createPublishResult({
        ok: false,
        steps,
        message: publishFailureMessage(init, "Git init failed."),
        error: init.error
      });
    }

    status = await execute(statusCommand(repositoryPath));
    steps.push(status);
  }

  if (!status.ok) {
    return createPublishResult({
      ok: false,
      steps,
      message: publishFailureMessage(status, "Could not inspect local repository."),
      error: status.error
    });
  }

  const parsed = parseStatusBranch(status.stdout);
  if (parsed.noCommits) {
    return createPublishResult({
      ok: false,
      steps,
      message: "Create a commit before publishing this repository to GitHub.",
      error: {
        kind: "no-commits",
        message: "Publish needs an initial commit before origin can be pushed."
      }
    });
  }
  if (!parsed.branch || parsed.detached) {
    return createPublishResult({
      ok: false,
      steps,
      message: "Check out a local branch before publishing.",
      error: {
        kind: "branch-required",
        message: "Publish needs a local branch."
      }
    });
  }

  return {
    ok: true,
    branch: parsed.branch,
    steps
  };
}

function createPublishResult({
  ok,
  request = null,
  repository = null,
  steps = [],
  message,
  error = null
}) {
  const normalizedSteps = steps.map(normalizeStep);
  const commandDisplay = normalizedSteps
    .map((step) => step.display || `git ${step.args.join(" ")}`)
    .filter(Boolean)
    .join(" && ");

  return {
    ok,
    action: "publish",
    repository,
    visibility: request ? request.visibility : null,
    command: {
      action: "publish",
      display: commandDisplay,
      args: []
    },
    steps: normalizedSteps,
    stdout: normalizedSteps.map((step) => step.stdout).filter(Boolean).join("\n"),
    stderr: normalizedSteps.map((step) => step.stderr).filter(Boolean).join("\n"),
    exitCode: normalizedSteps.length > 0 && Number.isInteger(normalizedSteps[normalizedSteps.length - 1].exitCode)
      ? normalizedSteps[normalizedSteps.length - 1].exitCode
      : null,
    message,
    error: ok ? null : error || {
      kind: "publish-error",
      message
    }
  };
}

function createInvalidResult(message, kind = "invalid-request") {
  return {
    ok: false,
    action: "publish",
    repository: null,
    visibility: null,
    command: null,
    steps: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    message,
    error: {
      kind,
      message
    }
  };
}

function statusCommand(repositoryPath) {
  return {
    action: "status",
    repositoryPath,
    options: { porcelain: true, branch: true }
  };
}

function initCommand(repositoryPath) {
  return {
    action: "init",
    repositoryPath,
    options: {}
  };
}

function remoteListCommand(repositoryPath) {
  return {
    action: "remote",
    repositoryPath,
    options: { mode: "list" }
  };
}

function remoteAddCommand(repositoryPath, url) {
  return {
    action: "remote",
    repositoryPath,
    options: {
      mode: "add",
      name: "origin",
      url
    }
  };
}

function pushCommand(repositoryPath, branch) {
  return {
    action: "push",
    repositoryPath,
    options: {
      remote: "origin",
      branch,
      setUpstream: true
    }
  };
}

function normalizeStep(step) {
  const options = step && step.options ? step.options : {};
  return {
    ok: Boolean(step && step.ok),
    action: step && step.action ? step.action : null,
    args: Array.isArray(step && step.args) ? step.args : [],
    display: commandDisplay(step),
    stdout: step && step.stdout ? step.stdout : "",
    stderr: step && step.stderr ? step.stderr : "",
    exitCode: Number.isInteger(step && step.exitCode) ? step.exitCode : null,
    error: step && step.error ? step.error : null,
    options
  };
}

function commandDisplay(command) {
  if (!command) return "";
  const options = command.options || {};
  if (Array.isArray(command.args) && command.args.length > 0) return `git ${command.args.join(" ")}`;
  if (command.action === "status") return "git status --porcelain=v1 --branch";
  if (command.action === "init") return "git init";
  if (command.action === "remote" && options.mode === "list") return "git remote -v";
  if (command.action === "remote" && options.mode === "add") return `git remote add ${options.name || ""} ${options.url || ""}`.trim();
  if (command.action === "push") {
    return `git push --set-upstream ${options.remote || ""} ${options.branch || ""}`.trim();
  }
  return `git ${command.action || ""}`.trim();
}

function parseStatusBranch(stdout) {
  const firstLine = String(stdout || "").split(/\r?\n/).find((line) => line.startsWith("## ")) || "";
  if (!firstLine) return { branch: "", detached: false, noCommits: false };

  const content = firstLine.slice(3);
  const noCommitsMatch = content.match(/^No commits yet on (.+)$/i);
  if (noCommitsMatch) {
    return {
      branch: noCommitsMatch[1].trim(),
      detached: false,
      noCommits: true
    };
  }

  if (/^HEAD \(no branch\)|^HEAD detached/i.test(content)) {
    return {
      branch: "HEAD",
      detached: true,
      noCommits: false
    };
  }

  const branch = content.split(/[.]{3}/)[0].trim();
  return {
    branch,
    detached: false,
    noCommits: false
  };
}

function parseRemotes(stdout) {
  const names = new Set();
  String(stdout || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^\s]+)\s+/);
    if (match) names.add(match[1]);
  });
  return [...names];
}

function isNotGitRepository(result) {
  const raw = `${result && result.stdout || ""}\n${result && result.stderr || ""}`.toLowerCase();
  return raw.includes("not a git repository") || raw.includes("not a git repo");
}

function publishFailureMessage(result, fallback) {
  const raw = `${result && result.stdout || ""}\n${result && result.stderr || ""}`.toLowerCase();
  if (raw.includes("authentication failed") || raw.includes("permission denied")) {
    return "Git authentication or permission failed while publishing.";
  }
  if (raw.includes("non-fast-forward") || raw.includes("fetch first")) {
    return "Git rejected the initial push because the remote already contains work.";
  }
  if (result && result.error && result.error.message) return result.error.message;
  return fallback;
}

function isValidRepositoryName(value) {
  return /^[A-Za-z0-9._-]+$/.test(clean(value));
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildPublishActionRequest,
  runPublishAction
};
