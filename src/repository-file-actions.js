"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

async function runFileAction({
  repositoryPath,
  file,
  bucketId,
  action,
  execute = runGitCommand
} = {}) {
  const normalizedFile = normalizeFile(file);
  const normalizedAction = clean(action);
  const normalizedBucket = clean(bucketId);

  if (!clean(repositoryPath)) {
    return createInvalidResult(normalizedAction, normalizedFile, "No repository path is available.");
  }

  if (!normalizedFile.path) {
    return createInvalidResult(normalizedAction, normalizedFile, "No file path is available for this change.");
  }

  if (normalizedFile.conflicted || normalizedBucket === "conflicted") {
    return createInvalidResult(normalizedAction, normalizedFile, "Resolve conflicts before staging, unstaging, or discarding this file.");
  }

  const request = buildFileActionRequest({
    action: normalizedAction,
    bucketId: normalizedBucket,
    file: normalizedFile,
    repositoryPath
  });

  if (!request.ok) {
    return request;
  }

  const result = await execute(request.command);
  return {
    ok: Boolean(result.ok),
    action: normalizedAction,
    label: request.label,
    path: normalizedFile.path,
    bucketId: normalizedBucket,
    command: {
      action: request.command.action,
      args: Array.isArray(result.args) ? result.args : []
    },
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message: result.ok ? request.successMessage : gitFailureMessage(result, request.failureMessage),
    error: result.ok ? null : result.error || {
      kind: "git-error",
      message: request.failureMessage
    }
  };
}

function buildFileActionRequest({ action, bucketId, file, repositoryPath }) {
  if (action === "stage") {
    if (!["unstaged", "untracked"].includes(bucketId) && !file.unstaged && !file.untracked) {
      return createInvalidResult(action, file, "This file is not in a state that can be staged.");
    }

    return createRequest({
      action,
      file,
      label: "Stage file",
      successMessage: `${file.path} was staged.`,
      failureMessage: `Could not stage ${file.path}.`,
      command: {
        action: "add",
        repositoryPath,
        options: { pathspecs: [file.path] }
      }
    });
  }

  if (action === "unstage") {
    if (bucketId !== "staged" && !file.staged) {
      return createInvalidResult(action, file, "This file is not staged.");
    }

    if (isAddedFile(file)) {
      return createRequest({
        action,
        file,
        label: "Unstage file",
        successMessage: `${file.path} was unstaged.`,
        failureMessage: `Could not unstage ${file.path}.`,
        command: {
          action: "rm",
          repositoryPath,
          options: { cached: true, pathspecs: [file.path] }
        }
      });
    }

    return createRequest({
      action,
      file,
      label: "Unstage file",
      successMessage: `${file.path} was unstaged.`,
      failureMessage: `Could not unstage ${file.path}.`,
      command: {
        action: "restore",
        repositoryPath,
        options: { staged: true, worktree: false, pathspecs: [file.path] }
      }
    });
  }

  if (action === "discard") {
    if (bucketId === "untracked" || (!bucketId && file.untracked)) {
      return createRequest({
        action,
        file,
        label: "Discard untracked file",
        successMessage: `${file.path} was removed.`,
        failureMessage: `Could not remove ${file.path}.`,
        command: {
          action: "clean",
          repositoryPath,
          options: { pathspecs: [file.path] }
        }
      });
    }

    if (bucketId === "unstaged" || (!bucketId && file.unstaged && !file.staged)) {
      return createRequest({
        action,
        file,
        label: "Discard file",
        successMessage: `${file.path} was discarded.`,
        failureMessage: `Could not discard ${file.path}.`,
        command: {
          action: "restore",
          repositoryPath,
          options: { worktree: true, pathspecs: [file.path] }
        }
      });
    }

    if (bucketId === "staged" || (!bucketId && file.staged)) {
      if (isAddedFile(file)) {
        return createRequest({
          action,
          file,
          label: "Discard staged file",
          successMessage: `${file.path} was discarded.`,
          failureMessage: `Could not discard ${file.path}.`,
          command: {
            action: "rm",
            repositoryPath,
            options: { force: true, pathspecs: [file.path] }
          }
        });
      }

      return createRequest({
        action,
        file,
        label: "Discard staged file",
        successMessage: `${file.path} was discarded.`,
        failureMessage: `Could not discard ${file.path}.`,
        command: {
          action: "restore",
          repositoryPath,
          options: { staged: true, worktree: true, pathspecs: [file.path] }
        }
      });
    }
  }

  return createInvalidResult(action, file, `Unsupported file action '${action}'.`);
}

function normalizeFile(file) {
  const source = file || {};
  return {
    path: clean(source.path),
    oldPath: clean(source.oldPath) || null,
    status: clean(source.status),
    type: clean(source.type) || "changed",
    staged: Boolean(source.staged),
    unstaged: Boolean(source.unstaged),
    untracked: Boolean(source.untracked),
    conflicted: Boolean(source.conflicted)
  };
}

function isAddedFile(file) {
  return file.type === "added" || clean(file.status).includes("A");
}

function createRequest({ action, file, label, successMessage, failureMessage, command }) {
  return {
    ok: true,
    action,
    label,
    path: file.path,
    command,
    successMessage,
    failureMessage
  };
}

function createInvalidResult(action, file, message) {
  return {
    ok: false,
    action,
    path: file.path,
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

function gitFailureMessage(result, fallback) {
  if (result.error && result.error.message) return result.error.message;
  return fallback;
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildFileActionRequest,
  runFileAction
};
