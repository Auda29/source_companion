"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MemorySecureTokenStore,
  createGitHubBridgeClient,
  createGitHubApiClient
} = require("../src/github-api-client");

test("reports no-token auth status without reading tokens into UI state", async () => {
  const client = createGitHubApiClient({
    tokenStore: new MemorySecureTokenStore()
  });

  const status = await client.getAuthStatus();
  assert.equal(status.authenticated, false);
  assert.equal(status.user, null);
  assert.deepEqual(status.scopes, []);
  assert.equal(status.tokenSource, null);
});

test("direct API client requires an injected secure token store", async () => {
  const client = createGitHubApiClient();

  const status = await client.getAuthStatus();
  assert.equal(status.authenticated, false);
  assert.equal(status.error.kind, "secure-storage-unavailable");
});

test("renderer bridge client returns token-free auth and repository results", async () => {
  const calls = [];
  const client = createGitHubBridgeClient({
    getAuthStatus: async () => ({
      authenticated: true,
      user: "octo",
      login: "octo",
      scopes: ["repo", "read:user"],
      tokenSource: "device-flow",
      token: "must-not-leak"
    }),
    searchUserRepositories: async (options) => {
      calls.push(options);
      return {
        ok: true,
        repositories: [
          {
            id: 1,
            owner: "octo",
            name: "source-companion",
            fullName: "octo/source-companion",
            cloneUrl: "https://github.com/octo/source-companion.git",
            stars: 4,
            private: false,
            token: "must-not-leak"
          }
        ],
        token: "must-not-leak"
      };
    }
  });

  const status = await client.getAuthStatus();
  assert.equal(status.authenticated, true);
  assert.equal(status.user, "octo");
  assert.equal(status.token, undefined);

  const result = await client.searchUserRepositories({ query: "source" });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ query: "source" }]);
  assert.equal(result.token, undefined);
  assert.equal(result.repositories[0].token, undefined);
  assert.equal(result.repositories[0].owner, "octo");
  assert.equal(result.repositories[0].fullName, "octo/source-companion");
  assert.equal(result.repositories[0].cloneUrl, "https://github.com/octo/source-companion.git");
  assert.equal(result.repositories[0].stars, 4);
});

test("renderer bridge client creates repositories without exposing tokens", async () => {
  const calls = [];
  const client = createGitHubBridgeClient({
    createRepository: async (options) => {
      calls.push(options);
      return {
        ok: true,
        repository: {
          id: 3,
          owner: "octo",
          name: "published",
          fullName: "octo/published",
          private: true,
          cloneUrl: "https://github.com/octo/published.git",
          token: "must-not-leak"
        },
        token: "must-not-leak"
      };
    }
  });

  const result = await client.createRepository({
    name: "published",
    description: "Created from Source Companion",
    private: true
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{
    name: "published",
    description: "Created from Source Companion",
    private: true
  }]);
  assert.equal(result.token, undefined);
  assert.equal(result.repository.token, undefined);
  assert.equal(result.repository.fullName, "octo/published");
  assert.equal(result.repository.cloneUrl, "https://github.com/octo/published.git");
});

test("renderer bridge client handles pull requests without exposing tokens", async () => {
  const calls = [];
  const client = createGitHubBridgeClient({
    listPullRequests: async (options) => {
      calls.push(["list", options]);
      return {
        ok: true,
        pullRequests: [{
          id: 10,
          number: 4,
          title: "Add PR flow",
          state: "open",
          htmlUrl: "https://github.com/octo/source-companion/pull/4",
          token: "must-not-leak",
          head: { ref: "feature/pr", repo: { name: "source-companion", owner: { login: "octo" } } },
          base: { ref: "main", repo: { name: "source-companion", owner: { login: "octo" } } }
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
          title: "Created PR",
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
      calls.push(["review-context", options]);
      return {
        ok: true,
        summary: "1 review comment; 1 issue link.",
        reviewComments: [{
          id: 30,
          path: "src/main.js",
          body: "Handle this edge case.",
          author: "reviewer",
          htmlUrl: "https://github.com/octo/source-companion/pull/4#discussion_r30",
          token: "must-not-leak"
        }],
        issueLinks: [{
          number: 42,
          title: "Improve PR context",
          state: "open",
          htmlUrl: "https://github.com/octo/source-companion/issues/42",
          token: "must-not-leak"
        }],
        token: "must-not-leak"
      };
    }
  });

  const list = await client.listPullRequests({ owner: "octo", repo: "source-companion", branch: "feature/pr" });
  const created = await client.createPullRequest({
    owner: "octo",
    repo: "source-companion",
    base: "main",
    head: "feature/pr",
    title: "Created PR"
  });
  const checks = await client.loadPullRequestChecks({
    owner: "octo",
    repo: "source-companion",
    ref: "abc123"
  });
  const reviewContext = await client.loadPullRequestReviewContext({
    owner: "octo",
    repo: "source-companion",
    pullNumber: 4,
    branch: "feature/issue-42"
  });

  assert.equal(list.ok, true);
  assert.equal(list.token, undefined);
  assert.equal(list.pullRequests[0].token, undefined);
  assert.equal(list.pullRequests[0].number, 4);
  assert.equal(created.ok, true);
  assert.equal(created.pullRequest.token, undefined);
  assert.equal(created.pullRequest.number, 5);
  assert.equal(checks.ok, true);
  assert.equal(checks.token, undefined);
  assert.equal(checks.checks[0].token, undefined);
  assert.equal(checks.state, "success");
  assert.equal(reviewContext.ok, true);
  assert.equal(reviewContext.token, undefined);
  assert.equal(reviewContext.reviewComments[0].token, undefined);
  assert.equal(reviewContext.issueLinks[0].token, undefined);
  assert.equal(reviewContext.reviewComments[0].path, "src/main.js");
  assert.equal(reviewContext.issueLinks[0].number, 42);
  assert.deepEqual(calls.map((call) => call[0]), ["list", "create", "checks", "review-context"]);
});

test("stores device login token in secure store and returns token-free status", async () => {
  const tokenStore = new MemorySecureTokenStore();
  const client = createGitHubApiClient({
    tokenStore,
    now: () => "2026-06-09T08:00:00.000Z",
    deviceFlow: {
      startDeviceLogin: async ({ scopes }) => {
        assert.deepEqual(scopes, ["repo", "read:user"]);
        return {
          token: "secret-token",
          login: "octo",
          scopes
        };
      }
    }
  });

  const status = await client.login();
  assert.equal(status.authenticated, true);
  assert.equal(status.user, "octo");
  assert.equal(status.token, undefined);

  const stored = await tokenStore.read();
  assert.equal(stored.token, "secret-token");
  assert.equal(stored.login, "octo");
  assert.deepEqual(stored.scopes, ["repo", "read:user"]);
  assert.equal(stored.lastValidatedAt, "2026-06-09T08:00:00.000Z");
});

test("rejects login tokens missing required scopes", async () => {
  const tokenStore = new MemorySecureTokenStore();
  const client = createGitHubApiClient({
    tokenStore,
    deviceFlow: {
      startDeviceLogin: async () => ({
        token: "secret-token",
        login: "octo",
        scopes: ["read:user"]
      })
    }
  });

  const status = await client.login();
  assert.equal(status.authenticated, false);
  assert.equal(status.error.kind, "github-scope-missing");
  assert.deepEqual(status.error.scopesRequired, ["repo", "read:user"]);
  assert.deepEqual(status.error.scopesGranted, ["read:user"]);
  assert.equal(await tokenStore.read(), null);
});

test("loads and searches normalized user repositories", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  const requests = [];
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return createResponse(200, [
        {
          id: 1,
          name: "source-companion",
          full_name: "octo/source-companion",
          description: "Focused source control",
          private: true,
          visibility: "private",
          stargazers_count: 7,
          clone_url: "https://github.com/octo/source-companion.git",
          ssh_url: "git@github.com:octo/source-companion.git",
          html_url: "https://github.com/octo/source-companion",
          updated_at: "2026-06-09T07:30:00Z",
          owner: { login: "octo" }
        },
        {
          id: 2,
          name: "notes",
          full_name: "octo/notes",
          description: "",
          private: false,
          stargazers_count: 0,
          clone_url: "https://github.com/octo/notes.git",
          owner: { login: "octo" }
        }
      ]);
    }
  });

  const result = await client.searchUserRepositories({ query: "source" });
  assert.equal(result.ok, true);
  assert.equal(result.repositories.length, 1);
  assert.deepEqual(result.repositories[0], {
    id: 1,
    owner: "octo",
    name: "source-companion",
    fullName: "octo/source-companion",
    description: "Focused source control",
    private: true,
    visibility: "private",
    stars: 7,
    cloneUrl: "https://github.com/octo/source-companion.git",
    sshUrl: "git@github.com:octo/source-companion.git",
    htmlUrl: "https://github.com/octo/source-companion",
    updatedAt: "2026-06-09T07:30:00Z"
  });
  assert.match(requests[0].url, /\/user\/repos\?/);
  assert.equal(requests[0].options.headers.Authorization, "Bearer secret-token");
});

test("creates a GitHub repository with normalized API request", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  const requests = [];
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return createResponse(201, {
        id: 3,
        name: "published",
        full_name: "octo/published",
        description: "Created from Source Companion",
        private: false,
        visibility: "public",
        clone_url: "https://github.com/octo/published.git",
        owner: { login: "octo" }
      });
    }
  });

  const result = await client.createRepository({
    name: "published",
    description: "Created from Source Companion",
    private: false
  });

  assert.equal(result.ok, true);
  assert.equal(requests[0].url, "https://api.github.com/user/repos");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers.Authorization, "Bearer secret-token");
  assert.equal(requests[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    name: "published",
    description: "Created from Source Companion",
    private: false,
    auto_init: false
  });
  assert.equal(result.repository.fullName, "octo/published");
  assert.equal(result.repository.visibility, "public");
});

test("loads pull requests for the current branch", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  const requests = [];
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return createResponse(200, [{
        id: 10,
        number: 4,
        title: "Add PR flow",
        state: "open",
        draft: false,
        html_url: "https://github.com/octo/source-companion/pull/4",
        created_at: "2026-06-09T08:30:00Z",
        updated_at: "2026-06-09T08:40:00Z",
        head: {
          label: "octo:feature/pr",
          ref: "feature/pr",
          sha: "abc123",
          repo: {
            name: "source-companion",
            full_name: "octo/source-companion",
            owner: { login: "octo" }
          }
        },
        base: {
          label: "octo:main",
          ref: "main",
          sha: "def456",
          repo: {
            name: "source-companion",
            full_name: "octo/source-companion",
            owner: { login: "octo" }
          }
        }
      }]);
    }
  });

  const result = await client.listPullRequests({
    owner: "octo",
    repo: "source-companion",
    branch: "feature/pr"
  });

  assert.equal(result.ok, true);
  assert.equal(result.pullRequests.length, 1);
  assert.equal(result.pullRequests[0].number, 4);
  assert.equal(result.pullRequests[0].head.ref, "feature/pr");
  assert.match(requests[0].url, /\/repos\/octo\/source-companion\/pulls\?/);
  assert.match(requests[0].url, /head=octo%3Afeature%2Fpr/);
  assert.equal(requests[0].options.headers.Authorization, "Bearer secret-token");
});

test("creates a pull request with normalized API request", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  const requests = [];
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return createResponse(201, {
        id: 11,
        number: 5,
        title: "Add PR flow",
        state: "open",
        html_url: "https://github.com/octo/source-companion/pull/5",
        head: { ref: "feature/pr", repo: { name: "source-companion", owner: { login: "octo" } } },
        base: { ref: "main", repo: { name: "source-companion", owner: { login: "octo" } } }
      });
    }
  });

  const result = await client.createPullRequest({
    owner: "octo",
    repo: "source-companion",
    base: "main",
    head: "feature/pr",
    title: "Add PR flow",
    description: "Connects the PR API foundation."
  });

  assert.equal(result.ok, true);
  assert.equal(requests[0].url, "https://api.github.com/repos/octo/source-companion/pulls");
  assert.equal(requests[0].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    base: "main",
    head: "feature/pr",
    title: "Add PR flow",
    body: "Connects the PR API foundation.",
    draft: false
  });
  assert.equal(result.pullRequest.number, 5);
  assert.equal(result.pullRequest.base.ref, "main");
});

test("loads pull request status and check runs for a commit", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  const requests = [];
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.includes("/status")) {
        return createResponse(200, {
          state: "success",
          statuses: [{
            id: 20,
            context: "legacy-ci",
            state: "success",
            description: "Legacy status passed",
            target_url: "https://ci.example/status/20",
            created_at: "2026-06-09T08:35:00Z",
            updated_at: "2026-06-09T08:45:00Z"
          }]
        });
      }
      return createResponse(200, {
        check_runs: [{
          id: 21,
          name: "build",
          status: "completed",
          conclusion: "success",
          html_url: "https://github.com/octo/source-companion/actions/runs/21",
          output: {
            title: "Build passed"
          },
          started_at: "2026-06-09T08:36:00Z",
          completed_at: "2026-06-09T08:46:00Z"
        }]
      });
    }
  });

  const result = await client.loadPullRequestChecks({
    owner: "octo",
    repo: "source-companion",
    ref: "abc123"
  });

  assert.equal(result.ok, true);
  assert.equal(result.state, "success");
  assert.equal(result.summary, "Checks passing.");
  assert.equal(result.statuses[0].name, "legacy-ci");
  assert.equal(result.statuses[0].detailsUrl, "https://ci.example/status/20");
  assert.equal(result.checks[0].name, "build");
  assert.equal(result.checks[0].detailsUrl, "https://github.com/octo/source-companion/actions/runs/21");
  assert.equal(requests[0].url, "https://api.github.com/repos/octo/source-companion/commits/abc123/status");
  assert.equal(requests[1].url, "https://api.github.com/repos/octo/source-companion/commits/abc123/check-runs?per_page=100");
});

test("loads pull request review comments and verifies linked issues", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  const requests = [];
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.includes("/pulls/4/comments")) {
        return createResponse(200, [{
          id: 30,
          path: "src/main.js",
          line: 108,
          side: "RIGHT",
          body: "Handle missing review context.",
          html_url: "https://github.com/octo/source-companion/pull/4#discussion_r30",
          user: { login: "reviewer" },
          updated_at: "2026-06-09T08:50:00Z"
        }]);
      }
      if (url.endsWith("/issues/42")) {
        return createResponse(200, {
          number: 42,
          title: "Improve PR context",
          state: "open",
          html_url: "https://github.com/octo/source-companion/issues/42"
        });
      }
      return createResponse(404, { message: "Not Found" });
    }
  });

  const result = await client.loadPullRequestReviewContext({
    owner: "octo",
    repo: "source-companion",
    pullNumber: 4,
    branch: "feature/issue-42-review",
    commitMessages: ["Fixes #99"]
  });

  assert.equal(result.ok, true);
  assert.equal(result.reviewComments[0].path, "src/main.js");
  assert.equal(result.reviewComments[0].author, "reviewer");
  assert.equal(result.issueLinks[0].number, 42);
  assert.equal(result.issueLinks[0].status, "found");
  assert.equal(result.issueLinks[1].number, 99);
  assert.equal(result.issueLinks[1].status, "not-found");
  assert.equal(requests[0].url, "https://api.github.com/repos/octo/source-companion/pulls/4/comments?per_page=100");
  assert.equal(requests[1].url, "https://api.github.com/repos/octo/source-companion/issues/42");
  assert.equal(requests[2].url, "https://api.github.com/repos/octo/source-companion/issues/99");
});

test("reports missing GitHub remote mapping before pull request API calls", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"],
    tokenSource: "device-flow"
  });

  let fetchCalled = false;
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async () => {
      fetchCalled = true;
      return createResponse(200, []);
    }
  });

  const list = await client.listPullRequests({ branch: "feature/pr" });
  const create = await client.createPullRequest({ base: "main", head: "feature/pr", title: "PR" });

  assert.equal(list.ok, false);
  assert.equal(list.error.kind, "github-remote-missing");
  assert.equal(create.ok, false);
  assert.equal(create.error.kind, "github-remote-missing");
  assert.equal(fetchCalled, false);
});

test("blocks repository creation when stored token is missing required scopes", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "limited-token",
    login: "octo",
    scopes: ["read:user"],
    tokenSource: "device-flow"
  });

  let fetchCalled = false;
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async () => {
      fetchCalled = true;
      return createResponse(201, {
        name: "published",
        full_name: "octo/published",
        owner: { login: "octo" }
      });
    }
  });

  const result = await client.createRepository({ name: "published" });
  assert.equal(result.ok, false);
  assert.equal(result.repository, null);
  assert.equal(result.error.kind, "github-scope-missing");
  assert.deepEqual(result.error.scopesRequired, ["repo", "read:user"]);
  assert.deepEqual(result.error.scopesGranted, ["read:user"]);
  assert.equal(fetchCalled, false);
});

test("reports GitHub repository name conflicts", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"]
  });
  const client = createGitHubApiClient({
    tokenStore,
    fetchImpl: async () => createResponse(422, { message: "Repository creation failed." })
  });

  const result = await client.createRepository({ name: "published" });
  assert.equal(result.ok, false);
  assert.equal(result.error.kind, "github-repository-name-taken");
  assert.match(result.error.message, /already exists|cannot be created/);
});

test("normalizes missing auth, invalid token, and rate-limit API failures", async () => {
  const missingAuth = createGitHubApiClient({
    tokenStore: new MemorySecureTokenStore()
  });
  const missingResult = await missingAuth.listUserRepositories();
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.error.kind, "github-auth-missing");

  const invalidTokenStore = new MemorySecureTokenStore();
  await invalidTokenStore.write({
    token: "bad-token",
    login: "octo",
    scopes: ["repo", "read:user"]
  });
  const invalidToken = createGitHubApiClient({
    tokenStore: invalidTokenStore,
    fetchImpl: async () => createResponse(401, { message: "Bad credentials" })
  });
  const invalidResult = await invalidToken.listUserRepositories();
  assert.equal(invalidResult.ok, false);
  assert.equal(invalidResult.error.kind, "github-token-invalid");

  const limitedStore = new MemorySecureTokenStore();
  await limitedStore.write({
    token: "limited-token",
    login: "octo",
    scopes: ["repo", "read:user"]
  });
  const limited = createGitHubApiClient({
    tokenStore: limitedStore,
    fetchImpl: async () => createResponse(403, { message: "API rate limit exceeded" }, {
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": "1780987200"
    })
  });
  const limitedResult = await limited.listUserRepositories();
  assert.equal(limitedResult.ok, false);
  assert.equal(limitedResult.error.kind, "github-rate-limit");
  assert.deepEqual(limitedResult.error.rateLimit, {
    limit: 5000,
    remaining: 0,
    resetAt: "2026-06-09T06:40:00.000Z",
    retryAfterSeconds: null
  });

  const permissionStore = new MemorySecureTokenStore();
  await permissionStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"]
  });
  const permissionDenied = createGitHubApiClient({
    tokenStore: permissionStore,
    fetchImpl: async () => createResponse(403, { message: "Resource not accessible by integration" })
  });
  const permissionResult = await permissionDenied.loadPullRequestChecks({
    owner: "octo",
    repo: "source-companion",
    ref: "abc123"
  });
  assert.equal(permissionResult.ok, false);
  assert.equal(permissionResult.error.kind, "github-permission-missing");
});

test("logout deletes secure token and reports revocation errors separately", async () => {
  const tokenStore = new MemorySecureTokenStore();
  await tokenStore.write({
    token: "secret-token",
    login: "octo",
    scopes: ["repo", "read:user"]
  });
  const client = createGitHubApiClient({
    tokenStore,
    deviceFlow: {
      revokeToken: async () => {
        throw new Error("revocation failed");
      }
    }
  });

  const status = await client.logout({ revoke: true });
  assert.equal(status.authenticated, false);
  assert.equal(status.error.kind, "github-network-error");
  assert.match(status.error.message, /revocation failed/);
  assert.equal(await tokenStore.read(), null);
});

function createResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        const key = Object.keys(headers).find((item) => item.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : "";
      }
    },
    async json() {
      return body;
    }
  };
}
