"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

async function runHunkAction({
  repositoryPath,
  file,
  bucketId,
  action,
  diff,
  hunkIndex,
  execute = runGitCommand
} = {}) {
  const normalizedFile = normalizeFile(file);
  const normalizedAction = clean(action);
  const normalizedBucket = clean(bucketId);
  const selectedHunkIndex = Number(hunkIndex);

  if (!clean(repositoryPath)) {
    return createInvalidResult(normalizedAction, normalizedFile, "No repository path is available.");
  }

  if (!normalizedFile.path) {
    return createInvalidResult(normalizedAction, normalizedFile, "No file path is available for this change.");
  }

  if (normalizedFile.conflicted || normalizedBucket === "conflicted") {
    return createInvalidResult(normalizedAction, normalizedFile, "Resolve conflicts before staging or unstaging hunks.");
  }

  if (!Number.isInteger(selectedHunkIndex) || selectedHunkIndex < 0) {
    return createInvalidResult(normalizedAction, normalizedFile, "Select a valid hunk before running this action.");
  }

  if (normalizedAction === "stage-hunk" && normalizedBucket !== "unstaged") {
    return createInvalidResult(normalizedAction, normalizedFile, "Only unstaged hunks can be staged.");
  }

  if (normalizedAction === "unstage-hunk" && normalizedBucket !== "staged") {
    return createInvalidResult(normalizedAction, normalizedFile, "Only staged hunks can be unstaged.");
  }

  if (!["stage-hunk", "unstage-hunk"].includes(normalizedAction)) {
    return createInvalidResult(normalizedAction, normalizedFile, `Unsupported hunk action '${normalizedAction}'.`);
  }

  const patch = buildHunkPatch(diff, selectedHunkIndex);
  if (!patch.ok) {
    return createInvalidResult(normalizedAction, normalizedFile, patch.message);
  }

  const reverse = normalizedAction === "unstage-hunk";
  const checkCommand = createApplyCommand(repositoryPath, reverse, true, patch.patch);
  const checkResult = await execute(checkCommand);
  if (!checkResult.ok) {
    return createGitResult({
      action: normalizedAction,
      file: normalizedFile,
      hunkIndex: selectedHunkIndex,
      result: checkResult,
      message: hunkFailureMessage(checkResult, "Hunk cannot be applied. Refresh the diff and try again.")
    });
  }

  const applyCommand = createApplyCommand(repositoryPath, reverse, false, patch.patch);
  const applyResult = await execute(applyCommand);
  return createGitResult({
    action: normalizedAction,
    file: normalizedFile,
    hunkIndex: selectedHunkIndex,
    result: applyResult,
    message: applyResult.ok
      ? hunkSuccessMessage(normalizedAction, normalizedFile.path, selectedHunkIndex)
      : hunkFailureMessage(applyResult, "Hunk apply failed after validation. Refresh the diff and try again.")
  });
}

function buildHunkPatch(diff, hunkIndex) {
  const hunks = parseUnifiedDiffHunks(diff);
  const hunk = hunks[hunkIndex];

  if (!hunk) {
    return {
      ok: false,
      message: "The selected hunk is no longer available. Refresh the diff and try again."
    };
  }

  if (hunk.fileHeader.length === 0) {
    return {
      ok: false,
      message: "The selected diff does not include a Git file header."
    };
  }

  return {
    ok: true,
    patch: `${[...hunk.fileHeader, ...hunk.lines].join("\n")}\n`
  };
}

function parseUnifiedDiffHunks(diff) {
  const lines = String(diff || "").replace(/\r\n/g, "\n").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const hunks = [];
  let fileHeader = [];
  let current = null;

  lines.forEach((line) => {
    if (line.startsWith("diff --git ")) {
      if (current) {
        hunks.push(current);
        current = null;
      }
      fileHeader = [line];
      return;
    }

    if (line.startsWith("@@")) {
      if (current) hunks.push(current);
      current = {
        index: hunks.length,
        header: line,
        fileHeader: fileHeader.slice(),
        lines: [line]
      };
      return;
    }

    if (current) {
      current.lines.push(line);
      return;
    }

    if (fileHeader.length > 0) {
      fileHeader.push(line);
    }
  });

  if (current) hunks.push(current);
  return hunks;
}

function createApplyCommand(repositoryPath, reverse, check, patch) {
  return {
    action: "apply",
    repositoryPath,
    options: {
      cached: true,
      reverse,
      check,
      whitespaceError: true
    },
    input: patch
  };
}

function createGitResult({ action, file, hunkIndex, result, message }) {
  return {
    ok: Boolean(result.ok),
    action,
    path: file.path,
    hunkIndex,
    command: {
      action: "apply",
      args: Array.isArray(result.args) ? result.args : []
    },
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message,
    error: result.ok ? null : result.error || {
      kind: "git-error",
      message
    }
  };
}

function hunkSuccessMessage(action, filePath, hunkIndex) {
  const label = action === "unstage-hunk" ? "unstaged" : "staged";
  return `Hunk ${hunkIndex + 1} in ${filePath} was ${label}.`;
}

function hunkFailureMessage(result, fallback) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("whitespace")) {
    return "Git rejected this hunk because it has whitespace errors.";
  }
  if (raw.includes("patch does not apply") || raw.includes("does not apply")) {
    return "This hunk no longer applies. Refresh the diff and try again.";
  }
  if (result.error && result.error.message) return result.error.message;
  return fallback;
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

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildHunkPatch,
  parseUnifiedDiffHunks,
  runHunkAction
};
