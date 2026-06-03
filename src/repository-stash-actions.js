"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

const STASH_ACTIONS = Object.freeze(["list", "push", "apply", "drop"]);

async function runStashAction({
  repositoryPath,
  action = "list",
  message,
  ref,
  includeUntracked = false,
  execute = runGitCommand
} = {}) {
  const normalizedAction = clean(action) || "list";
  const request = buildStashActionRequest({
    repositoryPath,
    action: normalizedAction,
    message,
    ref,
    includeUntracked
  });

  if (!request.ok) return request;

  const result = await execute(request.command);
  const ok = Boolean(result.ok);
  const stashes = normalizedAction === "list" && ok ? parseStashList(result.stdout) : [];

  return {
    ok,
    action: normalizedAction,
    ref: request.ref,
    stashes,
    command: {
      action: request.command.action,
      args: Array.isArray(result.args) ? result.args : [],
      display: commandDisplay(request.command)
    },
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message: ok ? request.successMessage(result, stashes) : stashFailureMessage(result, request.failureMessage),
    error: ok ? null : result.error || {
      kind: "git-error",
      message: request.failureMessage
    }
  };
}

function buildStashActionRequest({
  repositoryPath,
  action,
  message,
  ref,
  includeUntracked = false
} = {}) {
  const normalizedPath = clean(repositoryPath);
  const normalizedAction = clean(action) || "list";
  const normalizedRef = clean(ref);
  const normalizedMessage = clean(message);

  if (!normalizedPath) {
    return createInvalidResult(normalizedAction, "No repository path is available.");
  }

  if (!STASH_ACTIONS.includes(normalizedAction)) {
    return createInvalidResult(normalizedAction, `Unsupported stash action '${normalizedAction}'.`);
  }

  if (normalizedAction === "list") {
    return createRequest({
      action: normalizedAction,
      label: "List stashes",
      ref: null,
      command: {
        action: "stash",
        repositoryPath: normalizedPath,
        options: { mode: "list" }
      },
      successMessage: (result, stashes) => `${stashes.length} stash${stashes.length === 1 ? "" : "es"} found.`,
      failureMessage: "Could not list stashes."
    });
  }

  if (normalizedAction === "push") {
    return createRequest({
      action: normalizedAction,
      label: "Stash changes",
      ref: null,
      command: {
        action: "stash",
        repositoryPath: normalizedPath,
        options: {
          mode: "push",
          message: normalizedMessage || undefined,
          includeUntracked: Boolean(includeUntracked)
        }
      },
      successMessage: (result) => stashPushSuccessMessage(result),
      failureMessage: "Could not stash changes."
    });
  }

  if (!normalizedRef) {
    return createInvalidResult(normalizedAction, "Choose a stash entry first.");
  }

  if (normalizedAction === "apply") {
    return createRequest({
      action: normalizedAction,
      label: "Apply stash",
      ref: normalizedRef,
      command: {
        action: "stash",
        repositoryPath: normalizedPath,
        options: { mode: "apply", ref: normalizedRef }
      },
      successMessage: () => `${normalizedRef} was applied.`,
      failureMessage: `Could not apply ${normalizedRef}.`
    });
  }

  if (normalizedAction === "drop") {
    return createRequest({
      action: normalizedAction,
      label: "Delete stash",
      ref: normalizedRef,
      command: {
        action: "stash",
        repositoryPath: normalizedPath,
        options: { mode: "drop", ref: normalizedRef }
      },
      successMessage: () => `${normalizedRef} was deleted.`,
      failureMessage: `Could not delete ${normalizedRef}.`
    });
  }

  return createInvalidResult(normalizedAction, `Unsupported stash action '${normalizedAction}'.`);
}

function parseStashList(output) {
  return String(output || "").split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(stash@\{\d+\}):\s*(.*)$/);
      const ref = match ? match[1] : "";
      const summary = match ? match[2] : line;
      const branchMatch = summary.match(/^On\s+([^:]+):\s*(.*)$/);
      return {
        ref,
        summary,
        branch: branchMatch ? branchMatch[1] : null,
        message: branchMatch ? branchMatch[2] : summary
      };
    });
}

function createRequest({ action, label, ref, command, successMessage, failureMessage }) {
  return {
    ok: true,
    action,
    label,
    ref,
    command,
    successMessage,
    failureMessage
  };
}

function createInvalidResult(action, message) {
  return {
    ok: false,
    action,
    ref: null,
    stashes: [],
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

function stashPushSuccessMessage(result) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("no local changes to save")) return "No local changes were available to stash.";
  return "Changes were stashed.";
}

function stashFailureMessage(result, fallback) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("conflict") || result.error && result.error.kind === "conflict") {
    return "Git reported a conflict while applying the stash.";
  }
  if (raw.includes("not a valid reference") || raw.includes("unknown revision")) {
    return "Git could not find that stash entry.";
  }
  if (raw.includes("local changes") && raw.includes("would be overwritten")) {
    return "Commit, stash, or discard local changes before applying this stash.";
  }
  if (result.error && result.error.message) return result.error.message;
  return fallback;
}

function commandDisplay(command) {
  const options = command.options || {};
  if (command.action !== "stash") return `git ${command.action}`;
  if (options.mode === "list") return "git stash list";
  if (options.mode === "push") {
    const parts = ["git stash push"];
    if (options.includeUntracked) parts.push("--include-untracked");
    if (options.message) parts.push(`--message "${options.message}"`);
    return parts.join(" ");
  }
  if (options.mode === "apply") return `git stash apply ${options.ref || ""}`.trim();
  if (options.mode === "drop") return `git stash drop ${options.ref || ""}`.trim();
  return "git stash";
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  STASH_ACTIONS,
  buildStashActionRequest,
  parseStashList,
  runStashAction
};
