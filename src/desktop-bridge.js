"use strict";

const DESKTOP_BRIDGE_COMMANDS = Object.freeze({
  openRepository: "repository_open",
  loadRepositoryState: "repository_load_state",
  loadFileDiff: "repository_load_file_diff",
  runFileAction: "repository_run_file_action",
  runHunkAction: "repository_run_hunk_action",
  runCommitAction: "repository_run_commit_action",
  runBranchAction: "repository_run_branch_action",
  runSyncAction: "repository_run_sync_action",
  runStashAction: "repository_run_stash_action",
  getGitOutput: "repository_get_git_output"
});

const DESKTOP_BRIDGE_METHODS = Object.freeze(Object.keys(DESKTOP_BRIDGE_COMMANDS));

function createTauriDesktopBridge({ invoke } = {}) {
  if (typeof invoke !== "function") {
    throw new TypeError("invoke must be a function.");
  }

  return Object.fromEntries(DESKTOP_BRIDGE_METHODS.map((method) => [
    method,
    (request = {}) => invoke(DESKTOP_BRIDGE_COMMANDS[method], normalizeRequest(request))
  ]));
}

function createDesktopBridgeFacade(bridge) {
  if (!bridge || typeof bridge !== "object") return null;

  const facade = {};
  DESKTOP_BRIDGE_METHODS.forEach((method) => {
    if (typeof bridge[method] === "function") {
      facade[method] = (request = {}) => bridge[method](normalizeRequest(request));
    }
  });

  return Object.keys(facade).length > 0 ? facade : null;
}

function resolveDesktopBridge(globalObject = defaultGlobalObject()) {
  if (!globalObject) return null;

  const explicit = globalObject.SourceCompanionDesktopBridge ||
    globalObject.SourceCompanionRepositoryBridge;
  if (explicit) return createDesktopBridgeFacade(explicit);

  const invoke = globalObject.__TAURI__ &&
    globalObject.__TAURI__.core &&
    globalObject.__TAURI__.core.invoke;
  if (typeof invoke !== "function") return null;

  return createDesktopBridgeFacade(createTauriDesktopBridge({ invoke }));
}

function createDesktopBridgeBackend({
  queue,
  loadRepositoryState,
  loadFileDiff,
  runFileAction,
  runHunkAction,
  runCommitAction,
  runBranchAction,
  runSyncAction,
  runStashAction
} = {}) {
  const modules = loadBackendModules({
    queue,
    loadRepositoryState,
    loadFileDiff,
    runFileAction,
    runHunkAction,
    runCommitAction,
    runBranchAction,
    runSyncAction,
    runStashAction
  });
  const operationQueue = modules.queue;
  const execute = createQueuedExecutor(operationQueue);

  return Object.freeze({
    openRepository: async (request = {}) => modules.loadRepositoryState(withQueueState(request, operationQueue, execute)),
    loadRepositoryState: async (request = {}) => modules.loadRepositoryState(withQueueState(request, operationQueue, execute)),
    loadFileDiff: async (request = {}) => modules.loadFileDiff(withExecute(request, execute)),
    runFileAction: async (request = {}) => modules.runFileAction(withExecute(request, execute)),
    runHunkAction: async (request = {}) => modules.runHunkAction(withExecute(request, execute)),
    runCommitAction: async (request = {}) => modules.runCommitAction(withExecute(request, execute)),
    runBranchAction: async (request = {}) => modules.runBranchAction(withExecute(request, execute)),
    runSyncAction: async (request = {}) => modules.runSyncAction(withExecute(request, execute)),
    runStashAction: async (request = {}) => modules.runStashAction(withExecute(request, execute)),
    getGitOutput: async (request = {}) => {
      const repositoryId = repositoryIdFor(request.repositoryId, request.repositoryPath);
      return {
        ok: true,
        repositoryId,
        operations: operationQueue.getRepositoryState(repositoryId)
      };
    }
  });
}

function createQueuedExecutor(queue) {
  return async function execute(command = {}) {
    const repositoryPath = clean(command.repositoryPath);
    const repositoryId = repositoryIdFor(command.repositoryId, repositoryPath);
    const operation = queue.enqueue({
      repositoryId,
      repositoryPath,
      action: command.action,
      kind: command.kind || command.action,
      options: command.options || {},
      priority: command.priority,
      input: command.input
    });

    return operation.promise;
  };
}

function withQueueState(request, queue, execute) {
  const normalized = withExecute(request, execute);
  const repositoryId = repositoryIdFor(normalized.repositoryId, normalized.repositoryPath);
  return {
    ...normalized,
    operations: normalized.operations || queue.getRepositoryState(repositoryId)
  };
}

function withExecute(request, execute) {
  return {
    ...normalizeRequest(request),
    execute
  };
}

function loadBackendModules(overrides) {
  if (typeof require !== "function") {
    throw new Error("Desktop bridge backend requires CommonJS modules.");
  }

  const { GitOperationQueue } = require("./git-operation-queue");
  return {
    queue: overrides.queue || new GitOperationQueue(),
    loadRepositoryState: overrides.loadRepositoryState || require("./repository-state").loadRepositoryState,
    loadFileDiff: overrides.loadFileDiff || require("./repository-diff").loadFileDiff,
    runFileAction: overrides.runFileAction || require("./repository-file-actions").runFileAction,
    runHunkAction: overrides.runHunkAction || require("./repository-hunk-actions").runHunkAction,
    runCommitAction: overrides.runCommitAction || require("./repository-commit-actions").runCommitAction,
    runBranchAction: overrides.runBranchAction || require("./repository-branch-actions").runBranchAction,
    runSyncAction: overrides.runSyncAction || require("./repository-sync-actions").runSyncAction,
    runStashAction: overrides.runStashAction || require("./repository-stash-actions").runStashAction
  };
}

function repositoryIdFor(repositoryId, repositoryPath) {
  return clean(repositoryId) || `repo:${clean(repositoryPath).toLowerCase()}`;
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return {};
  return { ...request };
}

function clean(value) {
  return String(value || "").trim();
}

function defaultGlobalObject() {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined") return globalThis;
  return null;
}

if (typeof window !== "undefined") {
  window.SourceCompanionDesktopBridgeFactory = {
    DESKTOP_BRIDGE_COMMANDS,
    DESKTOP_BRIDGE_METHODS,
    createDesktopBridgeFacade,
    createTauriDesktopBridge,
    resolveDesktopBridge
  };

  const bridge = resolveDesktopBridge(window);
  if (bridge) {
    window.SourceCompanionDesktopBridge = bridge;
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    DESKTOP_BRIDGE_COMMANDS,
    DESKTOP_BRIDGE_METHODS,
    createDesktopBridgeBackend,
    createDesktopBridgeFacade,
    createTauriDesktopBridge,
    resolveDesktopBridge
  };
}
