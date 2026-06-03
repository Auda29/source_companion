"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

async function loadFileDiff({
  repositoryPath,
  file,
  bucketId,
  execute = runGitCommand
} = {}) {
  const normalizedFile = normalizeFile(file);
  const mode = bucketId === "staged" ? "staged" : "unstaged";

  if (!clean(repositoryPath)) {
    return createErrorDiff(normalizedFile, mode, "No repository path is available.");
  }

  if (!normalizedFile.path) {
    return createErrorDiff(normalizedFile, mode, "No file path is available for this change.");
  }

  if (bucketId === "conflicted" || normalizedFile.conflicted) {
    return createReplacementDiff({
      file: normalizedFile,
      mode,
      status: "conflict",
      message: "This file is in a conflict state. Resolve it outside this read-only diff view."
    });
  }

  if (bucketId === "untracked" || normalizedFile.untracked) {
    return createReplacementDiff({
      file: normalizedFile,
      mode,
      status: "untracked",
      message: "Untracked files do not have a Git diff until they are staged."
    });
  }

  const result = await execute({
    action: "diff",
    repositoryPath,
    options: {
      staged: mode === "staged",
      pathspecs: [normalizedFile.path]
    }
  });

  if (!result.ok) {
    return {
      ...baseDiff(normalizedFile, mode),
      status: "error",
      message: result.error && result.error.message ? result.error.message : "Git diff failed.",
      error: result.error || null,
      raw: result.stderr || result.stdout || ""
    };
  }

  const diff = String(result.stdout || "");
  if (isBinaryDiff(diff)) {
    return {
      ...baseDiff(normalizedFile, mode),
      status: "binary",
      message: "Binary file changes cannot be shown as a unified text diff.",
      diff
    };
  }

  if (!diff.trim()) {
    return createReplacementDiff({
      file: normalizedFile,
      mode,
      status: "empty",
      message: "Git did not return a unified diff for this selected file."
    });
  }

  return {
    ...baseDiff(normalizedFile, mode),
    status: "ready",
    message: diffSummary(normalizedFile, mode),
    diff
  };
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

function baseDiff(file, mode) {
  return {
    path: file.path,
    oldPath: file.oldPath,
    fileType: file.type,
    mode,
    status: "ready",
    message: "",
    diff: ""
  };
}

function createReplacementDiff({ file, mode, status, message }) {
  return {
    ...baseDiff(file, mode),
    status,
    message,
    diff: ""
  };
}

function createErrorDiff(file, mode, message) {
  return {
    ...baseDiff(file, mode),
    status: "error",
    message,
    error: {
      kind: "invalid-request",
      message
    },
    raw: ""
  };
}

function isBinaryDiff(diff) {
  return /^Binary files .+ differ$/m.test(diff) || /^GIT binary patch$/m.test(diff);
}

function diffSummary(file, mode) {
  const prefix = mode === "staged" ? "Staged" : "Unstaged";
  if (file.type === "added") return `${prefix} new file diff.`;
  if (file.type === "deleted") return `${prefix} deleted file diff.`;
  if (file.type === "renamed") return `${prefix} renamed file diff.`;
  return `${prefix} unified diff.`;
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  loadFileDiff
};
