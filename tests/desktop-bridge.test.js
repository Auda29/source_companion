"use strict";

const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  DESKTOP_BRIDGE_COMMANDS,
  DESKTOP_BRIDGE_METHODS,
  createDesktopBridgeBackend,
  createTauriDesktopBridge
} = require("../src/desktop-bridge");

const projectRoot = path.join(__dirname, "..");

test("desktop bridge exposes only whitelisted desktop repository and auth methods", () => {
  assert.deepEqual(DESKTOP_BRIDGE_METHODS, [
    "pickRepositoryFolder",
    "pickCloneTargetFolder",
    "pickPublishFolder",
    "setWindowMode",
    "openRepository",
    "loadRepositoryState",
    "loadFileDiff",
    "runFileAction",
    "runHunkAction",
    "runCommitAction",
    "runCloneAction",
    "preparePublishPreflight",
    "runPublishAction",
    "runBranchAction",
    "runSyncAction",
    "runMergeAction",
    "runStashAction",
    "getGitOutput",
    "startRepositoryWatch",
    "getRepositoryWatch",
    "stopRepositoryWatch",
    "getGitHubAuthStatus",
    "startGitHubDeviceLogin",
    "getGitHubDeviceLoginStatus",
    "pollGitHubDeviceLogin",
    "cancelGitHubDeviceLogin",
    "loginGitHub",
    "logoutGitHub",
    "listGitHubUserRepositories",
    "searchGitHubUserRepositories",
    "listGitHubPullRequests",
    "createGitHubPullRequest",
    "loadGitHubPullRequestChecks",
    "loadGitHubPullRequestReviewContext"
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "runGitCommand"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "runShellCommand"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "readFile"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "readGitHubToken"), false);
});

test("tauri desktop bridge maps window mode switching to a native command", async () => {
  const calls = [];
  const bridge = createTauriDesktopBridge({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
      return { ok: true, mode: payload.request.mode };
    }
  });

  const result = await bridge.setWindowMode({
    mode: "floating",
    activeRepositoryId: "repo-1",
    activeRepositoryPath: "C:\\repo"
  });

  assert.deepEqual(result, { ok: true, mode: "floating" });
  assert.deepEqual(calls, [{
    command: "desktop_set_window_mode",
    payload: {
      request: {
        mode: "floating",
        activeRepositoryId: "repo-1",
        activeRepositoryPath: "C:\\repo"
      }
    }
  }]);
});

test("tauri desktop bridge maps methods to explicit command names", async () => {
  const calls = [];
  const bridge = createTauriDesktopBridge({
    invoke: async (command, payload) => {
      calls.push({ command, payload });
      return { ok: true, command, payload };
    }
  });

  const result = await bridge.runCommitAction({
    repositoryPath: "C:\\repo",
    action: "commit",
    message: "Initial commit"
  });

  assert.equal(result.command, "repository_run_commit_action");
  assert.deepEqual(calls, [{
    command: "repository_run_commit_action",
    payload: {
      request: {
        repositoryPath: "C:\\repo",
        action: "commit",
        message: "Initial commit"
      }
    }
  }]);
});

test("tauri native app registers every repository bridge command", () => {
  const lib = fs.readFileSync(path.join(projectRoot, "src-tauri", "src", "lib.rs"), "utf8");

  Object.values(DESKTOP_BRIDGE_COMMANDS).forEach((command) => {
    assert.match(lib, new RegExp(`#\\[tauri::command\\][\\s\\S]*fn ${command}\\b`));
    assert.match(lib, new RegExp(`generate_handler!\\[[\\s\\S]*${command}`));
  });

  assert.match(lib, /tauri_plugin_dialog::init/);
  assert.match(lib, /blocking_pick_folder/);
  assert.match(lib, /\.setup\(\|app\|/);
  assert.match(lib, /DesktopBridgeState::new\(app\.handle\(\)\)/);
  assert.match(lib, /worker:\s*Result<DesktopBridgeWorker,\s*String>/);
  assert.match(lib, /app\.manage\(DesktopBridgeState::new\(app\.handle\(\)\)\)/);
  assert.doesNotMatch(
    lib,
    /DesktopBridgeState::new\(app\.handle\(\)\)\.map_err/,
    "bridge startup errors must not abort Tauri setup"
  );
  assert.match(lib, /DesktopBridgeWorker::start\(app\)/);
  assert.match(lib, /app\s*\.path\(\)\s*\.resource_dir\(\)/);
  assert.ok(
    lib.indexOf('env::var("SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER")') <
      lib.indexOf(".resource_dir()"),
    "explicit worker override must be checked before bundled resources"
  );
  assert.ok(
    lib.indexOf(".resource_dir()") < lib.indexOf('env!("CARGO_MANIFEST_DIR")'),
    "bundled worker resource must be checked before the development source fallback"
  );
  assert.match(lib, /desktop-bridge-worker-missing/);
  assert.match(lib, /format_bridge_start_error/);
  assert.match(lib, /ErrorKind::NotFound/);
  assert.match(lib, /desktop-bridge-runtime-missing/);
  assert.match(lib, /SOURCE_COMPANION_NODE_BINARY/);
  assert.match(lib, /desktop-bridge-worker\.js/);
  assert.match(lib, /--preserve-symlinks/);
  assert.match(lib, /--preserve-symlinks-main/);
});

test("desktop bridge backend lists GitHub repositories without exposing tokens", async () => {
  const calls = [];
  const bridge = createDesktopBridgeBackend({
    queue: createRecordingQueue(),
    githubAuthBackend: require("../src/github-api-client").createGitHubAuthBridgeBackend({
      githubClient: {
        listUserRepositories: async (options) => {
          calls.push(["list", options]);
          return {
            ok: true,
            repositories: [{
              id: 1,
              owner: "octo",
              name: "source-companion",
              fullName: "octo/source-companion",
              description: "Focused source control",
              private: false,
              visibility: "public",
              stars: 4,
              cloneUrl: "https://github.com/octo/source-companion.git",
              token: "must-not-leak"
            }],
            token: "must-not-leak"
          };
        },
        searchUserRepositories: async (options) => {
          calls.push(["search", options]);
          return {
            ok: true,
            repositories: [{
              id: 2,
              owner: "octo",
              name: "desktop",
              fullName: "octo/desktop",
              description: "Desktop bridge",
              private: true,
              visibility: "private",
              stars: 7,
              cloneUrl: "https://github.com/octo/desktop.git",
              token: "must-not-leak"
            }],
            token: "must-not-leak"
          };
        }
      }
    })
  });

  const listed = await bridge.listGitHubUserRepositories({ maxPages: 1 });
  const searched = await bridge.searchGitHubUserRepositories({ query: "desktop" });

  assert.deepEqual(calls, [
    ["list", { maxPages: 1 }],
    ["search", { query: "desktop" }]
  ]);
  assert.equal(listed.ok, true);
  assert.equal(listed.token, undefined);
  assert.equal(listed.repositories[0].token, undefined);
  assert.equal(listed.repositories[0].cloneUrl, "https://github.com/octo/source-companion.git");
  assert.equal(searched.ok, true);
  assert.equal(searched.repositories[0].fullName, "octo/desktop");
  assert.equal(searched.repositories[0].private, true);
  assert.equal(searched.repositories[0].token, undefined);
});

test("desktop bridge backend delegates clone through the operation queue", async () => {
  const queue = createRecordingQueue();
  const bridge = createDesktopBridgeBackend({ queue });

  const result = await bridge.runCloneAction({
    url: "https://github.com/octo/source-companion.git",
    targetPath: "C:\\code\\source-companion"
  });

  assert.equal(result.ok, true);
  assert.equal(result.command.action, "clone");
  assert.equal(queue.requests.length, 1);
  assert.deepEqual(queue.requests[0], {
    repositoryId: "repo:c:\\code\\source-companion",
    repositoryPath: "C:\\code\\source-companion",
    action: "clone",
    kind: "clone",
    options: {
      url: "https://github.com/octo/source-companion.git",
      targetPath: "C:\\code\\source-companion"
    },
    priority: undefined,
    input: undefined
  });
});

test("desktop bridge backend loads GitHub pull request context without exposing tokens", async () => {
  const calls = [];
  const bridge = createDesktopBridgeBackend({
    queue: createRecordingQueue(),
    githubAuthBackend: require("../src/github-api-client").createGitHubAuthBridgeBackend({
      githubClient: {
        listPullRequests: async (options) => {
          calls.push(["list", options]);
          return {
            ok: true,
            pullRequests: [{
              id: 10,
              number: 4,
              title: "Desktop PR bridge",
              state: "open",
              htmlUrl: "https://github.com/octo/source-companion/pull/4",
              token: "must-not-leak",
              head: { ref: "feature/pr", sha: "abc123" },
              base: { ref: "main" }
            }],
            token: "must-not-leak"
          };
        },
        createPullRequest: async (options) => {
          calls.push(["create", options]);
          return {
            ok: true,
            pullRequest: {
              id: 11,
              number: 5,
              title: options.title,
              state: "open",
              htmlUrl: "https://github.com/octo/source-companion/pull/5",
              token: "must-not-leak"
            },
            token: "must-not-leak"
          };
        },
        loadPullRequestChecks: async (options) => {
          calls.push(["checks", options]);
          return {
            ok: true,
            state: "success",
            summary: "Checks passing.",
            statuses: [{
              id: 20,
              name: "legacy-ci",
              state: "success",
              targetUrl: "https://ci.example/status/20",
              token: "must-not-leak"
            }],
            checks: [{
              id: 21,
              name: "build",
              state: "success",
              detailsUrl: "https://github.com/octo/source-companion/actions/runs/21",
              token: "must-not-leak"
            }],
            token: "must-not-leak"
          };
        },
        loadPullRequestReviewContext: async (options) => {
          calls.push(["review", options]);
          return {
            ok: true,
            summary: "1 review comment; 1 issue link.",
            reviewComments: [{
              id: 30,
              path: "src/main.js",
              body: "Handle desktop PR context.",
              author: "reviewer",
              htmlUrl: "https://github.com/octo/source-companion/pull/4#discussion_r30",
              token: "must-not-leak"
            }],
            issueLinks: [{
              number: 42,
              title: "Improve desktop PR context",
              state: "open",
              htmlUrl: "https://github.com/octo/source-companion/issues/42",
              token: "must-not-leak"
            }],
            token: "must-not-leak"
          };
        }
      }
    })
  });

  const listed = await bridge.listGitHubPullRequests({ owner: "octo", repo: "source-companion", branch: "feature/pr" });
  const created = await bridge.createGitHubPullRequest({ owner: "octo", repo: "source-companion", base: "main", head: "feature/pr", title: "Created PR" });
  const checks = await bridge.loadGitHubPullRequestChecks({ owner: "octo", repo: "source-companion", ref: "abc123" });
  const reviewContext = await bridge.loadGitHubPullRequestReviewContext({ owner: "octo", repo: "source-companion", pullNumber: 4, branch: "feature/issue-42" });

  assert.equal(listed.ok, true);
  assert.equal(listed.token, undefined);
  assert.equal(listed.pullRequests[0].token, undefined);
  assert.equal(created.ok, true);
  assert.equal(created.pullRequest.token, undefined);
  assert.equal(checks.ok, true);
  assert.equal(checks.token, undefined);
  assert.equal(checks.statuses[0].token, undefined);
  assert.equal(checks.checks[0].token, undefined);
  assert.equal(reviewContext.ok, true);
  assert.equal(reviewContext.reviewComments[0].token, undefined);
  assert.equal(reviewContext.issueLinks[0].token, undefined);
  assert.deepEqual(calls.map((call) => call[0]), ["list", "create", "checks", "review"]);
});

test("desktop bridge backend publishes through backend-only GitHub client and operation queue", async () => {
  const queue = createPublishingQueue();
  const githubCalls = [];
  const bridge = createDesktopBridgeBackend({
    queue,
    githubAuthBackend: {
      getAuthStatus: async () => ({
        authenticated: true,
        user: "octo",
        token: "must-not-leak"
      }),
      createRepository: async (options) => {
        githubCalls.push(options);
        return {
          ok: true,
          repository: {
            owner: "octo",
            name: options.name,
            fullName: `octo/${options.name}`,
            cloneUrl: "https://github.com/octo/published.git",
            token: "must-not-leak"
          },
          token: "must-not-leak",
          error: null
        };
      }
    }
  });

  const preflight = await bridge.preparePublishPreflight({
    repositoryPath: "C:\\repo",
    name: "published",
    description: "Desktop publish",
    visibility: "public",
    publicConfirmed: true
  });
  const result = await bridge.runPublishAction({
    repositoryPath: "C:\\repo",
    name: "published",
    description: "Desktop publish",
    visibility: "public"
  });

  assert.equal(preflight.ok, true);
  assert.equal(result.ok, true);
  assert.deepEqual(githubCalls, [{
    name: "published",
    description: "Desktop publish",
    private: false
  }]);
  assert.equal(result.repository.fullName, "octo/published");
  assert.equal(result.repository.token, undefined);
  assert.equal(result.token, undefined);
  assert.deepEqual(queue.requests.map((request) => request.action), [
    "status",
    "remote",
    "status",
    "remote",
    "remote",
    "push"
  ]);
  assert.equal(queue.requests[4].options.url, "https://github.com/octo/published.git");
});

test("desktop bridge backend delegates merge through the operation queue", async () => {
  const queue = createRecordingQueue();
  const bridge = createDesktopBridgeBackend({ queue });

  const result = await bridge.runMergeAction({
    repositoryPath: "C:\\repo",
    git: {
      branch: { name: "main", detached: false },
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: []
    },
    target: "feature"
  });

  assert.equal(result.ok, true);
  assert.equal(result.command.action, "merge");
  assert.equal(queue.requests.length, 1);
  assert.deepEqual(queue.requests[0], {
    repositoryId: "repo:c:\\repo",
    repositoryPath: "C:\\repo",
    action: "merge",
    kind: "merge",
    options: { target: "feature" },
    priority: undefined,
    input: undefined
  });
});

test("desktop bridge backend owns repository watchers behind start get and stop commands", async () => {
  let closed = false;
  const bridge = createDesktopBridgeBackend({
    queue: createRecordingQueue(),
    RepositoryStatusWatcher: class {
      watchRepository(options) {
        options.onState({
          kind: "git-repository",
          health: "ready",
          git: { branch: { name: "main" } }
        });
        return {
          getSnapshot: () => ({
            repositoryId: options.repositoryId,
            repositoryPath: options.repositoryPath,
            status: "idle",
            refreshCount: 1,
            lastRefreshCompletedAt: "2026-06-09T16:20:00.000Z",
            pendingReasons: [],
            watchTargets: [{ path: options.repositoryPath, kind: "worktree" }],
            errors: []
          }),
          close: () => {
            closed = true;
          }
        };
      }
    }
  });

  const started = await bridge.startRepositoryWatch({
    repositoryId: "repo-1",
    repositoryPath: "C:\\repo"
  });
  assert.equal(started.ok, true);
  assert.equal(started.watching, true);
  assert.equal(started.latestState.git.branch.name, "main");
  assert.equal(started.snapshot.watchTargets[0].kind, "worktree");

  const snapshot = await bridge.getRepositoryWatch({ repositoryId: "repo-1" });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.snapshot.refreshCount, 1);

  const stopped = await bridge.stopRepositoryWatch({ repositoryId: "repo-1" });
  assert.equal(stopped.ok, true);
  assert.equal(stopped.watching, false);
  assert.equal(closed, true);
});

test("desktop bridge backend delegates git actions through the operation queue", async () => {
  const queue = createRecordingQueue();
  const bridge = createDesktopBridgeBackend({ queue });

  const result = await bridge.runFileAction({
    repositoryPath: "C:\\repo",
    file: {
      path: "src/app.js",
      status: " M",
      unstaged: true,
      type: "modified"
    },
    bucketId: "unstaged",
    action: "stage"
  });

  assert.equal(result.ok, true);
  assert.equal(result.command.action, "add");
  assert.equal(queue.requests.length, 1);
  assert.deepEqual(queue.requests[0], {
    repositoryId: "repo:c:\\repo",
    repositoryPath: "C:\\repo",
    action: "add",
    kind: "add",
    options: { pathspecs: ["src/app.js"] },
    priority: undefined,
    input: undefined
  });
});

test("desktop bridge backend keeps GitHub device login tokens backend-only", async () => {
  const tokenStore = createRecordingTokenStore();
  const bridge = createDesktopBridgeBackend({
    queue: createRecordingQueue(),
    githubAuthBackend: require("../src/github-api-client").createGitHubAuthBridgeBackend({
      tokenStore,
      now: () => "2026-06-09T18:00:00.000Z",
      deviceFlow: {
        startDeviceLoginSession: async ({ scopes }) => ({
          loginId: "login-1",
          deviceCode: "device-secret",
          userCode: "ABCD-1234",
          verificationUrl: "https://github.com/login/device",
          expiresAt: "2026-06-09T18:15:00.000Z",
          intervalSeconds: 5,
          scopes
        }),
        pollDeviceLogin: async () => ({
          token: "secret-token",
          login: "octo",
          scopes: ["repo", "read:user"]
        })
      }
    })
  });

  const started = await bridge.startGitHubDeviceLogin({ openBrowser: true });
  assert.equal(started.status, "pending");
  assert.equal(started.userCode, "ABCD-1234");
  assert.equal(started.verificationUrl, "https://github.com/login/device");
  assert.equal(started.deviceCode, undefined);
  assert.equal(started.token, undefined);

  const completed = await bridge.pollGitHubDeviceLogin();
  assert.equal(completed.status, "authenticated");
  assert.equal(completed.auth.authenticated, true);
  assert.equal(completed.auth.user, "octo");
  assert.equal(completed.token, undefined);
  assert.equal(completed.auth.token, undefined);
  assert.equal(tokenStore.record.token, "secret-token");

  const status = await bridge.getGitHubAuthStatus();
  assert.equal(status.authenticated, true);
  assert.equal(status.token, undefined);

  const loggedOut = await bridge.logoutGitHub();
  assert.equal(loggedOut.authenticated, false);
  assert.equal(tokenStore.record, null);
});

test("desktop bridge default auth backend wires device flow and secure token store", async () => {
  const tokenStore = createRecordingTokenStore();
  const bridge = createDesktopBridgeBackend({
    queue: createRecordingQueue(),
    githubAuthOptions: {
      tokenStore,
      now: () => "2026-06-09T18:30:00.000Z",
      deviceFlow: {
        startDeviceLoginSession: async ({ scopes, openBrowser }) => {
          assert.deepEqual(scopes, ["repo", "read:user"]);
          assert.equal(openBrowser, true);
          return {
            deviceCode: "device-secret",
            userCode: "WXYZ-7890",
            verificationUrl: "https://github.com/login/device",
            expiresAt: "2026-06-09T18:45:00.000Z",
            intervalSeconds: 5
          };
        },
        pollDeviceLogin: async ({ deviceCode }) => {
          assert.equal(deviceCode, "device-secret");
          return {
            token: "secret-token",
            login: "octo",
            scopes: ["repo", "read:user"]
          };
        }
      }
    }
  });

  const initial = await bridge.getGitHubAuthStatus();
  assert.equal(initial.authenticated, false);
  assert.equal(initial.error, null);

  const started = await bridge.startGitHubDeviceLogin({ openBrowser: true });
  assert.equal(started.status, "pending");
  assert.equal(started.userCode, "WXYZ-7890");
  assert.equal(started.deviceCode, undefined);

  const completed = await bridge.pollGitHubDeviceLogin();
  assert.equal(completed.status, "authenticated");
  assert.equal(completed.auth.user, "octo");
  assert.equal(completed.auth.token, undefined);
  assert.equal(tokenStore.record.token, "secret-token");

  const status = await bridge.getGitHubAuthStatus();
  assert.equal(status.authenticated, true);
  assert.equal(status.user, "octo");
  assert.equal(status.token, undefined);

  const loggedOut = await bridge.logoutGitHub();
  assert.equal(loggedOut.authenticated, false);
  assert.equal(tokenStore.record, null);
});

test("desktop bridge backend preserves hunk patch stdin through the queue", async () => {
  const queue = createRecordingQueue();
  const bridge = createDesktopBridgeBackend({ queue });
  const diff = [
    "diff --git a/file.txt b/file.txt",
    "index 1111111..2222222 100644",
    "--- a/file.txt",
    "+++ b/file.txt",
    "@@ -1 +1 @@",
    "-old",
    "+new"
  ].join("\n");

  const result = await bridge.runHunkAction({
    repositoryPath: "C:\\repo",
    file: {
      path: "file.txt",
      status: " M",
      unstaged: true,
      type: "modified"
    },
    bucketId: "unstaged",
    action: "stage-hunk",
    diff,
    hunkIndex: 0
  });

  assert.equal(result.ok, true);
  assert.equal(queue.requests.length, 2);
  assert.equal(queue.requests[0].action, "apply");
  assert.equal(queue.requests[0].options.check, true);
  assert.match(queue.requests[0].input, /diff --git a\/file\.txt b\/file\.txt/);
  assert.equal(queue.requests[1].options.check, false);
  assert.match(queue.requests[1].input, /@@ -1 \+1 @@/);
});

test("desktop bridge worker keeps a backend queue behind native command calls", async (t) => {
  const workerPath = path.join(projectRoot, "src", "desktop-bridge-worker.js");
  const worker = spawn(process.execPath, [
    "--preserve-symlinks",
    "--preserve-symlinks-main",
    workerPath
  ], {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "inherit"]
  });
  t.after(() => worker.kill());

  const responsePromise = readWorkerLine(worker);
  worker.stdin.write(`${JSON.stringify({
    id: 1,
    method: "getGitOutput",
    request: {
      repositoryPath: "C:\\repo"
    }
  })}\n`);

  const response = await responsePromise;
  assert.equal(response.id, 1);
  assert.equal(response.ok, true);
  assert.equal(response.result.ok, true);
  assert.equal(response.result.repositoryId, "repo:c:\\repo");
  assert.deepEqual(response.result.operations.running, []);
});

test("desktop bridge script loads before the main renderer", () => {
  const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
  assert.ok(
    html.indexOf('src="src/desktop-bridge.js"') < html.indexOf('src="src/main.js"'),
    "desktop bridge must load before main.js resolves runtime facades"
  );
});

function createRecordingQueue() {
  return {
    requests: [],
    enqueue(request) {
      this.requests.push(request);
      return {
        promise: Promise.resolve({
          ok: true,
          action: request.action,
          args: [request.action],
          stdout: "",
          stderr: "",
          exitCode: 0,
          error: null
        })
      };
    },
    getRepositoryState(repositoryId) {
      return {
        repositoryId,
        running: [],
        queued: [],
        completed: [],
        lastCompleted: null
      };
    }
  };
}

function createPublishingQueue() {
  return {
    requests: [],
    enqueue(request) {
      this.requests.push(request);
      return {
        promise: Promise.resolve(publishingGitResult(request))
      };
    },
    getRepositoryState(repositoryId) {
      return {
        repositoryId,
        running: [],
        queued: [],
        completed: [],
        lastCompleted: null
      };
    }
  };
}

function publishingGitResult(request) {
  const base = {
    ok: true,
    action: request.action,
    args: [request.action],
    stdout: "",
    stderr: "",
    exitCode: 0,
    error: null,
    options: request.options || {}
  };
  if (request.action === "status") {
    return {
      ...base,
      stdout: "## main\n"
    };
  }
  return base;
}

function createRecordingTokenStore() {
  return {
    record: null,
    async read() {
      return this.record ? { ...this.record, scopes: [...this.record.scopes] } : null;
    },
    async write(record) {
      this.record = {
        token: record.token,
        login: record.login,
        scopes: [...record.scopes],
        tokenSource: record.tokenSource,
        lastValidatedAt: record.lastValidatedAt
      };
    },
    async delete() {
      this.record = null;
    }
  };
}

function readWorkerLine(worker) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for desktop bridge worker response."));
    }, 5000);

    worker.once("error", reject);
    worker.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      clearTimeout(timeout);
      resolve(JSON.parse(buffer.slice(0, newline)));
    });
  });
}
