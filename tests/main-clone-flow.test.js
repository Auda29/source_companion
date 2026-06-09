"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("clone dialog passes the entered folder as the final clone target", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const cloneForm = new FakeForm("clone", {
    url: "https://github.com/owner/repo.git",
    target: "C:\\code\\custom-name"
  });
  const document = new FakeDocument([cloneForm]);
  let cloneRequest = null;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionRepositoryCloneActions: {
        runCloneAction: (request) => {
          cloneRequest = request;
          return {
            ok: false,
            action: "clone",
            command: null,
            stdout: "",
            stderr: "",
            exitCode: null,
            message: "Stopped by test.",
            error: {
              kind: "test-stop",
              message: "Stopped by test."
            }
          };
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await cloneForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });

  assert.equal(cloneRequest.url, "https://github.com/owner/repo.git");
  assert.equal(cloneRequest.targetPath, "C:\\code\\custom-name");
});

test("github clone dialog starts clone with selected repository clone URL", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const githubForm = new FakeForm("github", {
    name: "octo/source-companion",
    target: "C:\\code\\source-companion"
  });
  const document = new FakeDocument([githubForm]);
  let cloneRequest = null;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionRepositoryCloneActions: {
        runCloneAction: (request) => {
          cloneRequest = request;
          return {
            ok: false,
            action: "clone",
            command: null,
            stdout: "",
            stderr: "",
            exitCode: null,
            message: "Stopped by test.",
            error: {
              kind: "test-stop",
              message: "Stopped by test."
            }
          };
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });

  const githubDialog = document.getElementById("githubDialog");
  githubDialog.listeners.click({
    target: new FakeDatasetTarget({
      githubRepoName: "octo/source-companion",
      githubRepoCloneUrl: "https://github.com/octo/source-companion.git"
    })
  });

  await githubForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });

  assert.equal(cloneRequest.url, "https://github.com/octo/source-companion.git");
  assert.equal(cloneRequest.targetPath, "C:\\code\\source-companion");
});

test("publish dialog prepares preflight without starting publish", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const publishForm = new FakeForm("publish", {
    path: "C:\\code\\project",
    name: "project",
    description: "Focused source control",
    visibility: "private",
    initIfNeeded: "on"
  });
  const document = new FakeDocument([publishForm]);
  let preflightRequest = null;
  let publishStarted = false;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionGitHubClientInstance: {
        getAuthStatus: async () => ({
          authenticated: true,
          user: "octo"
        })
      },
      SourceCompanionRepositoryPublishActions: {
        preparePublishPreflight: (request) => {
          preflightRequest = request;
          return {
            ok: true,
            action: "publish-preflight",
            request,
            command: null,
            checks: [],
            stdout: "",
            stderr: "",
            exitCode: null,
            message: "Ready to publish.",
            error: null
          };
        },
        runPublishAction: () => {
          publishStarted = true;
          throw new Error("publish runner should not start during preflight");
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await publishForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });

  assert.equal(preflightRequest.repositoryPath, "C:\\code\\project");
  assert.equal(preflightRequest.name, "project");
  assert.equal(preflightRequest.description, "Focused source control");
  assert.equal(preflightRequest.visibility, "private");
  assert.equal(preflightRequest.initIfNeeded, true);
  assert.equal(preflightRequest.publicConfirmed, false);
  assert.equal(publishStarted, false);
});

test("publish preflight output stays visible with remote overwrite warning", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const publishForm = new FakeForm("publish", {
    path: "C:\\code\\project",
    name: "project",
    description: "",
    visibility: "private",
    initIfNeeded: ""
  });
  const document = new FakeDocument([publishForm]);

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionGitHubClientInstance: {
        getAuthStatus: async () => ({
          authenticated: true,
          user: "octo"
        })
      },
      SourceCompanionRepositoryPublishActions: {
        preparePublishPreflight: (request) => ({
          ok: false,
          action: "publish-preflight",
          request,
          command: null,
          checks: [
            {
              id: "remote-inspection",
              label: "Remote configuration",
              ok: true,
              message: "Existing remotes were inspected."
            }
          ],
          remotes: ["origin"],
          stdout: "",
          stderr: "",
          exitCode: null,
          message: "This repository already has a remote. Review the remote before publishing.",
          error: {
            kind: "remote-already-configured",
            message: "Existing remotes must be reviewed before publishing."
          }
        }),
        runPublishAction: () => {
          throw new Error("publish runner should not start during preflight");
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await publishForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });

  const workspace = document.getElementById("workspaceContent").innerHTML;
  assert.match(workspace, /Git Output/);
  assert.match(workspace, /Publish preflight/);
  assert.match(workspace, /remote-already-configured/);
  assert.match(workspace, /will not overwrite or replace remotes automatically/);
});

test("repository workspace renders collapsed history panel from repository state", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const openForm = new FakeForm("open", {
    path: "C:\\code\\project"
  });
  const document = new FakeDocument([openForm]);

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionRepositoryState: {
        loadRepositoryState: async () => ({
          kind: "git-repository",
          health: "ready",
          error: null,
          operations: {
            running: [],
            queued: [],
            completed: [],
            lastCompleted: null
          },
          github: null,
          git: {
            branch: { name: "main", detached: false, headSha: "abc123456789" },
            remote: { name: "origin", kind: "github" },
            remotes: [],
            upstream: { name: "origin/main" },
            divergence: { ahead: 1, behind: 2 },
            files: [],
            staged: [],
            unstaged: [],
            untracked: [],
            conflicted: [],
            stashes: [],
            history: {
              status: "ready",
              message: "1 commit loaded.",
              commits: [{
                hash: "abc123456789",
                shortHash: "abc1234",
                author: "Test User",
                authoredAt: "2026-06-09T10:00:00+02:00",
                subject: "Render history"
              }],
              head: {
                hash: "abc123456789",
                shortHash: "abc1234",
                author: "Test User",
                authoredAt: "2026-06-09T10:00:00+02:00",
                subject: "Render history"
              },
              selectedCommit: null,
              selectedDiff: "diff --git a/README.md b/README.md\n+hello",
              error: null
            }
          }
        })
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await openForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });
  await new Promise((resolve) => setImmediate(resolve));

  const workspace = document.getElementById("workspaceContent").innerHTML;
  assert.match(workspace, /Graph \/ History/);
  assert.match(workspace, /origin\/main/);
  assert.match(workspace, /1 ahead, 2 behind/);
  assert.match(workspace, /Render history/);
  assert.match(workspace, /HEAD commit diff: abc1234/);
});

test("repository workspace loads and links existing pull request for current branch", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const openForm = new FakeForm("open", {
    path: "C:\\code\\project"
  });
  const document = new FakeDocument([openForm]);
  let requestedBranch = null;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionGitHubClientInstance: {
        getAuthStatus: async () => ({
          authenticated: true,
          user: "octo"
        }),
        listPullRequests: async (options) => {
          requestedBranch = options.branch;
          return {
            ok: true,
            pullRequests: [{
              number: 4,
              title: "Add PR UI",
              state: "open",
              htmlUrl: "https://github.com/octo/source-companion/pull/4",
              head: { ref: "feature/pr-ui" },
              base: { ref: "main" }
            }]
          };
        }
      },
      SourceCompanionRepositoryState: {
        loadRepositoryState: async () => repositoryStateWithGitHub()
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await openForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const workspace = document.getElementById("workspaceContent").innerHTML;
  assert.equal(requestedBranch, "feature/pr-ui");
  assert.match(workspace, /GitHub Pull Request/);
  assert.match(workspace, /octo\/source-companion via origin/);
  assert.match(workspace, /#4 Add PR UI/);
  assert.match(workspace, /https:\/\/github\.com\/octo\/source-companion\/pull\/4/);
  assert.match(workspace, /GitHub PR lookup/);
});

test("repository workspace creates pull request with visible base and head", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const openForm = new FakeForm("open", {
    path: "C:\\code\\project"
  });
  const prForm = new FakeForm("pr", {
    base: "main",
    title: "Add PR UI",
    description: "Connects branch PR creation."
  });
  const workspaceElement = new FakeWorkspaceElement(prForm);
  const document = new FakeDocument([openForm], {
    workspaceContent: workspaceElement
  });
  let createRequest = null;

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      SourceCompanionGitHubClientInstance: {
        getAuthStatus: async () => ({
          authenticated: true,
          user: "octo"
        }),
        listPullRequests: async () => ({
          ok: true,
          pullRequests: []
        }),
        createPullRequest: async (options) => {
          createRequest = options;
          return {
            ok: true,
            pullRequest: {
              number: 5,
              title: options.title,
              state: "open",
              htmlUrl: "https://github.com/octo/source-companion/pull/5",
              head: { ref: options.head },
              base: { ref: options.base }
            }
          };
        }
      },
      SourceCompanionRepositoryState: {
        loadRepositoryState: async () => repositoryStateWithGitHub()
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await openForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  await prForm.listeners.submit({
    preventDefault() {}
  });
  await new Promise((resolve) => setImmediate(resolve));

  const workspace = document.getElementById("workspaceContent").innerHTML;
  assert.equal(createRequest.owner, "octo");
  assert.equal(createRequest.repo, "source-companion");
  assert.equal(createRequest.base, "main");
  assert.equal(createRequest.head, "feature/pr-ui");
  assert.equal(createRequest.title, "Add PR UI");
  assert.equal(createRequest.description, "Connects branch PR creation.");
  assert.equal(createRequest.draft, false);
  assert.match(workspace, /head: feature\/pr-ui \/ base: main/);
  assert.match(workspace, /#5 Add PR UI/);
  assert.match(workspace, /GitHub PR create/);
});

function repositoryStateWithGitHub() {
  return {
    kind: "github-authenticated",
    health: "ready",
    error: null,
    operations: {
      running: [],
      queued: [],
      completed: [],
      lastCompleted: null
    },
    github: {
      status: "ready",
      owner: "octo",
      name: "source-companion",
      repository: "source-companion",
      fullName: "octo/source-companion",
      remote: "origin",
      remoteName: "origin",
      htmlUrl: "https://github.com/octo/source-companion",
      authenticated: true,
      user: "octo"
    },
    git: {
      branch: { name: "feature/pr-ui", detached: false, headSha: "abc123456789" },
      remote: { name: "origin", kind: "github" },
      remotes: [],
      upstream: { name: "origin/main" },
      divergence: { ahead: 1, behind: 0 },
      files: [],
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
      stashes: [],
      history: {
        status: "empty",
        message: "No commits.",
        commits: [],
        head: null,
        selectedCommit: null,
        selectedDiff: "",
        error: null
      }
    }
  };
}

class FakeStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

class FakeFormData {
  constructor(form) {
    this.values = form.values;
  }

  get(name) {
    return this.values[name] || "";
  }
}

class FakeElement {
  constructor() {
    this.dataset = {};
    this.listeners = {};
    this.children = [];
    this.className = "";
    this.type = "";
    this.value = "";
    this._innerHTML = "";
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  appendChild(child) {
    this.children.push(child);
  }

  querySelector() {
    return new FakeElement();
  }

  querySelectorAll() {
    return [];
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

class FakeWorkspaceElement extends FakeElement {
  constructor(prForm) {
    super();
    this.prForm = prForm;
  }

  querySelectorAll(selector) {
    if (selector === "[data-pr-form]" && this.innerHTML.includes("data-pr-form")) {
      return [this.prForm];
    }
    return [];
  }
}

class FakeDatasetTarget {
  constructor(dataset) {
    this.dataset = dataset;
  }

  closest(selector) {
    if (selector === "[data-github-repo-name]") return this;
    return null;
  }
}

class FakeForm extends FakeElement {
  constructor(flow, values) {
    super();
    this.dataset = { flow };
    this.values = values;
    this.resetCount = 0;
    this.closed = false;
  }

  reset() {
    this.resetCount += 1;
  }

  closest(selector) {
    assert.equal(selector, "dialog");
    return {
      close: () => {
        this.closed = true;
      }
    };
  }
}

class FakeDocument {
  constructor(forms, elements = {}) {
    this.forms = forms;
    this.elements = new Map();
    Object.entries(elements).forEach(([id, element]) => {
      this.elements.set(id, element);
    });
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      this.elements.set(id, new FakeElement());
    }
    return this.elements.get(id);
  }

  querySelectorAll(selector) {
    if (selector === ".dialog-body") return this.forms;
    return [];
  }

  createElement() {
    return new FakeElement();
  }
}
