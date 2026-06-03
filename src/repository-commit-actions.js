"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

const COMMIT_ACTIONS = Object.freeze(["commit", "commit-staged", "amend"]);

async function runCommitAction({
  repositoryPath,
  git,
  message,
  action = "commit",
  execute = runGitCommand
} = {}) {
  const normalizedAction = clean(action) || "commit";
  const normalizedMessage = clean(message);
  const stagedCount = countStaged(git);

  const request = buildCommitActionRequest({
    repositoryPath,
    git,
    message: normalizedMessage,
    action: normalizedAction
  });

  if (!request.ok) return request;

  const result = await execute(request.command);
  return {
    ok: Boolean(result.ok),
    action: normalizedAction,
    label: request.label,
    path: null,
    stagedCount,
    command: {
      action: request.command.action,
      args: Array.isArray(result.args) ? result.args : []
    },
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message: result.ok ? request.successMessage : commitFailureMessage(result, request.failureMessage),
    error: result.ok ? null : result.error || {
      kind: "git-error",
      message: request.failureMessage
    }
  };
}

function buildCommitActionRequest({ repositoryPath, git, message, action }) {
  const normalizedAction = clean(action) || "commit";
  const normalizedMessage = clean(message);
  const stagedCount = countStaged(git);

  if (!clean(repositoryPath)) {
    return createInvalidResult(normalizedAction, "No repository path is available.");
  }

  if (!COMMIT_ACTIONS.includes(normalizedAction)) {
    return createInvalidResult(normalizedAction, `Unsupported commit action '${normalizedAction}'.`);
  }

  if (!normalizedMessage) {
    return createInvalidResult(normalizedAction, "Enter a commit message before committing.");
  }

  if (normalizedAction !== "amend" && stagedCount === 0) {
    return createInvalidResult(normalizedAction, "Stage at least one change before committing.");
  }

  const amend = normalizedAction === "amend";
  const label = amend ? "Amend commit" : normalizedAction === "commit-staged" ? "Commit staged changes" : "Commit";
  return {
    ok: true,
    action: normalizedAction,
    label,
    successMessage: amend ? "Commit was amended." : "Commit was created.",
    failureMessage: amend ? "Could not amend commit." : "Could not create commit.",
    command: {
      action: "commit",
      repositoryPath: clean(repositoryPath),
      options: {
        message: normalizedMessage,
        amend
      }
    }
  };
}

function commitFailureMessage(result, fallback) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("nothing to commit")) {
    return "Git found no staged changes to commit.";
  }
  if (raw.includes("please tell me who you are") || raw.includes("unable to auto-detect email address")) {
    return "Git needs user.name and user.email before committing.";
  }
  if (raw.includes("you have unmerged files") || raw.includes("unmerged")) {
    return "Resolve merge conflicts before committing.";
  }
  if (raw.includes("would make it empty")) {
    return "Git would create an empty commit. Stage a real change or amend with a changed message.";
  }
  if (result.error && result.error.message) return result.error.message;
  return fallback;
}

function countStaged(git) {
  const source = git || {};
  if (Array.isArray(source.staged)) return source.staged.length;
  if (Array.isArray(source.files)) return source.files.filter((file) => file && file.staged).length;
  return 0;
}

function createInvalidResult(action, message) {
  return {
    ok: false,
    action,
    path: null,
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

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildCommitActionRequest,
  runCommitAction
};
