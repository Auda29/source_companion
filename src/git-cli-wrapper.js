"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const ALLOWED_GIT_ACTIONS = Object.freeze([
  "status",
  "diff",
  "apply",
  "add",
  "clean",
  "rm",
  "restore",
  "commit",
  "branch",
  "switch",
  "fetch",
  "pull",
  "push",
  "remote",
  "clone",
  "init",
  "log",
  "stash"
]);

const COMMAND_BUILDERS = Object.freeze({
  status: buildStatusArgs,
  diff: buildDiffArgs,
  apply: buildApplyArgs,
  add: buildAddArgs,
  clean: buildCleanArgs,
  rm: buildRmArgs,
  restore: buildRestoreArgs,
  commit: buildCommitArgs,
  branch: buildBranchArgs,
  switch: buildSwitchArgs,
  fetch: buildFetchArgs,
  pull: buildPullArgs,
  push: buildPushArgs,
  remote: buildRemoteArgs,
  clone: buildCloneArgs,
  init: buildInitArgs,
  log: buildLogArgs,
  stash: buildStashArgs
});

class GitWrapperError extends Error {
  constructor(kind, message, details = {}) {
    super(message);
    this.name = "GitWrapperError";
    this.kind = kind;
    this.details = details;
  }
}

function buildGitArgs(action, options = {}) {
  const builder = COMMAND_BUILDERS[action];
  if (!builder) {
    throw new GitWrapperError("unsupported-action", `Git action '${action}' is not whitelisted.`);
  }

  assertPlainObject(options, "options");
  return builder(options);
}

function runGitCommand({ action, repositoryPath, options = {}, input, signal } = {}) {
  let args;
  let cwd;
  let stdin;

  try {
    args = buildGitArgs(action, options);
    cwd = resolveWorkingDirectory(action, repositoryPath, options);
    stdin = normalizeCommandInput(input);
  } catch (error) {
    return Promise.resolve(createInvalidResult(action, error));
  }

  return new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd,
      shell: false,
      windowsHide: true,
      signal
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    if (child.stdin) {
      child.stdin.on("error", () => {});
      child.stdin.end(stdin);
    }

    child.on("error", (error) => {
      const result = {
        ok: false,
        action,
        args,
        stdout,
        stderr,
        exitCode: null,
        error: normalizeProcessError(error, stdout, stderr)
      };
      resolve(result);
    });

    child.on("close", (exitCode) => {
      const ok = exitCode === 0;
      const result = {
        ok,
        action,
        args,
        stdout,
        stderr,
        exitCode,
        error: ok ? null : normalizeGitFailure(exitCode, stdout, stderr)
      };
      resolve(result);
    });
  });
}

function resolveWorkingDirectory(action, repositoryPath, options) {
  if (action === "clone") {
    return options.cwd ? normalizeAbsolutePath(options.cwd, "cwd") : process.cwd();
  }

  return normalizeAbsolutePath(repositoryPath, "repositoryPath");
}

function createInvalidResult(action, error) {
  return {
    ok: false,
    action,
    args: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: {
      kind: error.kind || "invalid-request",
      message: error.message,
      raw: error.details || null
    }
  };
}

function buildStatusArgs(options) {
  assertKnownOptions(options, ["porcelain", "branch"]);
  return [
    "status",
    options.porcelain === false ? "--short" : "--porcelain=v1",
    options.branch === false ? null : "--branch"
  ].filter(Boolean);
}

function buildDiffArgs(options) {
  assertKnownOptions(options, ["staged", "pathspecs"]);
  return ["diff", options.staged ? "--staged" : null, ...pathspecArgs(options.pathspecs)].filter(Boolean);
}

function buildApplyArgs(options) {
  assertKnownOptions(options, ["cached", "reverse", "check", "whitespaceError"]);
  return [
    "apply",
    options.cached ? "--cached" : null,
    options.reverse ? "--reverse" : null,
    options.check ? "--check" : null,
    options.whitespaceError ? "--whitespace=error" : null
  ].filter(Boolean);
}

function buildAddArgs(options) {
  assertKnownOptions(options, ["pathspecs"]);
  return ["add", ...pathspecArgs(requireNonEmptyArray(options.pathspecs, "pathspecs"))];
}

function buildCleanArgs(options) {
  assertKnownOptions(options, ["pathspecs"]);
  return ["clean", "--force", ...pathspecArgs(requireNonEmptyArray(options.pathspecs, "pathspecs"))];
}

function buildRmArgs(options) {
  assertKnownOptions(options, ["cached", "force", "pathspecs"]);
  return [
    "rm",
    options.cached ? "--cached" : null,
    options.force ? "--force" : null,
    ...pathspecArgs(requireNonEmptyArray(options.pathspecs, "pathspecs"))
  ].filter(Boolean);
}

function buildRestoreArgs(options) {
  assertKnownOptions(options, ["staged", "worktree", "pathspecs"]);
  const targets = [];
  if (options.staged) targets.push("--staged");
  if (options.worktree !== false) targets.push("--worktree");
  return ["restore", ...targets, ...pathspecArgs(requireNonEmptyArray(options.pathspecs, "pathspecs"))];
}

function buildCommitArgs(options) {
  assertKnownOptions(options, ["message", "amend", "allowEmpty"]);
  const message = requireString(options.message, "message");
  return [
    "commit",
    "--message",
    message,
    options.amend ? "--amend" : null,
    options.allowEmpty ? "--allow-empty" : null
  ].filter(Boolean);
}

function buildBranchArgs(options) {
  assertKnownOptions(options, ["mode", "name", "startPoint", "force", "all", "remote"]);
  const mode = options.mode || "list";

  if (mode === "list") {
    return [
      "branch",
      "--list",
      options.all ? "--all" : null,
      options.remote ? "--remotes" : null
    ].filter(Boolean);
  }
  if (mode === "create") return ["branch", requireRef(options.name, "name"), optionalRef(options.startPoint)].filter(Boolean);
  if (mode === "delete") return ["branch", options.force ? "-D" : "-d", requireRef(options.name, "name")];

  throw new GitWrapperError("invalid-arguments", `Unsupported branch mode '${mode}'.`);
}

function buildSwitchArgs(options) {
  assertKnownOptions(options, ["branch", "create", "detach", "track", "startPoint"]);
  const args = ["switch"];
  if (options.create) args.push("--create");
  if (options.detach) args.push("--detach");
  if (options.track) args.push("--track");
  args.push(requireRef(options.branch, "branch"));
  if (options.startPoint) args.push(optionalRef(options.startPoint));
  return args;
}

function buildFetchArgs(options) {
  assertKnownOptions(options, ["remote", "prune"]);
  return ["fetch", options.prune === false ? null : "--prune", optionalRef(options.remote)].filter(Boolean);
}

function buildPullArgs(options) {
  assertKnownOptions(options, ["remote", "branch", "ffOnly"]);
  return [
    "pull",
    options.ffOnly === false ? null : "--ff-only",
    optionalRef(options.remote),
    optionalRef(options.branch)
  ].filter(Boolean);
}

function buildPushArgs(options) {
  rejectForceOptions(options);
  assertKnownOptions(options, ["remote", "branch", "setUpstream", "tags"]);
  return [
    "push",
    options.setUpstream ? "--set-upstream" : null,
    options.tags ? "--tags" : null,
    optionalRef(options.remote),
    optionalRef(options.branch)
  ].filter(Boolean);
}

function buildRemoteArgs(options) {
  assertKnownOptions(options, ["mode", "name", "url"]);
  const mode = options.mode || "list";

  if (mode === "list") return ["remote", "-v"];
  if (mode === "add") return ["remote", "add", requireRef(options.name, "name"), requireString(options.url, "url")];
  if (mode === "set-url") return ["remote", "set-url", requireRef(options.name, "name"), requireString(options.url, "url")];

  throw new GitWrapperError("invalid-arguments", `Unsupported remote mode '${mode}'.`);
}

function buildCloneArgs(options) {
  assertKnownOptions(options, ["url", "targetPath", "cwd"]);
  return ["clone", requireString(options.url, "url"), normalizeAbsolutePath(options.targetPath, "targetPath")];
}

function buildInitArgs(options) {
  assertKnownOptions(options, ["defaultBranch"]);
  return ["init", options.defaultBranch ? `--initial-branch=${requireRef(options.defaultBranch, "defaultBranch")}` : null].filter(Boolean);
}

function buildLogArgs(options) {
  assertKnownOptions(options, ["maxCount", "ref", "patch", "format"]);
  const maxCount = Number.isInteger(options.maxCount) ? options.maxCount : 50;
  if (maxCount < 1 || maxCount > 500) {
    throw new GitWrapperError("invalid-arguments", "maxCount must be between 1 and 500.");
  }

  const format = options.format === "empty" ? "" : "%H%x09%an%x09%aI%x09%s";
  return [
    "log",
    `--max-count=${maxCount}`,
    `--pretty=format:${format}`,
    options.patch ? "--patch" : null,
    optionalRef(options.ref)
  ].filter(Boolean);
}

function buildStashArgs(options) {
  assertKnownOptions(options, ["mode", "message", "ref", "includeUntracked"]);
  const mode = options.mode || "list";

  if (mode === "list") return ["stash", "list"];
  if (mode === "push") {
    return [
      "stash",
      "push",
      options.includeUntracked ? "--include-untracked" : null,
      options.message ? ["--message", requireString(options.message, "message")] : null
    ].flat().filter(Boolean);
  }
  if (mode === "apply") return ["stash", "apply", requireString(options.ref, "ref")];
  if (mode === "drop") return ["stash", "drop", requireString(options.ref, "ref")];

  throw new GitWrapperError("invalid-arguments", `Unsupported stash mode '${mode}'.`);
}

function pathspecArgs(pathspecs = []) {
  const normalized = pathspecs.map((item) => requireString(item, "pathspec"));
  return normalized.length > 0 ? ["--", ...normalized] : [];
}

function rejectForceOptions(options) {
  if (options.force || options.forceWithLease || options.forceIfIncludes) {
    throw new GitWrapperError("unsupported-option", "Force push is outside the product scope.");
  }
}

function assertKnownOptions(options, allowedKeys) {
  Object.keys(options).forEach((key) => {
    if (!allowedKeys.includes(key)) {
      throw new GitWrapperError("invalid-arguments", `Unsupported option '${key}'.`);
    }
  });
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GitWrapperError("invalid-arguments", `${name} must be an object.`);
  }
}

function requireNonEmptyArray(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new GitWrapperError("invalid-arguments", `${name} must contain at least one item.`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GitWrapperError("invalid-arguments", `${name} must be a non-empty string.`);
  }
  return value.trim();
}

function requireRef(value, name) {
  const ref = requireString(value, name);
  if (/[\0\r\n]/.test(ref) || ref.startsWith("-")) {
    throw new GitWrapperError("invalid-arguments", `${name} is not a safe Git ref.`);
  }
  return ref;
}

function optionalRef(value) {
  return value ? requireRef(value, "ref") : null;
}

function normalizeAbsolutePath(value, name) {
  const normalized = requireString(value, name);
  if (!path.isAbsolute(normalized)) {
    throw new GitWrapperError("invalid-arguments", `${name} must be an absolute path.`);
  }
  return normalized;
}

function normalizeCommandInput(value) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new GitWrapperError("invalid-arguments", "input must be a string.");
  }
  return value;
}

function normalizeProcessError(error, stdout, stderr) {
  if (error.name === "AbortError") {
    return {
      kind: "aborted",
      message: "Git operation was aborted.",
      raw: { stdout, stderr }
    };
  }

  if (error.code === "ENOENT") {
    return {
      kind: "git-not-found",
      message: "Git executable was not found.",
      raw: { code: error.code, stdout, stderr }
    };
  }

  return {
    kind: "process-error",
    message: error.message,
    raw: { code: error.code, stdout, stderr }
  };
}

function normalizeGitFailure(exitCode, stdout, stderr) {
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  let kind = "git-error";
  let message = "Git command failed.";

  if (combined.includes("conflict")) {
    kind = "conflict";
    message = "Git reported a conflict.";
  } else if (combined.includes("authentication failed") || combined.includes("permission denied")) {
    kind = "auth-error";
    message = "Git authentication or permission failed.";
  }

  return {
    kind,
    message,
    raw: { exitCode, stdout, stderr }
  };
}

module.exports = {
  ALLOWED_GIT_ACTIONS,
  GitWrapperError,
  buildGitArgs,
  runGitCommand
};
