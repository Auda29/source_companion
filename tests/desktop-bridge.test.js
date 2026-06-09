"use strict";

const assert = require("node:assert/strict");
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

test("desktop bridge exposes only repository source-control methods", () => {
  assert.deepEqual(DESKTOP_BRIDGE_METHODS, [
    "openRepository",
    "loadRepositoryState",
    "loadFileDiff",
    "runFileAction",
    "runHunkAction",
    "runCommitAction",
    "runBranchAction",
    "runSyncAction",
    "runStashAction",
    "getGitOutput"
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "runGitCommand"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "runShellCommand"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(DESKTOP_BRIDGE_COMMANDS, "readFile"), false);
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
      repositoryPath: "C:\\repo",
      action: "commit",
      message: "Initial commit"
    }
  }]);
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
