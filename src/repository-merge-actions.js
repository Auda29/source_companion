"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

async function runMergeAction({
  repositoryPath,
  git,
  target,
  execute = runGitCommand
} = {}) {
  const request = buildMergeActionRequest({
    repositoryPath,
    git,
    target
  });

  if (!request.ok) return request;

  const result = await execute(request.command);
  return {
    ok: Boolean(result.ok),
    action: "merge",
    branch: request.branch,
    command: {
      action: request.command.action,
      args: Array.isArray(result.args) ? result.args : [],
      display: commandDisplay(request.command)
    },
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message: result.ok ? request.successMessage : mergeFailureMessage(result, request.failureMessage),
    error: result.ok ? null : result.error || {
      kind: "git-error",
      message: request.failureMessage
    }
  };
}

function buildMergeActionRequest({ repositoryPath, git, target } = {}) {
  const normalizedPath = clean(repositoryPath);
  const currentBranch = currentBranchName(git);
  const targetBranch = clean(target);

  if (!normalizedPath) {
    return createInvalidResult("No repository path is available.");
  }

  if (!currentBranch) {
    return createInvalidResult("Check out a local branch before merging.");
  }

  if (!targetBranch) {
    return createInvalidResult("Choose a branch to merge into the current branch.");
  }

  if (targetBranch === currentBranch) {
    return createInvalidResult("Choose a different branch to merge.");
  }

  if (hasConflicts(git)) {
    return createInvalidResult("Resolve existing conflicts before starting another merge.");
  }

  if (hasUncommittedChanges(git)) {
    return createInvalidResult("Commit, stash, or discard local changes before merging.");
  }

  return {
    ok: true,
    action: "merge",
    branch: targetBranch,
    command: {
      action: "merge",
      repositoryPath: normalizedPath,
      options: { target: targetBranch }
    },
    successMessage: `${targetBranch} was merged into ${currentBranch}.`,
    failureMessage: `Could not merge ${targetBranch} into ${currentBranch}.`
  };
}

function createInvalidResult(message) {
  return {
    ok: false,
    action: "merge",
    branch: null,
    command: null,
    stdout: "",
    stderr: "",
    exitCode: null,
    message,
    error: {
      kind: "invalid-request",
      message
    }
  };
}

function mergeFailureMessage(result, fallback) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("conflict") || result.error && result.error.kind === "conflict") {
    return "Git reported merge conflicts. Resolve conflicts before continuing.";
  }
  if (raw.includes("local changes") && raw.includes("would be overwritten")) {
    return "Commit, stash, or discard local changes before merging.";
  }
  if (raw.includes("not something we can merge") || raw.includes("not a commit")) {
    return "Git could not find that branch to merge.";
  }
  if (result.error && result.error.message) return result.error.message;
  return fallback;
}

function commandDisplay(command) {
  const target = command && command.options ? command.options.target : "";
  return `git merge --no-edit ${target || ""}`.trim();
}

function hasConflicts(git) {
  return count(git && git.conflicted) > 0;
}

function hasUncommittedChanges(git) {
  return count(git && git.staged) > 0 ||
    count(git && git.unstaged) > 0 ||
    count(git && git.untracked) > 0;
}

function currentBranchName(git) {
  const branch = git && git.branch ? git.branch : null;
  if (!branch || branch.detached) return "";
  return clean(branch.name);
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildMergeActionRequest,
  runMergeAction
};
