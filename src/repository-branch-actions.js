"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

const BRANCH_ACTIONS = Object.freeze(["create", "switch", "delete", "checkout-remote"]);

async function runBranchAction({
  repositoryPath,
  git,
  action,
  name,
  startPoint,
  remoteBranch,
  localName,
  execute = runGitCommand
} = {}) {
  const normalizedAction = clean(action);
  const request = buildBranchActionRequest({
    repositoryPath,
    git,
    action: normalizedAction,
    name,
    startPoint,
    remoteBranch,
    localName
  });

  if (!request.ok) return request;

  const result = await execute(request.command);
  return {
    ok: Boolean(result.ok),
    action: normalizedAction,
    label: request.label,
    branch: request.branch,
    command: {
      action: request.command.action,
      args: Array.isArray(result.args) ? result.args : []
    },
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message: result.ok ? request.successMessage : branchFailureMessage(result, request.failureMessage),
    error: result.ok ? null : result.error || {
      kind: "git-error",
      message: request.failureMessage
    }
  };
}

function buildBranchActionRequest({
  repositoryPath,
  git,
  action,
  name,
  startPoint,
  remoteBranch,
  localName
}) {
  const normalizedPath = clean(repositoryPath);
  const normalizedAction = clean(action);
  const branchName = clean(name);
  const normalizedStartPoint = clean(startPoint);
  const normalizedRemoteBranch = normalizeRemoteBranch(remoteBranch);
  const normalizedLocalName = clean(localName);

  if (!normalizedPath) {
    return createInvalidResult(normalizedAction, "No repository path is available.");
  }

  if (!BRANCH_ACTIONS.includes(normalizedAction)) {
    return createInvalidResult(normalizedAction, `Unsupported branch action '${normalizedAction}'.`);
  }

  if (normalizedAction === "create") {
    if (!branchName) return createInvalidResult(normalizedAction, "Enter a branch name to create.");

    return createRequest({
      action: normalizedAction,
      label: "Create branch",
      branch: branchName,
      successMessage: `${branchName} was created.`,
      failureMessage: `Could not create ${branchName}.`,
      command: {
        action: "branch",
        repositoryPath: normalizedPath,
        options: {
          mode: "create",
          name: branchName,
          startPoint: normalizedStartPoint || undefined
        }
      }
    });
  }

  if (normalizedAction === "switch") {
    if (!branchName) return createInvalidResult(normalizedAction, "Choose a branch to switch to.");

    return createRequest({
      action: normalizedAction,
      label: "Switch branch",
      branch: branchName,
      successMessage: `Switched to ${branchName}.`,
      failureMessage: `Could not switch to ${branchName}.`,
      command: {
        action: "switch",
        repositoryPath: normalizedPath,
        options: { branch: branchName }
      }
    });
  }

  if (normalizedAction === "delete") {
    if (!branchName) return createInvalidResult(normalizedAction, "Choose a local branch to delete.");
    if (isCurrentBranch(git, branchName)) {
      return createInvalidResult(normalizedAction, "Switch to another branch before deleting the current branch.");
    }

    return createRequest({
      action: normalizedAction,
      label: "Delete branch",
      branch: branchName,
      successMessage: `${branchName} was deleted.`,
      failureMessage: `Could not delete ${branchName}.`,
      command: {
        action: "branch",
        repositoryPath: normalizedPath,
        options: {
          mode: "delete",
          name: branchName,
          force: false
        }
      }
    });
  }

  if (normalizedAction === "checkout-remote") {
    if (!normalizedRemoteBranch) {
      return createInvalidResult(normalizedAction, "Enter a remote branch such as origin/feature.");
    }

    const targetBranch = normalizedLocalName || normalizedRemoteBranch;
    const options = normalizedLocalName ? {
      branch: normalizedLocalName,
      create: true,
      track: true,
      startPoint: normalizedRemoteBranch
    } : {
      branch: normalizedRemoteBranch,
      track: true
    };

    return createRequest({
      action: normalizedAction,
      label: "Check out remote branch",
      branch: targetBranch,
      successMessage: `${targetBranch} was checked out from ${normalizedRemoteBranch}.`,
      failureMessage: `Could not check out ${normalizedRemoteBranch}.`,
      command: {
        action: "switch",
        repositoryPath: normalizedPath,
        options
      }
    });
  }

  return createInvalidResult(normalizedAction, `Unsupported branch action '${normalizedAction}'.`);
}

function normalizeRemoteBranch(value) {
  const branch = clean(value).replace(/^remotes\//, "");
  if (!branch || branch.endsWith("/HEAD") || !branch.includes("/")) return "";
  return branch;
}

function isCurrentBranch(git, name) {
  const branch = git && git.branch ? git.branch : null;
  return Boolean(branch && !branch.detached && clean(branch.name) === name);
}

function createRequest({ action, label, branch, successMessage, failureMessage, command }) {
  return {
    ok: true,
    action,
    label,
    branch,
    command,
    successMessage,
    failureMessage
  };
}

function createInvalidResult(action, message) {
  return {
    ok: false,
    action,
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

function branchFailureMessage(result, fallback) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("not fully merged")) {
    return "Git refused to delete this branch because it is not fully merged.";
  }
  if (raw.includes("cannot delete branch") && raw.includes("checked out")) {
    return "Switch to another branch before deleting this branch.";
  }
  if (raw.includes("already exists")) {
    return "A branch with that name already exists.";
  }
  if (raw.includes("your local changes") && raw.includes("would be overwritten")) {
    return "Commit, stash, or discard local changes before switching branches.";
  }
  if (raw.includes("invalid reference") || raw.includes("not a commit")) {
    return "Git could not find that branch.";
  }
  if (result.error && result.error.message) return result.error.message;
  return fallback;
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildBranchActionRequest,
  runBranchAction
};
