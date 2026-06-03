"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  RepositoryStatusWatcher,
  classifyWatchEvent,
  resolveGitMetadataPath
} = require("../src/repository-status-watcher");

test("debounces worktree events into one repository state refresh", async (t) => {
  const repositoryPath = createRepositoryFixture(t);
  const fakeWatch = createFakeWatch(fs);
  const scheduler = createManualScheduler();
  const loads = [];
  const states = [];
  const watcher = new RepositoryStatusWatcher({
    fsModule: fakeWatch.fsModule,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
    debounceMs: 25,
    loadState: async (request) => {
      loads.push(request);
      return { kind: "git-repository", path: request.repositoryPath };
    },
    now: createClock()
  });

  const handle = watcher.watchRepository({
    repositoryId: "repo-a",
    repositoryPath,
    onState: (state) => states.push(state)
  });
  t.after(() => handle.close());

  assert.ok(fakeWatch.watchedPaths().includes(repositoryPath));
  fakeWatch.emit(repositoryPath, "change", "src/app.js");
  fakeWatch.emit(repositoryPath, "change", "README.md");

  assert.equal(loads.length, 0);
  scheduler.runNext();
  await flushPromises();

  assert.equal(loads.length, 1);
  assert.equal(states.length, 1);
  assert.deepEqual(loads[0].refreshReasons, ["worktree"]);
  assert.equal(handle.getSnapshot().refreshCount, 1);
  assert.equal(handle.getSnapshot().coalescedEventCount, 1);
});

test("ignores irrelevant watcher events instead of blindly refreshing", () => {
  const repositoryPath = "C:\\work\\repo";

  assert.equal(
    classifyWatchEvent({
      pathModule: path.win32,
      target: { kind: "worktree", path: repositoryPath },
      eventType: "change",
      fileName: ".git\\index"
    }),
    null
  );
  assert.equal(
    classifyWatchEvent({
      pathModule: path.win32,
      target: { kind: "git-metadata", path: `${repositoryPath}\\.git` },
      eventType: "change",
      fileName: "logs\\HEAD"
    }),
    null
  );
  assert.equal(
    classifyWatchEvent({
      pathModule: path.win32,
      target: { kind: "git-metadata", path: `${repositoryPath}\\.git` },
      eventType: "change",
      fileName: "HEAD"
    }),
    "branch"
  );
  assert.equal(
    classifyWatchEvent({
      pathModule: path.win32,
      target: { kind: "git-metadata", path: `${repositoryPath}\\.git` },
      eventType: "change",
      fileName: "index"
    }),
    "git-index"
  );
});

test("defers refresh while a non-refresh git operation is running", async (t) => {
  const repositoryPath = createRepositoryFixture(t);
  const fakeWatch = createFakeWatch(fs);
  const scheduler = createManualScheduler();
  const loads = [];
  let operations = {
    running: [{ id: "op-1", kind: "commit", priority: "normal" }],
    queued: [],
    completed: [],
    lastCompleted: null
  };
  const watcher = new RepositoryStatusWatcher({
    fsModule: fakeWatch.fsModule,
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
    debounceMs: 10,
    busyRetryMs: 20,
    loadState: async (request) => {
      loads.push(request);
      return { kind: "git-repository", path: request.repositoryPath };
    },
    now: createClock()
  });

  const handle = watcher.watchRepository({
    repositoryId: "repo-a",
    repositoryPath,
    operationsProvider: () => operations
  });
  t.after(() => handle.close());

  fakeWatch.emit(repositoryPath, "change", "tracked.js");
  scheduler.runNext();
  await flushPromises();

  assert.equal(loads.length, 0);
  assert.equal(handle.getSnapshot().status, "deferred");
  assert.equal(handle.getSnapshot().deferredBecauseBusy, true);

  operations = {
    running: [],
    queued: [],
    completed: operations.running,
    lastCompleted: operations.running[0]
  };
  scheduler.runNext();
  await flushPromises();

  assert.equal(loads.length, 1);
  assert.equal(handle.getSnapshot().status, "idle");
  assert.equal(handle.getSnapshot().deferredBecauseBusy, false);
});

test("resolves git metadata path for linked worktree gitdir files", (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-watch-gitdir-"));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const repositoryPath = path.join(tempRoot, "worktree");
  const gitDir = path.join(tempRoot, "common", "worktrees", "feature");
  fs.mkdirSync(repositoryPath, { recursive: true });
  fs.mkdirSync(gitDir, { recursive: true });
  fs.writeFileSync(path.join(repositoryPath, ".git"), `gitdir: ${path.relative(repositoryPath, gitDir)}\n`);

  assert.equal(resolveGitMetadataPath({ repositoryPath }), gitDir);
});

function createRepositoryFixture(t) {
  const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "source-companion-watch-"));
  const gitPath = path.join(repositoryPath, ".git");
  fs.mkdirSync(path.join(repositoryPath, "src"), { recursive: true });
  fs.mkdirSync(path.join(gitPath, "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(gitPath, "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(gitPath, "index"), "");
  t.after(() => fs.rmSync(repositoryPath, { recursive: true, force: true }));
  return repositoryPath;
}

function createFakeWatch(realFs) {
  const watchers = [];
  const fsModule = {
    statSync: realFs.statSync,
    existsSync: realFs.existsSync,
    readFileSync: realFs.readFileSync,
    watch(targetPath, options, callback) {
      const watcher = {
        targetPath,
        options,
        callback,
        closed: false,
        close() {
          watcher.closed = true;
        }
      };
      watchers.push(watcher);
      return watcher;
    }
  };

  return {
    fsModule,
    emit(targetPath, eventType, fileName) {
      watchers
        .filter((watcher) => watcher.targetPath === targetPath && !watcher.closed)
        .forEach((watcher) => watcher.callback(eventType, fileName));
    },
    watchedPaths() {
      return watchers.map((watcher) => watcher.targetPath);
    }
  };
}

function createManualScheduler() {
  let id = 0;
  const timers = [];

  return {
    setTimeout(callback, delay) {
      const timer = { id: ++id, callback, delay, active: true };
      timers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.active = false;
    },
    runNext() {
      const timer = timers.find((item) => item.active);
      assert.ok(timer, "expected a scheduled timer");
      timer.active = false;
      timer.callback();
    }
  };
}

function createClock() {
  let tick = 0;
  return () => `2026-06-03T00:01:${String(tick++).padStart(2, "0")}.000Z`;
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}
