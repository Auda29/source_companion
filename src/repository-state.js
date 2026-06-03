"use strict";

const fs = require("node:fs");

const { runGitCommand } = require("./git-cli-wrapper");

const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

async function loadRepositoryState({
  repositoryPath,
  operations = emptyOperations(),
  githubAuth = null,
  execute = runGitCommand
} = {}) {
  const normalizedPath = clean(repositoryPath);

  if (!normalizedPath) {
    return createBaseState({
      kind: "no-folder",
      path: null,
      health: "error",
      operations,
      error: {
        kind: "no-folder",
        message: "No folder is open for this repository context."
      }
    });
  }

  const folderCheck = checkFolder(normalizedPath);
  if (!folderCheck.ok) {
    return createBaseState({
      kind: "no-folder",
      path: normalizedPath,
      health: "error",
      operations,
      error: folderCheck.error
    });
  }

  const status = await execute({
    action: "status",
    repositoryPath: normalizedPath,
    options: { porcelain: true, branch: true }
  });

  if (!status.ok) {
    if (isNotGitRepository(status)) {
      return createBaseState({
        kind: "folder-without-git",
        path: normalizedPath,
        health: healthFromOperations(operations),
        operations
      });
    }

    return createBaseState({
      kind: "git-repository",
      path: normalizedPath,
      health: "error",
      operations,
      error: normalizeGitError(status.error)
    });
  }

  const parsedStatus = parsePorcelainStatus(status.stdout);
  const remoteResult = await execute({
    action: "remote",
    repositoryPath: normalizedPath,
    options: { mode: "list" }
  });
  const remotes = remoteResult.ok ? parseRemotes(remoteResult.stdout) : [];
  const primaryRemote = choosePrimaryRemote(remotes);
  const github = createGitHubState(primaryRemote, githubAuth);
  const conflicted = parsedStatus.files.filter((file) => file.conflicted);
  const kind = repositoryKind(primaryRemote, github);
  const health = remoteResult.ok ? conflicted.length > 0 ? "conflict" : healthFromOperations(operations) : "error";

  return createBaseState({
    kind,
    path: normalizedPath,
    health,
    operations,
    git: {
      branch: parsedStatus.branch,
      remote: primaryRemote,
      remotes,
      upstream: parsedStatus.upstream,
      divergence: parsedStatus.divergence,
      files: parsedStatus.files,
      staged: parsedStatus.files.filter((file) => file.staged),
      unstaged: parsedStatus.files.filter((file) => file.unstaged),
      untracked: parsedStatus.files.filter((file) => file.untracked),
      conflicted
    },
    github,
    error: remoteResult.ok ? null : normalizeGitError(remoteResult.error)
  });
}

function createBaseState({
  kind,
  path,
  health,
  operations,
  git = emptyGitState(),
  github = null,
  error = null
}) {
  return {
    path,
    kind,
    health,
    git,
    github,
    operations: normalizeOperations(operations),
    error
  };
}

function parsePorcelainStatus(output) {
  const lines = String(output || "").split(/\r?\n/).filter(Boolean);
  const branchLine = lines[0] && lines[0].startsWith("## ") ? lines.shift() : null;
  const branchInfo = parseBranchLine(branchLine);
  const files = lines.map(parseStatusFile);

  return {
    ...branchInfo,
    files
  };
}

function parseBranchLine(line) {
  const fallback = {
    branch: null,
    upstream: null,
    divergence: { ahead: 0, behind: 0 }
  };

  if (!line) return fallback;

  const body = line.slice(3).trim();
  const divergence = parseDivergence(body);
  const withoutDivergence = body.replace(/\s+\[.+\]$/, "");

  if (withoutDivergence.startsWith("No commits yet on ")) {
    const name = withoutDivergence.replace("No commits yet on ", "").trim();
    return {
      branch: { name, detached: false, headSha: null },
      upstream: null,
      divergence
    };
  }

  if (withoutDivergence === "HEAD (no branch)") {
    return {
      branch: { name: "HEAD", detached: true, headSha: null },
      upstream: null,
      divergence
    };
  }

  const [branchName, upstreamName] = withoutDivergence.split("...");
  return {
    branch: { name: branchName || "HEAD", detached: branchName === "HEAD", headSha: null },
    upstream: upstreamName ? { name: upstreamName } : null,
    divergence
  };
}

function parseDivergence(value) {
  const match = String(value || "").match(/\[(.+)\]$/);
  const divergence = { ahead: 0, behind: 0 };
  if (!match) return divergence;

  match[1].split(",").map((part) => part.trim()).forEach((part) => {
    const ahead = part.match(/^ahead (\d+)$/);
    const behind = part.match(/^behind (\d+)$/);
    if (ahead) divergence.ahead = Number(ahead[1]);
    if (behind) divergence.behind = Number(behind[1]);
  });

  return divergence;
}

function parseStatusFile(line) {
  const indexStatus = line[0] || " ";
  const worktreeStatus = line[1] || " ";
  const status = `${indexStatus}${worktreeStatus}`;
  const rawPath = line.slice(3);
  const renamed = rawPath.includes(" -> ");
  const [oldPath, filePath] = renamed ? rawPath.split(" -> ") : [null, rawPath];
  const conflicted = CONFLICT_CODES.has(status);
  const untracked = status === "??";

  return {
    path: filePath,
    oldPath,
    status,
    indexStatus,
    worktreeStatus,
    type: fileTypeFromStatus(status),
    staged: !conflicted && !untracked && indexStatus !== " ",
    unstaged: !conflicted && !untracked && worktreeStatus !== " ",
    untracked,
    conflicted
  };
}

function fileTypeFromStatus(status) {
  if (status === "??") return "untracked";
  if (CONFLICT_CODES.has(status)) return "conflict";
  if (status.includes("R")) return "renamed";
  if (status.includes("A")) return "added";
  if (status.includes("D")) return "deleted";
  if (status.includes("M")) return "modified";
  return "changed";
}

function parseRemotes(output) {
  const remotes = new Map();

  String(output || "").split(/\r?\n/).filter(Boolean).forEach((line) => {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (!match) return;

    const [, name, url, direction] = match;
    if (!remotes.has(name)) {
      remotes.set(name, {
        name,
        url,
        fetchUrl: null,
        pushUrl: null,
        kind: remoteKind(url),
        github: parseGitHubRemote(url)
      });
    }

    const remote = remotes.get(name);
    if (direction === "fetch") remote.fetchUrl = url;
    if (direction === "push") remote.pushUrl = url;
    if (!remote.url || direction === "fetch") remote.url = url;
    remote.kind = remote.github ? "github" : remoteKind(remote.url);
  });

  return [...remotes.values()];
}

function choosePrimaryRemote(remotes) {
  return remotes.find((remote) => remote.name === "origin") || remotes[0] || null;
}

function parseGitHubRemote(url) {
  const value = clean(url);
  const https = value.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  const ssh = value.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  const sshUrl = value.match(/^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  const match = https || ssh || sshUrl;

  if (!match) return null;

  return {
    owner: match[1],
    name: match[2],
    host: "github.com"
  };
}

function createGitHubState(remote, githubAuth) {
  if (!remote || !remote.github) return null;

  const authenticated = Boolean(githubAuth && githubAuth.authenticated);
  return {
    ...remote.github,
    remote: remote.name,
    authenticated,
    user: authenticated ? clean(githubAuth.user) || null : null
  };
}

function repositoryKind(remote, github) {
  if (github && github.authenticated) return "github-authenticated";
  if (github) return "github-remote";
  if (remote) return "remote-repository";
  return "git-repository";
}

function remoteKind(url) {
  if (parseGitHubRemote(url)) return "github";
  if (/^https?:\/\//i.test(url)) return "https";
  if (/^(git@|ssh:\/\/)/i.test(url)) return "ssh";
  return "other";
}

function healthFromOperations(operations) {
  const normalized = normalizeOperations(operations);
  return normalized.running.length > 0 || normalized.queued.length > 0 ? "operation-running" : "ready";
}

function normalizeOperations(operations) {
  const source = operations || {};
  return {
    running: Array.isArray(source.running) ? source.running : [],
    queued: Array.isArray(source.queued) ? source.queued : [],
    completed: Array.isArray(source.completed) ? source.completed : [],
    lastCompleted: source.lastCompleted || null
  };
}

function emptyOperations() {
  return {
    running: [],
    queued: [],
    completed: [],
    lastCompleted: null
  };
}

function emptyGitState() {
  return {
    branch: null,
    remote: null,
    remotes: [],
    upstream: null,
    divergence: { ahead: 0, behind: 0 },
    files: [],
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: []
  };
}

function checkFolder(repositoryPath) {
  try {
    const stat = fs.statSync(repositoryPath);
    if (!stat.isDirectory()) {
      return {
        ok: false,
        error: {
          kind: "not-a-folder",
          message: "The selected path is not a folder."
        }
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      error: {
        kind: "missing-folder",
        message: "The selected folder does not exist."
      }
    };
  }
}

function isNotGitRepository(result) {
  const raw = result && result.error && result.error.raw;
  const combined = `${result.stdout || ""}\n${result.stderr || ""}\n${raw && raw.stderr ? raw.stderr : ""}`.toLowerCase();
  return combined.includes("not a git repository");
}

function normalizeGitError(error) {
  if (!error) return null;
  return {
    kind: error.kind || "git-error",
    message: error.message || "Git command failed.",
    raw: error.raw || null
  };
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = {
  loadRepositoryState,
  parsePorcelainStatus,
  parseRemotes
};
