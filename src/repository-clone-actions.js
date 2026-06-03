"use strict";

const path = require("node:path");

const { runGitCommand } = require("./git-cli-wrapper");

async function runCloneAction({
  url,
  targetPath,
  execute = runGitCommand
} = {}) {
  const request = buildCloneActionRequest({ url, targetPath });
  if (!request.ok) return request;

  const result = await execute(request.commandRequest);
  if (!result.ok) {
    return createCloneResult({
      ok: false,
      command: request.command,
      result,
      message: cloneFailureMessage(result)
    });
  }

  return createCloneResult({
    ok: true,
    command: request.command,
    result,
    message: `${request.repoName} was cloned.`
  });
}

function buildCloneActionRequest({ url, targetPath } = {}) {
  const normalizedUrl = clean(url);
  const normalizedTargetPath = clean(targetPath);

  if (!normalizedUrl) {
    return createInvalidResult("Enter a Git repository URL.");
  }

  if (!isCloneUrl(normalizedUrl)) {
    return createInvalidResult("Enter an HTTPS, SSH, or GitHub clone URL.");
  }

  if (!normalizedTargetPath) {
    return createInvalidResult("Enter an absolute target folder.");
  }

  if (!path.isAbsolute(normalizedTargetPath)) {
    return createInvalidResult("Target folder must be an absolute path.");
  }

  const repoName = repoNameFromUrl(normalizedUrl);
  return {
    ok: true,
    action: "clone",
    url: normalizedUrl,
    targetPath: normalizedTargetPath,
    repoName,
    command: {
      action: "clone",
      display: `git clone ${normalizedUrl} ${normalizedTargetPath}`,
      args: ["clone", normalizedUrl, normalizedTargetPath]
    },
    commandRequest: {
      action: "clone",
      repositoryPath: normalizedTargetPath,
      options: {
        url: normalizedUrl,
        targetPath: normalizedTargetPath
      }
    }
  };
}

function createCloneResult({ ok, command, result, message }) {
  return {
    ok,
    action: "clone",
    command,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    message,
    error: ok ? null : result.error || {
      kind: "git-error",
      message
    }
  };
}

function cloneFailureMessage(result) {
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`.toLowerCase();
  if (raw.includes("permission denied") || raw.includes("publickey")) {
    return "SSH clone failed. Check the local Git/SSH setup for this machine.";
  }
  if (raw.includes("authentication failed") || raw.includes("could not read username")) {
    return "Git authentication failed for this clone URL.";
  }
  if (raw.includes("already exists") && raw.includes("not an empty directory")) {
    return "Target folder already exists and is not empty.";
  }
  if (result.error && result.error.message) return result.error.message;
  return "Clone failed. Inspect Git Output for details.";
}

function createInvalidResult(message) {
  return {
    ok: false,
    action: "clone",
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

function isCloneUrl(url) {
  return /^https:\/\/[^\s]+$/i.test(url) ||
    /^git@[A-Za-z0-9_.-]+:[^\s]+$/i.test(url) ||
    /^ssh:\/\/[^\s]+$/i.test(url);
}

function repoNameFromUrl(url) {
  const withoutQuery = clean(url).split(/[?#]/)[0];
  const withoutGitSuffix = withoutQuery.replace(/\.git$/i, "");
  return withoutGitSuffix.split(/[/:\\]/).filter(Boolean).pop() || "repository";
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  buildCloneActionRequest,
  runCloneAction
};
