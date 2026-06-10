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

test("desktop folder picker fills clone target field", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const cloneForm = new FakeForm("clone", {
    url: "https://github.com/owner/repo.git",
    target: ""
  });
  const browseButton = new FakeElement();
  browseButton.dataset = { folderDialog: "clone" };
  browseButton.closest = () => cloneForm;
  const document = new FakeDocument([cloneForm], {}, [browseButton]);

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
      SourceCompanionDesktopBridge: {
        pickCloneTargetFolder: async () => ({
          ok: true,
          canceled: false,
          path: "C:\\code\\picked-repo"
        })
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  browseButton.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(cloneForm.getInput("target").value, "C:\\code\\picked-repo");
});

test("tauri global bridge enables github login in the desktop clone dialog", async () => {
  const desktopBridgeScript = fs.readFileSync(path.join(__dirname, "..", "src", "desktop-bridge.js"), "utf8");
  const githubClientScript = fs.readFileSync(path.join(__dirname, "..", "src", "github-api-client.js"), "utf8");
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const githubForm = new FakeForm("github", {
    name: "",
    target: ""
  });
  const loginButton = new FakeElement();
  loginButton.dataset = { githubAuthAction: "login" };
  const githubDialog = new FakeDialog([loginButton]);
  const githubAuthStatus = new FakeElement();
  const document = new FakeDocument([githubForm], {
    githubDialog,
    githubAuthStatus,
    githubRepoList: new FakeElement()
  });
  const commands = [];

  const context = {
    document,
    localStorage: new FakeStorage(),
    FormData: FakeFormData,
    crypto: { randomUUID: () => "repo-1" },
    Date,
    Error,
    String,
    Array,
    Boolean,
    Number,
    RegExp,
    window: {
      confirm: () => true,
      __TAURI__: {
        core: {
          invoke: async (command, payload) => {
            commands.push({ command, payload });
            if (command === "github_get_auth_status") {
              return {
                authenticated: false,
                user: null,
                error: null
              };
            }
            if (command === "github_login") {
              return {
                authenticated: false,
                user: null,
                error: {
                  kind: "github-login-unavailable",
                  message: "GitHub OAuth client ID is not configured for desktop login."
                }
              };
            }
            throw new Error(`Unexpected command: ${command}`);
          }
        }
      }
    }
  };

  vm.runInNewContext(desktopBridgeScript, context, { filename: "src/desktop-bridge.js" });
  vm.runInNewContext(githubClientScript, context, { filename: "src/github-api-client.js" });
  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(typeof context.window.SourceCompanionDesktopBridge.loginGitHub, "function");
  assert.match(githubAuthStatus.innerHTML, /Not logged in/);
  assert.doesNotMatch(githubAuthStatus.innerHTML, /GitHub login is not available in this runtime/);

  githubDialog.listeners.click({
    target: new FakeDatasetTarget({ githubAuthAction: "login" })
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(commands.map((call) => call.command), [
    "github_get_auth_status",
    "github_login"
  ]);
  assert.match(githubAuthStatus.innerHTML, /GitHub OAuth client ID is not configured for desktop login/);
  assert.doesNotMatch(githubAuthStatus.innerHTML, /GitHub login is not available in this runtime/);
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

test("desktop publish preflight uses bridge request without renderer GitHub client", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const publishForm = new FakeForm("publish", {
    path: "C:\\code\\project",
    name: "project",
    description: "Focused source control",
    visibility: "public",
    initIfNeeded: "on"
  });
  const document = new FakeDocument([publishForm]);
  let preflightRequest = null;

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
          user: "octo",
          token: "must-not-cross-renderer-request"
        })
      },
      SourceCompanionDesktopBridge: {
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
  assert.equal(preflightRequest.visibility, "public");
  assert.equal(preflightRequest.initIfNeeded, true);
  assert.equal(preflightRequest.publicConfirmed, true);
  assert.equal(Object.prototype.hasOwnProperty.call(preflightRequest, "githubClient"), false);
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

test("publish git output formats repository metadata and sanitizes auth URLs", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const publishForm = new FakeForm("publish", {
    path: "C:\\code\\project",
    name: "project",
    description: "",
    visibility: "public",
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
          ok: true,
          action: "publish",
          request,
          repository: {
            owner: "octo",
            name: "project",
            fullName: "octo/project",
            visibility: "public",
            htmlUrl: "https://token-value@github.com/octo/project"
          },
          command: {
            display: "git remote add origin https://token-value@github.com/octo/project.git",
            args: []
          },
          checks: [],
          stdout: "created https://token-value@github.com/octo/project",
          stderr: "",
          exitCode: 0,
          message: "project was published to GitHub.",
          error: null
        }),
        runPublishAction: () => {
          throw new Error("publish runner should not start during formatter test");
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
  assert.match(workspace, /Repository: octo\/project \/ public \/ https:\/\/github\.com\/octo\/project/);
  assert.match(workspace, /git remote add origin https:\/\/github\.com\/octo\/project\.git/);
  assert.match(workspace, /created https:\/\/github\.com\/octo\/project/);
  assert.doesNotMatch(workspace, /\[object Object\]/);
  assert.doesNotMatch(workspace, /token-value@/);
});

test("publish error output keeps technical details without auth-bearing remote URLs", async () => {
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
          action: "publish",
          request,
          repository: {
            owner: "octo",
            name: "project",
            visibility: "private",
            cloneUrl: "https://token-value@github.com/octo/project.git"
          },
          command: {
            display: "git push --set-upstream origin main",
            args: []
          },
          checks: [],
          stdout: "",
          stderr: "fatal: authentication failed for https://token-value@github.com/octo/project.git",
          exitCode: 128,
          message: "Git authentication or permission failed while publishing.",
          error: {
            kind: "git-auth-error",
            message: "Authentication failed for https://token-value@github.com/octo/project.git"
          }
        }),
        runPublishAction: () => {
          throw new Error("publish runner should not start during formatter test");
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
  assert.match(workspace, /git-auth-error: Authentication failed for https:\/\/github\.com\/octo\/project\.git/);
  assert.match(workspace, /fatal: authentication failed for https:\/\/github\.com\/octo\/project\.git/);
  assert.match(workspace, /Repository: octo\/project \/ private \/ https:\/\/github\.com\/octo\/project\.git/);
  assert.doesNotMatch(workspace, /token-value@/);
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

test("source control toolbar switches view modes and refreshes repository state", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const openForm = new FakeForm("open", {
    path: "C:\\code\\project"
  });
  const refreshButton = new FakeElement();
  refreshButton.dataset = { sourceControlAction: "refresh" };
  const diffViewButton = new FakeElement();
  diffViewButton.dataset = { sourceControlView: "diff" };
  const workspaceElement = new FakeToolbarWorkspaceElement({
    actionButtons: [refreshButton],
    viewButtons: [diffViewButton]
  });
  const document = new FakeDocument([openForm], {
    workspaceContent: workspaceElement
  });
  let loadCount = 0;

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
        loadRepositoryState: async () => {
          loadCount += 1;
          return {
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
              divergence: { ahead: 0, behind: 0 },
              files: [],
              staged: [],
              unstaged: [{ path: "src/app.js", status: " M", type: "modified" }],
              untracked: [],
              conflicted: [],
              stashes: [],
              history: {
                status: "ready",
                message: "No commits loaded.",
                commits: [],
                head: null,
                selectedCommit: null,
                selectedDiff: "",
                error: null
              }
            }
          };
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await openForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(workspaceElement.innerHTML, /source-control-toolbar/);
  assert.match(workspaceElement.innerHTML, /source-control-layout view-split/);
  assert.match(workspaceElement.innerHTML, /data-source-control-view="diff"/);

  diffViewButton.listeners.click();
  assert.match(workspaceElement.innerHTML, /source-control-layout view-diff/);

  refreshButton.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loadCount, 2);
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
              head: { ref: "feature/pr-ui", sha: "abc123" },
              base: { ref: "main" }
            }]
          };
        },
        loadPullRequestChecks: async (options) => {
          assert.equal(options.ref, "abc123");
          return {
            ok: true,
            state: "success",
            summary: "Checks passing.",
            statuses: [{
              name: "legacy-ci",
              state: "success",
              description: "Legacy status passed",
              detailsUrl: "https://ci.example/status/20"
            }],
            checks: [{
              name: "build",
              state: "success",
              description: "Build passed",
              detailsUrl: "https://github.com/octo/source-companion/actions/runs/21"
            }]
          };
        },
        loadPullRequestReviewContext: async (options) => {
          assert.equal(options.pullNumber, 4);
          assert.equal(options.branch, "feature/pr-ui");
          assert.deepEqual(options.commitMessages, ["Fixes #42"]);
          return {
            ok: true,
            summary: "1 review comment; 1 issue link.",
            reviewComments: [{
              path: "src/main.js",
              line: 108,
              body: "Handle missing review context.",
              author: "reviewer",
              htmlUrl: "https://github.com/octo/source-companion/pull/4#discussion_r30",
              updatedAt: "2026-06-09T08:50:00Z"
            }],
            issueLinks: [{
              number: 42,
              title: "Improve PR context",
              state: "open",
              status: "found",
              htmlUrl: "https://github.com/octo/source-companion/issues/42"
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
  assert.match(workspace, /Checks passing/);
  assert.match(workspace, /legacy-ci/);
  assert.match(workspace, /build/);
  assert.match(workspace, /https:\/\/github\.com\/octo\/source-companion\/actions\/runs\/21/);
  assert.match(workspace, /Review context/);
  assert.match(workspace, /src\/main\.js:108/);
  assert.match(workspace, /Handle missing review context/);
  assert.match(workspace, /#42/);
  assert.match(workspace, /Improve PR context/);
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

test("floating window renders active repository and uses shared commit and sync runners", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const openForm = new FakeForm("open", {
    path: "C:\\code\\project"
  });
  const workspaceElement = new FakeFloatingWorkspaceElement();
  const document = new FakeDocument([openForm], {
    workspaceContent: workspaceElement
  });
  let commitRequest = null;
  let syncRequest = null;

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
      SourceCompanionInitialMode: "floating",
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
            divergence: { ahead: 1, behind: 0 },
            files: [],
            staged: [{ path: "src/app.js", status: "M ", type: "modified" }],
            unstaged: [{ path: "README.md", status: " M", type: "modified" }],
            untracked: [{ path: "notes.txt", status: "??", type: "untracked" }],
            conflicted: [],
            stashes: [],
            history: {
              status: "ready",
              message: "No commits loaded.",
              commits: [],
              head: null,
              selectedCommit: null,
              selectedDiff: "",
              error: null
            }
          }
        })
      },
      SourceCompanionRepositoryCommitActions: {
        runCommitAction: async (request) => {
          commitRequest = request;
          return {
            ok: true,
            action: request.action,
            command: { display: "git commit", args: [] },
            stdout: "",
            stderr: "",
            exitCode: 0,
            message: "Commit completed.",
            error: null
          };
        }
      },
      SourceCompanionRepositorySyncActions: {
        runSyncAction: async (request) => {
          syncRequest = request;
          return {
            ok: true,
            action: request.action,
            command: { display: "git push", args: [] },
            stdout: "",
            stderr: "",
            exitCode: 0,
            message: "Push completed.",
            error: null
          };
        }
      }
    }
  };

  vm.runInNewContext(mainScript, context, { filename: "src/main.js" });
  await openForm.listeners.submit({
    preventDefault() {},
    submitter: { value: "default" }
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(workspaceElement.innerHTML, /floating-window/);
  assert.match(workspaceElement.innerHTML, /main \/ origin\/main \/ 1 ahead, 0 behind/);
  assert.match(workspaceElement.innerHTML, /Changed/);
  assert.match(workspaceElement.innerHTML, /Commit and Push/);

  workspaceElement.textarea.value = "Ship compact mode";
  await workspaceElement.form.listeners.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(commitRequest.repositoryPath, "C:\\code\\project");
  assert.equal(commitRequest.action, "commit");
  assert.equal(commitRequest.message, "Ship compact mode");

  workspaceElement.textarea.value = "";
  workspaceElement.pushButton.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(syncRequest.repositoryPath, "C:\\code\\project");
  assert.equal(syncRequest.action, "push");
  assert.equal(syncRequest.message, "");
});

test("floating and full ui switching preserves active repository state", async () => {
  const mainScript = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
  const openForm = new FakeForm("open", {
    path: "C:\\code\\project"
  });
  const workspaceElement = new FakeFloatingWorkspaceElement();
  const modeButton = new FakeElement();
  const document = new FakeDocument([openForm], {
    workspaceContent: workspaceElement,
    floatingModeButton: modeButton
  });
  const windowModeRequests = [];

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
      SourceCompanionInitialMode: "floating",
      confirm: () => true,
      SourceCompanionDesktopBridge: {
        setWindowMode: async (request) => {
          windowModeRequests.push(request);
          return { ok: true, mode: request.mode };
        }
      },
      SourceCompanionRepositoryState: {
        loadRepositoryState: async () => ({
          kind: "git-repository",
          health: "ready",
          error: null,
          operations: {
            running: [{ kind: "push", status: "running" }],
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
            divergence: { ahead: 1, behind: 0 },
            files: [],
            staged: [{ path: "src/app.js", status: "M ", type: "modified" }],
            unstaged: [],
            untracked: [],
            conflicted: [],
            stashes: [],
            history: {
              status: "ready",
              message: "No commits loaded.",
              commits: [],
              head: null,
              selectedCommit: null,
              selectedDiff: "",
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

  assert.match(workspaceElement.innerHTML, /floating-window/);
  workspaceElement.textarea.value = "Preserve this message";
  workspaceElement.textarea.listeners.input();

  workspaceElement.openFullButton.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(workspaceElement.innerHTML, /repo-summary/);
  assert.match(workspaceElement.innerHTML, /C:\\code\\project/);
  assert.match(workspaceElement.innerHTML, /push running/);
  assert.match(workspaceElement.innerHTML, /Preserve this message/);
  assert.equal(modeButton.textContent, "Floating Window");

  modeButton.listeners.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.match(workspaceElement.innerHTML, /floating-window/);
  assert.match(workspaceElement.innerHTML, /Preserve this message/);
  assert.deepEqual(windowModeRequests.map((request) => ({
    mode: request.mode,
    activeRepositoryId: request.activeRepositoryId,
    activeRepositoryPath: request.activeRepositoryPath
  })), [
    {
      mode: "full",
      activeRepositoryId: "repo-1",
      activeRepositoryPath: "C:\\code\\project"
    },
    {
      mode: "floating",
      activeRepositoryId: "repo-1",
      activeRepositoryPath: "C:\\code\\project"
    }
  ]);
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
        status: "ready",
        message: "1 commit loaded.",
        commits: [{
          hash: "abc123456789",
          shortHash: "abc1234",
          author: "Ada",
          authoredAt: "2026-06-09T08:40:00Z",
          subject: "Fixes #42"
        }],
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

class FakeToolbarWorkspaceElement extends FakeElement {
  constructor({ actionButtons = [], viewButtons = [] }) {
    super();
    this.actionButtons = actionButtons;
    this.viewButtons = viewButtons;
  }

  querySelectorAll(selector) {
    if (!this.innerHTML.includes("source-control-toolbar")) return [];
    if (selector === "[data-source-control-action]") return this.actionButtons;
    if (selector === "[data-source-control-view]") return this.viewButtons;
    return [];
  }
}

class FakeFloatingWorkspaceElement extends FakeElement {
  constructor() {
    super();
    this.textarea = new FakeElement();
    this.form = new FakeElement();
    this.form.querySelector = (selector) => selector === "[data-commit-message]" ? this.textarea : null;
    this.commitAndPushButton = new FakeElement();
    this.commitAndPushButton.dataset = { floatingCommitAction: "commit-and-push" };
    this.pushButton = new FakeElement();
    this.pushButton.dataset = { floatingSyncAction: "push" };
    this.syncButton = new FakeElement();
    this.syncButton.dataset = { floatingSyncAction: "sync" };
    this.refreshButton = new FakeElement();
    this.refreshButton.dataset = { floatingAction: "refresh" };
    this.openFullButton = new FakeElement();
    this.openFullButton.dataset = { floatingAction: "open-full-ui" };
  }

  querySelector(selector) {
    if (selector === "[data-commit-message]") return this.textarea;
    return super.querySelector(selector);
  }

  querySelectorAll(selector) {
    if (!this.innerHTML.includes("floating-window")) return [];
    if (selector === "[data-floating-commit-form]") return [this.form];
    if (selector === "[data-floating-commit-action]") return [this.commitAndPushButton];
    if (selector === "[data-floating-sync-action]") return [this.pushButton, this.syncButton];
    if (selector === "[data-floating-action]") return [this.refreshButton, this.openFullButton];
    return [];
  }
}

class FakeDatasetTarget {
  constructor(dataset) {
    this.dataset = dataset;
  }

  closest(selector) {
    if (selector === "[data-github-auth-action]" && this.dataset.githubAuthAction) return this;
    if (selector === "[data-github-repo-search]" && Object.prototype.hasOwnProperty.call(this.dataset, "githubRepoSearch")) return this;
    if (selector === "[data-github-repo-name]") return this;
    return null;
  }
}

class FakeDialog extends FakeElement {
  constructor(authButtons = []) {
    super();
    this.authButtons = authButtons;
  }

  querySelectorAll(selector) {
    if (selector === "[data-github-auth-action]") return this.authButtons;
    return [];
  }

  showModal() {}
}

class FakeForm extends FakeElement {
  constructor(flow, values) {
    super();
    this.dataset = { flow };
    this.values = values;
    this.inputs = new Map(Object.entries(values).map(([name, value]) => [
      name,
      Object.assign(new FakeElement(), { value })
    ]));
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

  getInput(name) {
    if (!this.inputs.has(name)) {
      this.inputs.set(name, new FakeElement());
    }
    return this.inputs.get(name);
  }

  querySelector(selector) {
    const match = String(selector || "").match(/^input\[name="([^"]+)"\]$/);
    if (match) return this.getInput(match[1]);
    return super.querySelector(selector);
  }
}

class FakeDocument {
  constructor(forms, elements = {}, folderButtons = []) {
    this.forms = forms;
    this.folderButtons = folderButtons;
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
    if (selector === "[data-folder-dialog]") return this.folderButtons;
    return [];
  }

  createElement() {
    return new FakeElement();
  }
}
