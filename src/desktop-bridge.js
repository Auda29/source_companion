"use strict";

const DESKTOP_BRIDGE_COMMANDS = Object.freeze({
  pickRepositoryFolder: "repository_pick_folder",
  pickCloneTargetFolder: "repository_pick_clone_target_folder",
  pickPublishFolder: "repository_pick_publish_folder",
  openRepository: "repository_open",
  loadRepositoryState: "repository_load_state",
  loadFileDiff: "repository_load_file_diff",
  runFileAction: "repository_run_file_action",
  runHunkAction: "repository_run_hunk_action",
  runCommitAction: "repository_run_commit_action",
  runCloneAction: "repository_run_clone_action",
  preparePublishPreflight: "repository_prepare_publish_preflight",
  runPublishAction: "repository_run_publish_action",
  runBranchAction: "repository_run_branch_action",
  runSyncAction: "repository_run_sync_action",
  runMergeAction: "repository_run_merge_action",
  runStashAction: "repository_run_stash_action",
  getGitOutput: "repository_get_git_output",
  startRepositoryWatch: "repository_watch_start",
  getRepositoryWatch: "repository_watch_get",
  stopRepositoryWatch: "repository_watch_stop",
  getGitHubAuthStatus: "github_get_auth_status",
  startGitHubDeviceLogin: "github_device_login_start",
  getGitHubDeviceLoginStatus: "github_device_login_status",
  pollGitHubDeviceLogin: "github_device_login_poll",
  cancelGitHubDeviceLogin: "github_device_login_cancel",
  loginGitHub: "github_login",
  logoutGitHub: "github_logout",
  listGitHubUserRepositories: "github_list_user_repositories",
  searchGitHubUserRepositories: "github_search_user_repositories",
  listGitHubPullRequests: "github_list_pull_requests",
  createGitHubPullRequest: "github_create_pull_request",
  loadGitHubPullRequestChecks: "github_load_pull_request_checks",
  loadGitHubPullRequestReviewContext: "github_load_pull_request_review_context"
});

const DESKTOP_BRIDGE_METHODS = Object.freeze(Object.keys(DESKTOP_BRIDGE_COMMANDS));

function createTauriDesktopBridge({ invoke } = {}) {
  if (typeof invoke !== "function") {
    throw new TypeError("invoke must be a function.");
  }

  return Object.fromEntries(DESKTOP_BRIDGE_METHODS.map((method) => [
    method,
    (request = {}) => invoke(DESKTOP_BRIDGE_COMMANDS[method], {
      request: normalizeRequest(request)
    })
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
  runCloneAction,
  preparePublishPreflight,
  runPublishAction,
  runBranchAction,
  runSyncAction,
  runMergeAction,
  runStashAction,
  RepositoryStatusWatcher,
  githubAuthBackend,
  githubAuthOptions
} = {}) {
  const modules = loadBackendModules({
    queue,
    loadRepositoryState,
    loadFileDiff,
    runFileAction,
    runHunkAction,
    runCommitAction,
    runCloneAction,
    preparePublishPreflight,
    runPublishAction,
    runBranchAction,
    runSyncAction,
    runMergeAction,
    runStashAction,
    RepositoryStatusWatcher,
    githubAuthBackend,
    githubAuthOptions
  });
  const operationQueue = modules.queue;
  const execute = createQueuedExecutor(operationQueue);
  const publishGitHubClient = createPublishGitHubClient(modules.githubAuthBackend);
  const watchRegistry = new Map();

  return Object.freeze({
    pickRepositoryFolder: async () => unavailableNativeDialog("repository"),
    pickCloneTargetFolder: async () => unavailableNativeDialog("clone-target"),
    pickPublishFolder: async () => unavailableNativeDialog("publish"),
    openRepository: async (request = {}) => modules.loadRepositoryState(withQueueState(request, operationQueue, execute)),
    loadRepositoryState: async (request = {}) => modules.loadRepositoryState(withQueueState(request, operationQueue, execute)),
    loadFileDiff: async (request = {}) => modules.loadFileDiff(withExecute(request, execute)),
    runFileAction: async (request = {}) => modules.runFileAction(withExecute(request, execute)),
    runHunkAction: async (request = {}) => modules.runHunkAction(withExecute(request, execute)),
    runCommitAction: async (request = {}) => modules.runCommitAction(withExecute(request, execute)),
    runCloneAction: async (request = {}) => modules.runCloneAction(withExecute(request, execute)),
    preparePublishPreflight: async (request = {}) => modules.preparePublishPreflight({
      ...withExecute(request, execute),
      githubClient: publishGitHubClient
    }),
    runPublishAction: async (request = {}) => modules.runPublishAction({
      ...withExecute(request, execute),
      githubClient: publishGitHubClient
    }),
    runBranchAction: async (request = {}) => modules.runBranchAction(withExecute(request, execute)),
    runSyncAction: async (request = {}) => modules.runSyncAction(withExecute(request, execute)),
    runMergeAction: async (request = {}) => modules.runMergeAction(withExecute(request, execute)),
    runStashAction: async (request = {}) => modules.runStashAction(withExecute(request, execute)),
    getGitOutput: async (request = {}) => {
      const repositoryId = repositoryIdFor(request.repositoryId, request.repositoryPath);
      return {
        ok: true,
        repositoryId,
        operations: operationQueue.getRepositoryState(repositoryId)
      };
    },
    startRepositoryWatch: async (request = {}) => {
      const normalized = normalizeRequest(request);
      const repositoryPath = clean(normalized.repositoryPath);
      const repositoryId = repositoryIdFor(normalized.repositoryId, repositoryPath);
      const existing = watchRegistry.get(repositoryId);
      if (existing) existing.close();

      const entry = {
        repositoryId,
        latestState: null,
        latestError: null,
        handle: null,
        close() {
          if (this.handle && typeof this.handle.close === "function") {
            this.handle.close();
          }
        }
      };
      const watcher = new modules.RepositoryStatusWatcher({
        loadState: (stateRequest) => modules.loadRepositoryState(withQueueState({
          ...stateRequest,
          repositoryId,
          repositoryPath,
          githubAuth: normalized.githubAuth || stateRequest.githubAuth
        }, operationQueue, execute))
      });

      entry.handle = watcher.watchRepository({
        repositoryId,
        repositoryPath,
        operationsProvider: () => operationQueue.getRepositoryState(repositoryId),
        githubAuthProvider: () => normalized.githubAuth || null,
        onState: (loaded) => {
          entry.latestState = loaded;
          entry.latestError = null;
        },
        onError: (error) => {
          entry.latestError = normalizeWatchError(error);
        }
      });
      watchRegistry.set(repositoryId, entry);
      return watchResponse(entry);
    },
    getRepositoryWatch: async (request = {}) => {
      const normalized = normalizeRequest(request);
      const repositoryId = repositoryIdFor(normalized.repositoryId, normalized.repositoryPath);
      const entry = watchRegistry.get(repositoryId);
      if (!entry) {
        return {
          ok: false,
          repositoryId,
          watching: false,
          snapshot: null,
          latestState: null,
          latestError: {
            kind: "repository-watch-not-found",
            message: "No desktop repository watcher is registered for this repository."
          }
        };
      }
      return watchResponse(entry);
    },
    stopRepositoryWatch: async (request = {}) => {
      const normalized = normalizeRequest(request);
      const repositoryId = repositoryIdFor(normalized.repositoryId, normalized.repositoryPath);
      const entry = watchRegistry.get(repositoryId);
      if (entry) {
        entry.close();
        watchRegistry.delete(repositoryId);
      }
      return {
        ok: true,
        repositoryId,
        watching: false
      };
    },
    getGitHubAuthStatus: async () => modules.githubAuthBackend.getAuthStatus(),
    startGitHubDeviceLogin: async (request = {}) => modules.githubAuthBackend.startDeviceLogin(normalizeRequest(request)),
    getGitHubDeviceLoginStatus: async (request = {}) => modules.githubAuthBackend.getLoginStatus(normalizeRequest(request)),
    pollGitHubDeviceLogin: async (request = {}) => modules.githubAuthBackend.pollDeviceLogin(normalizeRequest(request)),
    cancelGitHubDeviceLogin: async (request = {}) => modules.githubAuthBackend.cancelDeviceLogin(normalizeRequest(request)),
    loginGitHub: async (request = {}) => modules.githubAuthBackend.login(normalizeRequest(request)),
    logoutGitHub: async (request = {}) => modules.githubAuthBackend.logout(normalizeRequest(request)),
    listGitHubUserRepositories: async (request = {}) => modules.githubAuthBackend.listUserRepositories(normalizeRequest(request)),
    searchGitHubUserRepositories: async (request = {}) => modules.githubAuthBackend.searchUserRepositories(normalizeRequest(request)),
    listGitHubPullRequests: async (request = {}) => stripSensitiveFields(await modules.githubAuthBackend.listPullRequests(normalizeRequest(request))),
    createGitHubPullRequest: async (request = {}) => stripSensitiveFields(await modules.githubAuthBackend.createPullRequest(normalizeRequest(request))),
    loadGitHubPullRequestChecks: async (request = {}) => stripSensitiveFields(await modules.githubAuthBackend.loadPullRequestChecks(normalizeRequest(request))),
    loadGitHubPullRequestReviewContext: async (request = {}) => stripSensitiveFields(await modules.githubAuthBackend.loadPullRequestReviewContext(normalizeRequest(request)))
  });
}

function createPublishGitHubClient(githubAuthBackend) {
  return {
    getAuthStatus: async () => stripSensitiveFields(await githubAuthBackend.getAuthStatus()),
    createRepository: async (request = {}) => {
      const result = await githubAuthBackend.createRepository(normalizeRequest(request));
      return {
        ok: Boolean(result && result.ok),
        repository: result && result.repository ? normalizePublishRepository(result.repository) : null,
        error: result && result.error ? stripSensitiveFields(result.error) : null
      };
    }
  };
}

function normalizePublishRepository(repository) {
  return {
    id: repository.id,
    owner: clean(repository.owner),
    name: clean(repository.name),
    fullName: clean(repository.fullName || repository.full_name),
    description: clean(repository.description),
    private: Boolean(repository.private),
    visibility: clean(repository.visibility) || (repository.private ? "private" : "public"),
    stars: Number.isFinite(repository.stars) ? repository.stars : 0,
    cloneUrl: clean(repository.cloneUrl || repository.clone_url),
    sshUrl: clean(repository.sshUrl || repository.ssh_url),
    htmlUrl: clean(repository.htmlUrl || repository.html_url)
  };
}

function stripSensitiveFields(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/token|authorization|secret|deviceCode/i.test(key))
    .map(([key, item]) => [key, stripSensitiveFields(item)]));
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
  const { RepositoryStatusWatcher } = require("./repository-status-watcher");
  const { createDesktopGitHubAuthBridgeBackend } = require("./github-api-client");
  return {
    queue: overrides.queue || new GitOperationQueue(),
    loadRepositoryState: overrides.loadRepositoryState || require("./repository-state").loadRepositoryState,
    loadFileDiff: overrides.loadFileDiff || require("./repository-diff").loadFileDiff,
    runFileAction: overrides.runFileAction || require("./repository-file-actions").runFileAction,
    runHunkAction: overrides.runHunkAction || require("./repository-hunk-actions").runHunkAction,
    runCommitAction: overrides.runCommitAction || require("./repository-commit-actions").runCommitAction,
    runCloneAction: overrides.runCloneAction || require("./repository-clone-actions").runCloneAction,
    preparePublishPreflight: overrides.preparePublishPreflight || require("./repository-publish-actions").preparePublishPreflight,
    runPublishAction: overrides.runPublishAction || require("./repository-publish-actions").runPublishAction,
    runBranchAction: overrides.runBranchAction || require("./repository-branch-actions").runBranchAction,
    runSyncAction: overrides.runSyncAction || require("./repository-sync-actions").runSyncAction,
    runMergeAction: overrides.runMergeAction || require("./repository-merge-actions").runMergeAction,
    runStashAction: overrides.runStashAction || require("./repository-stash-actions").runStashAction,
    RepositoryStatusWatcher: overrides.RepositoryStatusWatcher || RepositoryStatusWatcher,
    githubAuthBackend: overrides.githubAuthBackend || createDesktopGitHubAuthBridgeBackend(overrides.githubAuthOptions)
  };
}

function unavailableNativeDialog(kind) {
  return {
    ok: false,
    canceled: false,
    kind,
    path: null,
    error: {
      kind: "native-folder-dialog-unavailable",
      message: "Native folder dialogs are only available through the Tauri desktop bridge."
    }
  };
}

function watchResponse(entry) {
  return {
    ok: true,
    repositoryId: entry.repositoryId,
    watching: true,
    snapshot: entry.handle && typeof entry.handle.getSnapshot === "function"
      ? entry.handle.getSnapshot()
      : null,
    latestState: entry.latestState,
    latestError: entry.latestError
  };
}

function normalizeWatchError(error) {
  return {
    kind: clean(error && error.kind) || "repository-watch-error",
    message: clean(error && error.message) || "Repository watcher reported an error.",
    raw: error && error.raw ? error.raw : null
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
