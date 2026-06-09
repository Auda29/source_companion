"use strict";

const { runGitCommand } = require("./git-cli-wrapper");

async function loadRepositoryHistory({
  repositoryPath,
  execute = runGitCommand,
  maxCount = 25
} = {}) {
  const normalizedPath = clean(repositoryPath);
  if (!normalizedPath) {
    return emptyHistory("No repository path is available.");
  }

  const logResult = await execute({
    action: "log",
    repositoryPath: normalizedPath,
    options: { maxCount }
  });

  if (!logResult.ok) {
    if (isNoCommitHistory(logResult)) {
      return emptyHistory("No commits are available yet.");
    }

    return {
      status: "error",
      message: "Commit history could not be loaded.",
      commits: [],
      head: null,
      selectedCommit: null,
      selectedDiff: "",
      error: normalizeGitError(logResult.error)
    };
  }

  const commits = parseCommitLog(logResult.stdout);
  if (commits.length === 0) {
    return emptyHistory("No commits are available yet.");
  }

  const selectedCommit = commits[0];
  const diffResult = await execute({
    action: "log",
    repositoryPath: normalizedPath,
    options: {
      maxCount: 1,
      ref: selectedCommit.hash,
      patch: true,
      format: "empty"
    }
  });

  return {
    status: "ready",
    message: `${commits.length} commit${commits.length === 1 ? "" : "s"} loaded.`,
    commits,
    head: selectedCommit,
    selectedCommit,
    selectedDiff: diffResult.ok ? cleanLeadingPatch(diffResult.stdout) : "",
    error: diffResult.ok ? null : normalizeGitError(diffResult.error)
  };
}

function parseCommitLog(output) {
  return String(output || "").split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const hash = clean(parts.shift());
      const author = clean(parts.shift());
      const authoredAt = clean(parts.shift());
      const subject = clean(parts.join("\t"));
      return {
        hash,
        shortHash: hash.slice(0, 7),
        author,
        authoredAt,
        subject
      };
    })
    .filter((commit) => commit.hash);
}

function emptyHistory(message) {
  return {
    status: "empty",
    message,
    commits: [],
    head: null,
    selectedCommit: null,
    selectedDiff: "",
    error: null
  };
}

function isNoCommitHistory(result) {
  const combined = `${result.stdout || ""}\n${result.stderr || ""}\n${result.error && result.error.raw ? JSON.stringify(result.error.raw) : ""}`.toLowerCase();
  return combined.includes("does not have any commits yet") ||
    combined.includes("your current branch") && combined.includes("does not have any commits") ||
    combined.includes("bad default revision");
}

function normalizeGitError(error) {
  if (!error) return null;
  return {
    kind: error.kind || "git-error",
    message: error.message || "Git command failed.",
    raw: error.raw || null
  };
}

function cleanLeadingPatch(value) {
  return String(value || "").replace(/^\s+/, "").trimEnd();
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  loadRepositoryHistory,
  parseCommitLog
};
