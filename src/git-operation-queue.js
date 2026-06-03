"use strict";

const nodeCrypto = require("node:crypto");

const { runGitCommand } = require("./git-cli-wrapper");

class GitOperationQueue {
  constructor({ execute = runGitCommand, now = () => new Date().toISOString(), createId = defaultCreateId } = {}) {
    this.execute = execute;
    this.now = now;
    this.createId = createId;
    this.repositories = new Map();
  }

  enqueue(request = {}) {
    const repositoryId = requireString(request.repositoryId, "repositoryId");
    const repositoryPath = requireString(request.repositoryPath, "repositoryPath");
    const action = requireString(request.action, "action");
    const kind = request.kind ? requireString(request.kind, "kind") : action;
    const priority = request.priority === "refresh" ? "refresh" : "normal";
    const repository = this.getOrCreateRepository(repositoryId);
    const controller = new AbortController();
    let resolvePromise;

    const operation = {
      id: request.id || this.createId(repositoryId, action),
      repositoryId,
      repositoryPath,
      action,
      kind,
      options: request.options || {},
      priority,
      status: "queued",
      queuedAt: this.now(),
      startedAt: null,
      completedAt: null,
      abortable: true,
      result: null,
      error: null,
      controller,
      promise: new Promise((resolve) => {
        resolvePromise = resolve;
      })
    };

    operation.resolve = resolvePromise;
    insertQueuedOperation(repository, operation);
    this.startNext(repositoryId);

    return {
      id: operation.id,
      promise: operation.promise,
      abort: () => this.abort(operation.id),
      snapshot: () => snapshotOperation(operation)
    };
  }

  abort(operationId) {
    for (const [repositoryId, repository] of this.repositories) {
      if (repository.running && repository.running.id === operationId) {
        repository.running.controller.abort();
        return true;
      }

      const index = repository.queued.findIndex((operation) => operation.id === operationId);
      if (index !== -1) {
        const [operation] = repository.queued.splice(index, 1);
        this.completeOperation(repositoryId, repository, operation, "aborted", createAbortResult(operation));
        return true;
      }
    }

    return false;
  }

  getRepositoryState(repositoryId) {
    const repository = this.getOrCreateRepository(repositoryId);
    return snapshotRepository(repository);
  }

  getAllStates() {
    const states = {};
    for (const [repositoryId, repository] of this.repositories) {
      states[repositoryId] = snapshotRepository(repository);
    }
    return states;
  }

  getOrCreateRepository(repositoryId) {
    if (!this.repositories.has(repositoryId)) {
      this.repositories.set(repositoryId, {
        running: null,
        queued: [],
        completed: [],
        lastCompleted: null
      });
    }

    return this.repositories.get(repositoryId);
  }

  startNext(repositoryId) {
    const repository = this.getOrCreateRepository(repositoryId);
    if (repository.running || repository.queued.length === 0) return;

    const operation = repository.queued.shift();
    repository.running = operation;
    operation.status = "running";
    operation.startedAt = this.now();

    this.execute({
      action: operation.action,
      repositoryPath: operation.repositoryPath,
      options: operation.options,
      signal: operation.controller.signal
    }).then((result) => {
      const status = operation.controller.signal.aborted || isAbortResult(result) ? "aborted" : result.ok ? "succeeded" : "failed";
      const finalResult = status === "aborted" && !isAbortResult(result) ? createAbortResult(operation) : result;
      this.completeOperation(repositoryId, repository, operation, status, finalResult);
    }).catch((error) => {
      const status = operation.controller.signal.aborted ? "aborted" : "failed";
      this.completeOperation(repositoryId, repository, operation, status, createCaughtErrorResult(operation, error));
    });
  }

  completeOperation(repositoryId, repository, operation, status, result) {
    operation.status = status;
    operation.completedAt = this.now();
    operation.result = result;
    operation.error = status === "failed" || status === "aborted" ? result.error : null;
    operation.controller = null;

    if (repository.running && repository.running.id === operation.id) {
      repository.running = null;
    }

    repository.completed.push(operation);
    repository.lastCompleted = operation;
    resolveCompleted(operation, result);
    delete operation.resolve;
    this.startNext(repositoryId);
  }
}

function insertQueuedOperation(repository, operation) {
  if (operation.priority !== "refresh") {
    repository.queued.push(operation);
    return;
  }

  const existingRefresh = repository.queued.find((item) => item.priority === "refresh" && item.kind === operation.kind);
  if (existingRefresh) {
    existingRefresh.options = operation.options;
    existingRefresh.queuedAt = operation.queuedAt;
    operation.status = "aborted";
    operation.completedAt = operation.queuedAt;
    operation.error = {
      kind: "coalesced-refresh",
      message: "A newer status refresh replaced this queued refresh."
    };
    resolveCompleted(operation, createAbortResult(operation, "coalesced-refresh"));
    return;
  }

  const firstNormalIndex = repository.queued.findIndex((item) => item.priority !== "refresh");
  if (firstNormalIndex === -1) {
    repository.queued.push(operation);
  } else {
    repository.queued.splice(firstNormalIndex, 0, operation);
  }
}

function snapshotRepository(repository) {
  return {
    running: repository.running ? [snapshotOperation(repository.running)] : [],
    queued: repository.queued.map(snapshotOperation),
    completed: repository.completed.map(snapshotOperation),
    lastCompleted: repository.lastCompleted ? snapshotOperation(repository.lastCompleted) : null
  };
}

function snapshotOperation(operation) {
  return {
    id: operation.id,
    repositoryId: operation.repositoryId,
    kind: operation.kind,
    action: operation.action,
    priority: operation.priority,
    status: operation.status,
    queuedAt: operation.queuedAt,
    startedAt: operation.startedAt,
    completedAt: operation.completedAt,
    abortable: operation.abortable,
    result: operation.result,
    error: operation.error
  };
}

function resolveCompleted(operation, result) {
  if (typeof operation.resolve === "function") {
    operation.resolve(result);
  }
}

function createAbortResult(operation, kind = "aborted") {
  return {
    ok: false,
    action: operation.action,
    args: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: {
      kind,
      message: "Git operation was aborted.",
      raw: null
    }
  };
}

function createCaughtErrorResult(operation, error) {
  return {
    ok: false,
    action: operation.action,
    args: [],
    stdout: "",
    stderr: "",
    exitCode: null,
    error: {
      kind: "queue-error",
      message: error.message,
      raw: null
    }
  };
}

function isAbortResult(result) {
  return result && result.error && result.error.kind === "aborted";
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function defaultCreateId(repositoryId, action) {
  const random = nodeCrypto.randomUUID();
  return `${repositoryId}:${action}:${random}`;
}

module.exports = {
  GitOperationQueue
};
