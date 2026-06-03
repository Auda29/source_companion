"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { GitOperationQueue } = require("../src/git-operation-queue");

test("serializes operations within one repository", async () => {
  const executor = createControlledExecutor();
  const queue = new GitOperationQueue({
    execute: executor.execute,
    now: createClock(),
    createId: createSequenceId()
  });

  const first = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "status"
  });
  const second = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "diff"
  });

  assert.deepEqual(executor.startedActions(), ["status"]);
  assert.deepEqual(queue.getRepositoryState("repo-a").queued.map((operation) => operation.action), ["diff"]);

  executor.resolveNext({ ok: true, action: "status" });
  await first.promise;

  assert.deepEqual(executor.startedActions(), ["status", "diff"]);
  assert.equal(queue.getRepositoryState("repo-a").lastCompleted.status, "succeeded");

  executor.resolveNext({ ok: true, action: "diff" });
  await second.promise;

  assert.equal(queue.getRepositoryState("repo-a").running.length, 0);
  assert.deepEqual(
    queue.getRepositoryState("repo-a").completed.map((operation) => operation.status),
    ["succeeded", "succeeded"]
  );
});

test("allows operations in different repositories to run in parallel", () => {
  const executor = createControlledExecutor();
  const queue = new GitOperationQueue({
    execute: executor.execute,
    now: createClock(),
    createId: createSequenceId()
  });

  queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "fetch"
  });
  queue.enqueue({
    repositoryId: "repo-b",
    repositoryPath: "C:\\work\\repo-b",
    action: "status"
  });

  assert.deepEqual(executor.startedActions(), ["fetch", "status"]);
  assert.equal(queue.getRepositoryState("repo-a").running[0].action, "fetch");
  assert.equal(queue.getRepositoryState("repo-b").running[0].action, "status");
});

test("tracks failed and aborted operations distinctly", async () => {
  const executor = createControlledExecutor();
  const queue = new GitOperationQueue({
    execute: executor.execute,
    now: createClock(),
    createId: createSequenceId()
  });

  const failing = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "pull"
  });
  const queuedAbort = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "push"
  });

  assert.equal(queuedAbort.abort(), true);
  const abortedResult = await queuedAbort.promise;

  assert.equal(abortedResult.error.kind, "aborted");
  assert.equal(queue.getRepositoryState("repo-a").lastCompleted.status, "aborted");

  executor.resolveNext({
    ok: false,
    action: "pull",
    error: { kind: "git-error", message: "Git command failed." }
  });
  const failedResult = await failing.promise;

  assert.equal(failedResult.ok, false);
  assert.equal(queue.getRepositoryState("repo-a").lastCompleted.status, "failed");
  assert.deepEqual(
    queue.getRepositoryState("repo-a").completed.map((operation) => operation.status),
    ["aborted", "failed"]
  );
});

test("marks a running operation as aborted when its controller is cancelled", async () => {
  const executor = createControlledExecutor();
  const queue = new GitOperationQueue({
    execute: executor.execute,
    now: createClock(),
    createId: createSequenceId()
  });

  const running = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "fetch"
  });

  assert.equal(queue.getRepositoryState("repo-a").running[0].action, "fetch");
  assert.equal(running.abort(), true);
  assert.equal(executor.startedRequests()[0].signal.aborted, true);

  executor.resolveNext({ ok: true, action: "fetch" });
  const result = await running.promise;

  assert.equal(result.ok, false);
  assert.equal(result.error.kind, "aborted");
  assert.equal(queue.getRepositoryState("repo-a").lastCompleted.status, "aborted");
});

test("prioritizes refresh operations ahead of normal queued work", async () => {
  const executor = createControlledExecutor();
  const queue = new GitOperationQueue({
    execute: executor.execute,
    now: createClock(),
    createId: createSequenceId()
  });

  const running = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "commit"
  });
  const normal = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "push"
  });
  const refresh = queue.enqueue({
    repositoryId: "repo-a",
    repositoryPath: "C:\\work\\repo-a",
    action: "status",
    kind: "status-refresh",
    priority: "refresh"
  });

  assert.deepEqual(queue.getRepositoryState("repo-a").queued.map((operation) => operation.action), ["status", "push"]);

  executor.resolveNext({ ok: true, action: "commit" });
  await running.promise;

  assert.deepEqual(executor.startedActions(), ["commit", "status"]);

  executor.resolveNext({ ok: true, action: "status" });
  await refresh.promise;
  executor.resolveNext({ ok: true, action: "push" });
  await normal.promise;

  assert.deepEqual(
    queue.getRepositoryState("repo-a").completed.map((operation) => operation.action),
    ["commit", "status", "push"]
  );
});

function createControlledExecutor() {
  const started = [];
  const pending = [];

  return {
    execute(request) {
      started.push(request);
      return new Promise((resolve) => {
        pending.push(resolve);
      });
    },
    resolveNext(result) {
      const resolve = pending.shift();
      assert.ok(resolve, "expected a pending operation");
      resolve({
        stdout: "",
        stderr: "",
        exitCode: result.ok ? 0 : 1,
        error: null,
        ...result
      });
    },
    startedActions() {
      return started.map((request) => request.action);
    },
    startedRequests() {
      return started;
    }
  };
}

function createClock() {
  let tick = 0;
  return () => `2026-06-03T00:00:${String(tick++).padStart(2, "0")}.000Z`;
}

function createSequenceId() {
  let id = 0;
  return (repositoryId, action) => `${repositoryId}:${action}:${++id}`;
}
