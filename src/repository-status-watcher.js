"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { loadRepositoryState } = require("./repository-state");

const DEFAULT_DEBOUNCE_MS = 150;
const DEFAULT_BUSY_RETRY_MS = 250;
const GIT_METADATA_FILES = new Set([
  "HEAD",
  "index",
  "MERGE_HEAD",
  "CHERRY_PICK_HEAD",
  "REBASE_HEAD",
  "BISECT_LOG",
  "FETCH_HEAD",
  "ORIG_HEAD"
]);

class RepositoryStatusWatcher {
  constructor({
    fsModule = fs,
    pathModule = path,
    loadState = loadRepositoryState,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    busyRetryMs = DEFAULT_BUSY_RETRY_MS,
    now = () => new Date().toISOString()
  } = {}) {
    this.fs = fsModule;
    this.path = pathModule;
    this.loadState = loadState;
    this.setTimeout = setTimeoutFn;
    this.clearTimeout = clearTimeoutFn;
    this.debounceMs = debounceMs;
    this.busyRetryMs = busyRetryMs;
    this.now = now;
  }

  watchRepository(options = {}) {
    return new RepositoryWatchHandle(this, options);
  }
}

class RepositoryWatchHandle {
  constructor(owner, {
    repositoryId,
    repositoryPath,
    operationsProvider = () => emptyOperations(),
    githubAuthProvider = () => null,
    onState = () => {},
    onError = () => {}
  } = {}) {
    this.owner = owner;
    this.repositoryId = requireString(repositoryId, "repositoryId");
    this.repositoryPath = requireString(repositoryPath, "repositoryPath");
    this.operationsProvider = operationsProvider;
    this.githubAuthProvider = githubAuthProvider;
    this.onState = onState;
    this.onError = onError;
    this.closed = false;
    this.timer = null;
    this.refreshPromise = null;
    this.watchers = [];
    this.pendingReasons = new Set();
    this.snapshot = {
      repositoryId: this.repositoryId,
      repositoryPath: this.repositoryPath,
      status: "idle",
      pendingReasons: [],
      watchTargets: [],
      lastEventAt: null,
      lastRefreshRequestedAt: null,
      lastRefreshStartedAt: null,
      lastRefreshCompletedAt: null,
      deferredBecauseBusy: false,
      refreshCount: 0,
      ignoredEventCount: 0,
      coalescedEventCount: 0,
      errors: []
    };

    this.startWatchers();
  }

  requestRefresh(reason = "manual") {
    if (this.closed) return;

    const hadPending = this.pendingReasons.size > 0 || this.timer;
    this.pendingReasons.add(reason);
    this.snapshot.status = "pending";
    this.snapshot.lastRefreshRequestedAt = this.owner.now();
    this.snapshot.pendingReasons = [...this.pendingReasons];
    if (hadPending) this.snapshot.coalescedEventCount += 1;

    this.clearTimer();
    this.timer = this.owner.setTimeout(() => {
      this.timer = null;
      this.flushRefresh();
    }, this.owner.debounceMs);
  }

  close() {
    this.closed = true;
    this.clearTimer();
    this.watchers.forEach((watcher) => {
      if (watcher && typeof watcher.close === "function") watcher.close();
    });
    this.watchers = [];
    this.snapshot.status = "closed";
  }

  getSnapshot() {
    return {
      ...this.snapshot,
      pendingReasons: [...this.pendingReasons],
      watchTargets: [...this.snapshot.watchTargets],
      errors: [...this.snapshot.errors]
    };
  }

  startWatchers() {
    const targets = createWatchTargets({
      fsModule: this.owner.fs,
      pathModule: this.owner.path,
      repositoryPath: this.repositoryPath
    });

    targets.forEach((target) => {
      this.watchTarget(target);
    });

    if (this.watchers.length === 0) {
      this.recordError({
        kind: "watcher-not-started",
        message: "Repository watcher could not start for any relevant path.",
        raw: { repositoryPath: this.repositoryPath }
      });
    }
  }

  watchTarget(target) {
    try {
      const watcher = this.owner.fs.watch(target.path, target.options || {}, (eventType, fileName) => {
        this.handleWatchEvent(target, eventType, fileName);
      });
      this.watchers.push(watcher);
      this.snapshot.watchTargets.push({ path: target.path, kind: target.kind });
    } catch (error) {
      this.recordError({
        kind: "watcher-not-startable",
        message: `Could not watch ${target.kind} changes.`,
        raw: { path: target.path, message: error.message }
      });
    }
  }

  handleWatchEvent(target, eventType, fileName) {
    if (this.closed) return;

    const reason = classifyWatchEvent({
      pathModule: this.owner.path,
      target,
      eventType,
      fileName
    });

    if (!reason) {
      this.snapshot.ignoredEventCount += 1;
      return;
    }

    this.snapshot.lastEventAt = this.owner.now();
    this.requestRefresh(reason);
  }

  flushRefresh() {
    if (this.closed || this.refreshPromise) return;

    if (hasRunningGitOperation(this.operationsProvider())) {
      this.snapshot.status = "deferred";
      this.snapshot.deferredBecauseBusy = true;
      this.clearTimer();
      this.timer = this.owner.setTimeout(() => {
        this.timer = null;
        this.flushRefresh();
      }, this.owner.busyRetryMs);
      return;
    }

    const reasons = [...this.pendingReasons];
    this.pendingReasons.clear();
    this.snapshot.pendingReasons = [];
    this.snapshot.status = "refreshing";
    this.snapshot.deferredBecauseBusy = false;
    this.snapshot.lastRefreshStartedAt = this.owner.now();

    this.refreshPromise = this.owner.loadState({
      repositoryPath: this.repositoryPath,
      operations: this.operationsProvider(),
      githubAuth: this.githubAuthProvider(),
      refreshReasons: reasons
    }).then((state) => {
      if (this.closed) return state;
      this.snapshot.status = "idle";
      this.snapshot.lastRefreshCompletedAt = this.owner.now();
      this.snapshot.refreshCount += 1;
      this.onState(state, { repositoryId: this.repositoryId, reasons });
      return state;
    }).catch((error) => {
      this.recordError({
        kind: "refresh-failed",
        message: error.message || "Repository status refresh failed.",
        raw: null
      });
      return null;
    }).finally(() => {
      this.refreshPromise = null;
      if (!this.closed && this.pendingReasons.size > 0) {
        this.requestRefresh("refresh-follow-up");
      }
    });

    return this.refreshPromise;
  }

  clearTimer() {
    if (!this.timer) return;
    this.owner.clearTimeout(this.timer);
    this.timer = null;
  }

  recordError(error) {
    this.snapshot.status = "error";
    this.snapshot.errors.push(error);
    this.onError(error, { repositoryId: this.repositoryId });
  }
}

function createWatchTargets({ fsModule = fs, pathModule = path, repositoryPath }) {
  const targets = [];
  if (isDirectory(fsModule, repositoryPath)) {
    targets.push({
      kind: "worktree",
      path: repositoryPath,
      options: { recursive: true }
    });
  }

  const gitPath = resolveGitMetadataPath({ fsModule, pathModule, repositoryPath });
  if (!gitPath) return targets;

  [
    gitPath,
    pathModule.join(gitPath, "HEAD"),
    pathModule.join(gitPath, "index"),
    pathModule.join(gitPath, "refs", "heads")
  ].forEach((targetPath) => {
    if (exists(fsModule, targetPath)) {
      targets.push({
        kind: "git-metadata",
        path: targetPath,
        options: {}
      });
    }
  });

  return targets;
}

function resolveGitMetadataPath({ fsModule = fs, pathModule = path, repositoryPath }) {
  const dotGit = pathModule.join(repositoryPath, ".git");
  if (isDirectory(fsModule, dotGit)) return dotGit;

  if (!isFile(fsModule, dotGit)) return null;

  try {
    const content = String(fsModule.readFileSync(dotGit, "utf8"));
    const match = content.match(/^gitdir:\s*(.+)$/im);
    if (!match) return null;

    const gitDir = match[1].trim();
    return pathModule.isAbsolute(gitDir) ? gitDir : pathModule.resolve(repositoryPath, gitDir);
  } catch {
    return null;
  }
}

function classifyWatchEvent({ pathModule = path, target, fileName }) {
  const relativeName = normalizeEventName(pathModule, fileName);
  if (target.kind === "worktree") {
    if (!relativeName) return "worktree";
    if (relativeName === ".git" || relativeName.startsWith(`.git${pathModule.sep}`) || relativeName.startsWith(".git/")) {
      return null;
    }
    return "worktree";
  }

  if (target.kind === "git-metadata") {
    if (!relativeName) return "git-metadata";
    const normalized = relativeName.replace(/\\/g, "/");
    const firstSegment = normalized.split("/")[0];
    if (GIT_METADATA_FILES.has(firstSegment) || normalized.startsWith("refs/")) {
      return firstSegment === "HEAD" ? "branch" : "git-index";
    }
    return null;
  }

  return null;
}

function hasRunningGitOperation(operations) {
  const running = operations && Array.isArray(operations.running) ? operations.running : [];
  return running.some((operation) => operation && operation.priority !== "refresh");
}

function isDirectory(fsModule, targetPath) {
  try {
    return fsModule.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(fsModule, targetPath) {
  try {
    return fsModule.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function exists(fsModule, targetPath) {
  try {
    return fsModule.existsSync(targetPath);
  } catch {
    return false;
  }
}

function normalizeEventName(pathModule, fileName) {
  if (Buffer.isBuffer(fileName)) return fileName.toString("utf8");
  return String(fileName || "").replace(/[\\/]+/g, pathModule.sep);
}

function emptyOperations() {
  return {
    running: [],
    queued: [],
    completed: [],
    lastCompleted: null
  };
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

module.exports = {
  RepositoryStatusWatcher,
  classifyWatchEvent,
  createWatchTargets,
  hasRunningGitOperation,
  resolveGitMetadataPath
};
