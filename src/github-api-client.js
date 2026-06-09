"use strict";

const fs = typeof require === "function" ? require("node:fs") : null;
const os = typeof require === "function" ? require("node:os") : null;
const path = typeof require === "function" ? require("node:path") : null;
const { spawn } = typeof require === "function" ? require("node:child_process") : { spawn: null };

const DEFAULT_API_BASE_URL = "https://api.github.com";
const DEFAULT_GITHUB_WEB_BASE_URL = "https://github.com";
const DEFAULT_AUTH_METADATA_FILENAME = "github-auth.json";
const SECURE_TOKEN_SERVICE = "Source Companion";
const REQUIRED_SCOPES = ["repo", "read:user"];

class MemorySecureTokenStore {
  constructor() {
    this.record = null;
  }

  async read() {
    return this.record ? { ...this.record, scopes: [...this.record.scopes] } : null;
  }

  async write(record) {
    this.record = {
      token: requireString(record.token, "token"),
      login: clean(record.login),
      scopes: normalizeScopes(record.scopes),
      tokenSource: clean(record.tokenSource) || "device-flow",
      lastValidatedAt: record.lastValidatedAt || null
    };
  }

  async delete() {
    this.record = null;
  }
}

class UnavailableSecureTokenStore {
  async read() {
    throw createGitHubError({
      kind: "secure-storage-unavailable",
      message: "Secure token storage is not available in this runtime."
    });
  }

  async write() {
    throw createGitHubError({
      kind: "secure-storage-unavailable",
      message: "Secure token storage is not available in this runtime."
    });
  }

  async delete() {
    throw createGitHubError({
      kind: "secure-storage-unavailable",
      message: "Secure token storage is not available in this runtime."
    });
  }
}

class FileSecureTokenMetadataStore {
  constructor({ filePath } = {}) {
    this.filePath = filePath || defaultAuthMetadataPath();
  }

  async read() {
    if (!fs || !this.filePath) return null;
    try {
      const text = await fs.promises.readFile(this.filePath, "utf8");
      const data = JSON.parse(text);
      return {
        login: clean(data.login),
        scopes: normalizeScopes(data.scopes),
        tokenSource: clean(data.tokenSource) || "device-flow",
        lastValidatedAt: clean(data.lastValidatedAt) || null
      };
    } catch (error) {
      if (error && error.code === "ENOENT") return null;
      throw createGitHubError({
        kind: "secure-storage-unavailable",
        message: "GitHub auth metadata could not be read.",
        raw: error
      });
    }
  }

  async write(record) {
    if (!fs || !path || !this.filePath) {
      throw createGitHubError({
        kind: "secure-storage-unavailable",
        message: "GitHub auth metadata storage is not available."
      });
    }

    const metadata = {
      login: clean(record.login),
      scopes: normalizeScopes(record.scopes),
      tokenSource: clean(record.tokenSource) || "device-flow",
      lastValidatedAt: record.lastValidatedAt || null
    };
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.writeFile(this.filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  }

  async delete() {
    if (!fs || !this.filePath) return;
    try {
      await fs.promises.unlink(this.filePath);
    } catch (error) {
      if (!error || error.code !== "ENOENT") throw error;
    }
  }
}

class DesktopSecureTokenStore {
  constructor({
    metadataStore,
    credentialAdapter,
    service = SECURE_TOKEN_SERVICE
  } = {}) {
    this.metadataStore = metadataStore || new FileSecureTokenMetadataStore();
    this.credentialAdapter = credentialAdapter || createPlatformCredentialAdapter();
    this.service = service;
  }

  async read() {
    const metadata = await this.metadataStore.read();
    if (!metadata || !metadata.login) return null;

    const account = accountKeyForLogin(metadata.login);
    const token = await this.credentialAdapter.read({
      service: this.service,
      account,
      login: metadata.login
    });
    if (!token) return null;

    return {
      token,
      login: metadata.login,
      scopes: normalizeScopes(metadata.scopes),
      tokenSource: clean(metadata.tokenSource) || "device-flow",
      lastValidatedAt: metadata.lastValidatedAt || null
    };
  }

  async write(record) {
    const login = clean(record.login);
    const token = requireString(record.token, "token");
    if (!login) {
      throw createGitHubError({
        kind: "github-api-error",
        message: "GitHub login is required before storing a token."
      });
    }

    await this.credentialAdapter.write({
      service: this.service,
      account: accountKeyForLogin(login),
      login,
      token
    });
    await this.metadataStore.write({
      login,
      scopes: normalizeScopes(record.scopes),
      tokenSource: clean(record.tokenSource) || "device-flow",
      lastValidatedAt: record.lastValidatedAt || null
    });
  }

  async delete(login) {
    const metadata = await this.metadataStore.read();
    const normalizedLogin = clean(login) || clean(metadata && metadata.login);
    if (normalizedLogin) {
      await this.credentialAdapter.delete({
        service: this.service,
        account: accountKeyForLogin(normalizedLogin),
        login: normalizedLogin
      });
    }
    await this.metadataStore.delete();
  }
}

class GitHubDeviceFlow {
  constructor({
    clientId = defaultGitHubClientId(),
    fetchImpl = globalThis.fetch,
    githubBaseUrl = DEFAULT_GITHUB_WEB_BASE_URL,
    now = () => new Date(),
    openExternal = openUrlInSystemBrowser
  } = {}) {
    this.clientId = clean(clientId);
    this.fetch = fetchImpl;
    this.githubBaseUrl = String(githubBaseUrl || DEFAULT_GITHUB_WEB_BASE_URL).replace(/\/+$/, "");
    this.now = now;
    this.openExternal = openExternal;
  }

  async startDeviceLoginSession({ scopes = REQUIRED_SCOPES, openBrowser = false } = {}) {
    if (!this.clientId) {
      throw createGitHubError({
        kind: "github-login-unavailable",
        message: "GitHub OAuth client ID is not configured for desktop login."
      });
    }
    if (typeof this.fetch !== "function") {
      throw createGitHubError({
        kind: "github-network-error",
        message: "GitHub device login fetch is not available in this runtime."
      });
    }

    const data = await this.postOAuthJson("/login/device/code", {
      client_id: this.clientId,
      scope: normalizeScopes(scopes).join(" ")
    });
    if (data.error) throw normalizeOAuthDeviceError(data);

    const verificationUrl = clean(data.verification_uri_complete || data.verification_uri);
    if (openBrowser && verificationUrl && typeof this.openExternal === "function") {
      await this.openExternal(verificationUrl);
    }

    return {
      deviceCode: clean(data.device_code),
      userCode: clean(data.user_code),
      verificationUrl,
      expiresAt: expiresAtFromSeconds(data.expires_in, this.now),
      intervalSeconds: parseInteger(data.interval) || 5
    };
  }

  async pollDeviceLogin({ deviceCode } = {}) {
    const normalizedDeviceCode = clean(deviceCode);
    if (!normalizedDeviceCode) {
      throw createGitHubError({
        kind: "github-login-cancelled",
        message: "GitHub device login is not running."
      });
    }

    const data = await this.postOAuthJson("/login/oauth/access_token", {
      client_id: this.clientId,
      device_code: normalizedDeviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    });
    if (data.error) {
      return {
        status: clean(data.error),
        errorDescription: clean(data.error_description)
      };
    }

    return {
      token: clean(data.access_token),
      scopes: normalizeScopes(data.scope),
      tokenSource: "device-flow"
    };
  }

  async postOAuthJson(endpoint, body) {
    let response;
    try {
      response = await this.fetch(`${this.githubBaseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw normalizeGitHubError(error, {
        kind: "github-network-error",
        message: "GitHub device login network request failed."
      });
    }

    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw normalizeGitHubResponseError(response, data);
    }
    return data || {};
  }
}

class GitHubBridgeClient {
  constructor(bridge) {
    this.bridge = bridge || null;
  }

  async getAuthStatus() {
    return normalizeTokenFreeAuthStatus(await this.callBridge("getAuthStatus"));
  }

  async startDeviceLogin(options = {}) {
    return normalizeDeviceLoginStatus(await this.callBridge("startDeviceLogin", options));
  }

  async getLoginStatus(options = {}) {
    return normalizeDeviceLoginStatus(await this.callBridge("getLoginStatus", options));
  }

  async pollDeviceLogin(options = {}) {
    return normalizeDeviceLoginStatus(await this.callBridge("pollDeviceLogin", options));
  }

  async cancelDeviceLogin(options = {}) {
    return normalizeDeviceLoginStatus(await this.callBridge("cancelDeviceLogin", options));
  }

  async login() {
    return normalizeTokenFreeAuthStatus(await this.callBridge("login", {}));
  }

  async logout(options = {}) {
    return normalizeTokenFreeAuthStatus(await this.callBridge("logout", options));
  }

  async listUserRepositories(options = {}) {
    const result = await this.callBridge("listUserRepositories", options);
    return normalizeRepositoryResult(result);
  }

  async searchUserRepositories(options = {}) {
    const result = await this.callBridge("searchUserRepositories", options);
    return normalizeRepositoryResult(result);
  }

  async createRepository(options = {}) {
    const result = await this.callBridge("createRepository", options);
    return normalizeSingleRepositoryResult(result);
  }

  async listPullRequests(options = {}) {
    const result = await this.callBridge("listPullRequests", options);
    return normalizePullRequestResult(result);
  }

  async createPullRequest(options = {}) {
    const result = await this.callBridge("createPullRequest", options);
    return normalizeSinglePullRequestResult(result);
  }

  async loadPullRequestChecks(options = {}) {
    const result = await this.callBridge("loadPullRequestChecks", options);
    return normalizePullRequestCheckResult(result);
  }

  async loadPullRequestReviewContext(options = {}) {
    const result = await this.callBridge("loadPullRequestReviewContext", options);
    return normalizePullRequestReviewContextResult(result);
  }

  async callBridge(method, payload) {
    if (!this.bridge || typeof this.bridge[method] !== "function") {
      throw createGitHubError({
        kind: "github-api-unavailable",
        message: "GitHub backend bridge is not available in this runtime."
      });
    }

    try {
      return await this.bridge[method](payload);
    } catch (error) {
      throw normalizeGitHubError(error);
    }
  }
}

class GitHubApiClient {
  constructor({
    tokenStore,
    deviceFlow,
    fetchImpl = globalThis.fetch,
    apiBaseUrl = DEFAULT_API_BASE_URL,
    requiredScopes = REQUIRED_SCOPES,
    now = () => new Date().toISOString()
  } = {}) {
    this.tokenStore = tokenStore || new UnavailableSecureTokenStore();
    this.deviceFlow = deviceFlow || null;
    this.fetch = fetchImpl;
    this.apiBaseUrl = String(apiBaseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
    this.requiredScopes = normalizeScopes(requiredScopes);
    this.now = now;
  }

  async getAuthStatus() {
    const recordResult = await this.readStoredToken();
    if (!recordResult.ok) {
      return createNoTokenStatus(recordResult.error);
    }

    const record = recordResult.record;
    if (!record || !record.token) {
      return createNoTokenStatus(null);
    }

    const scopeError = createMissingScopeError(this.requiredScopes, record.scopes);
    if (scopeError) {
      return createNoTokenStatus(scopeError, {
        user: clean(record.login) || null,
        scopes: normalizeScopes(record.scopes),
        tokenSource: clean(record.tokenSource) || "device-flow"
      });
    }

    return {
      authenticated: true,
      user: clean(record.login) || null,
      login: clean(record.login) || null,
      scopes: normalizeScopes(record.scopes),
      tokenSource: clean(record.tokenSource) || "device-flow",
      lastValidatedAt: record.lastValidatedAt || null,
      error: null
    };
  }

  async login() {
    if (!this.deviceFlow || typeof this.deviceFlow.startDeviceLogin !== "function") {
      return createNoTokenStatus(createGitHubError({
        kind: "github-login-unavailable",
        message: "GitHub login is not available in this runtime."
      }));
    }

    let loginResult;
    try {
      loginResult = await this.deviceFlow.startDeviceLogin({
        scopes: [...this.requiredScopes]
      });
    } catch (error) {
      return createNoTokenStatus(normalizeGitHubError(error));
    }

    return this.completeDeviceLogin(loginResult);
  }

  async completeDeviceLogin(loginResult) {
    if (!loginResult || !loginResult.token) {
      return createNoTokenStatus(createGitHubError({
        kind: "github-login-cancelled",
        message: "GitHub login did not return a token."
      }));
    }

    const scopes = normalizeScopes(loginResult.scopes);
    const scopeError = createMissingScopeError(this.requiredScopes, scopes);
    if (scopeError) {
      return createNoTokenStatus(scopeError, {
        user: clean(loginResult.login) || null,
        scopes,
        tokenSource: "device-flow"
      });
    }

    let user = {
      login: clean(loginResult.login)
    };

    if (!user.login) {
      const userResult = await this.requestJson("/user", { token: loginResult.token });
      if (!userResult.ok) return createNoTokenStatus(userResult.error);
      user = userResult.data || user;
    }

    try {
      await this.tokenStore.write({
        token: loginResult.token,
        login: user.login,
        scopes,
        tokenSource: "device-flow",
        lastValidatedAt: this.now()
      });
    } catch (error) {
      return createNoTokenStatus(normalizeGitHubError(error, {
        kind: "secure-storage-unavailable",
        message: "Secure token storage is not available."
      }));
    }

    return this.getAuthStatus();
  }

  async logout({ revoke = false } = {}) {
    const recordResult = await this.readStoredToken();
    let revocationError = null;

    if (revoke && recordResult.ok && recordResult.record && recordResult.record.token && this.deviceFlow &&
      typeof this.deviceFlow.revokeToken === "function") {
      try {
        await this.deviceFlow.revokeToken({ token: recordResult.record.token });
      } catch (error) {
        revocationError = normalizeGitHubError(error);
      }
    }

    try {
      await this.tokenStore.delete(recordResult.ok && recordResult.record ? recordResult.record.login : undefined);
    } catch (error) {
      return createNoTokenStatus(normalizeGitHubError(error));
    }

    return createNoTokenStatus(revocationError);
  }

  async listUserRepositories(options = {}) {
    const auth = await this.getAuthStatus();
    if (!auth.authenticated) {
      return {
        ok: false,
        repositories: [],
        error: auth.error || createGitHubError({
          kind: "github-auth-missing",
          message: "GitHub login is required for this action."
        })
      };
    }

    const repositories = [];
    const maxPages = Number.isInteger(options.maxPages) ? options.maxPages : 10;
    for (let page = 1; page <= maxPages; page += 1) {
      const result = await this.requestJson(`/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100&page=${page}`);
      if (!result.ok) {
        return {
          ok: false,
          repositories,
          error: result.error
        };
      }

      const items = Array.isArray(result.data) ? result.data : [];
      repositories.push(...items.map(normalizeRepository));
      if (items.length < 100) break;
    }

    return {
      ok: true,
      repositories,
      error: null
    };
  }

  async searchUserRepositories({ query = "", maxPages } = {}) {
    const result = await this.listUserRepositories({ maxPages });
    if (!result.ok) return result;

    const needle = clean(query).toLowerCase();
    if (!needle) return result;

    return {
      ok: true,
      repositories: result.repositories.filter((repo) => {
        return [
          repo.fullName,
          repo.name,
          repo.owner,
          repo.description
        ].some((value) => clean(value).toLowerCase().includes(needle));
      }),
      error: null
    };
  }

  async createRepository({ name, description = "", private: isPrivate = true } = {}) {
    const normalizedName = clean(name);
    if (!/^[A-Za-z0-9._-]+$/.test(normalizedName)) {
      return {
        ok: false,
        repository: null,
        error: createGitHubError({
          kind: "invalid-request",
          message: "Enter a valid GitHub repository name."
        })
      };
    }

    const auth = await this.getAuthStatus();
    if (!auth.authenticated) {
      return {
        ok: false,
        repository: null,
        error: auth.error || createGitHubError({
          kind: "github-auth-missing",
          message: "GitHub login is required for this action."
        })
      };
    }

    const result = await this.requestJson("/user/repos", {
      method: "POST",
      body: {
        name: normalizedName,
        description: clean(description),
        private: Boolean(isPrivate),
        auto_init: false
      }
    });
    if (!result.ok) {
      return {
        ok: false,
        repository: null,
        error: result.error
      };
    }

    return {
      ok: true,
      repository: normalizeRepository(result.data),
      error: null
    };
  }

  async listPullRequests({ owner, repo, repository, branch, headOwner, state = "open", maxPages } = {}) {
    const locator = normalizeRepositoryLocator({ owner, repo, repository });
    if (!locator.ok) {
      return {
        ok: false,
        pullRequests: [],
        error: locator.error
      };
    }

    const normalizedBranch = clean(branch);
    if (!normalizedBranch) {
      return {
        ok: false,
        pullRequests: [],
        error: createGitHubError({
          kind: "invalid-request",
          message: "Current branch is required to load GitHub pull requests."
        })
      };
    }

    const auth = await this.getAuthStatus();
    if (!auth.authenticated) {
      return {
        ok: false,
        pullRequests: [],
        error: auth.error || createGitHubError({
          kind: "github-auth-missing",
          message: "GitHub login is required for this action."
        })
      };
    }

    const pullRequests = [];
    const pages = Number.isInteger(maxPages) ? maxPages : 3;
    const head = `${clean(headOwner) || locator.owner}:${normalizedBranch}`;
    for (let page = 1; page <= pages; page += 1) {
      const result = await this.requestJson(
        `/repos/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pulls` +
          `?state=${encodeURIComponent(clean(state) || "open")}` +
          `&head=${encodeURIComponent(head)}&sort=updated&direction=desc&per_page=100&page=${page}`
      );
      if (!result.ok) {
        return {
          ok: false,
          pullRequests,
          error: result.error
        };
      }

      const items = Array.isArray(result.data) ? result.data : [];
      pullRequests.push(...items.map(normalizePullRequest));
      if (items.length < 100) break;
    }

    return {
      ok: true,
      pullRequests,
      error: null
    };
  }

  async createPullRequest({ owner, repo, repository, base, head, title, description = "", draft = false } = {}) {
    const locator = normalizeRepositoryLocator({ owner, repo, repository });
    if (!locator.ok) {
      return {
        ok: false,
        pullRequest: null,
        error: locator.error
      };
    }

    const normalizedBase = clean(base);
    const normalizedHead = clean(head);
    const normalizedTitle = clean(title);
    if (!normalizedBase || !normalizedHead || !normalizedTitle) {
      return {
        ok: false,
        pullRequest: null,
        error: createGitHubError({
          kind: "invalid-request",
          message: "Base branch, head branch, and title are required to create a GitHub pull request."
        })
      };
    }

    const auth = await this.getAuthStatus();
    if (!auth.authenticated) {
      return {
        ok: false,
        pullRequest: null,
        error: auth.error || createGitHubError({
          kind: "github-auth-missing",
          message: "GitHub login is required for this action."
        })
      };
    }

    const result = await this.requestJson(`/repos/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/pulls`, {
      method: "POST",
      body: {
        base: normalizedBase,
        head: normalizedHead,
        title: normalizedTitle,
        body: clean(description),
        draft: Boolean(draft)
      }
    });
    if (!result.ok) {
      return {
        ok: false,
        pullRequest: null,
        error: result.error
      };
    }

    return {
      ok: true,
      pullRequest: normalizePullRequest(result.data),
      error: null
    };
  }

  async loadPullRequestChecks({ owner, repo, repository, ref, sha, branch } = {}) {
    const locator = normalizeRepositoryLocator({ owner, repo, repository });
    if (!locator.ok) {
      return {
        ok: false,
        state: "unknown",
        statuses: [],
        checks: [],
        summary: "GitHub checks could not be loaded.",
        error: locator.error
      };
    }

    const gitRef = clean(ref || sha || branch);
    if (!gitRef) {
      return {
        ok: false,
        state: "unknown",
        statuses: [],
        checks: [],
        summary: "GitHub checks could not be loaded.",
        error: createGitHubError({
          kind: "invalid-request",
          message: "A pull request head SHA or branch is required to load GitHub checks."
        })
      };
    }

    const auth = await this.getAuthStatus();
    if (!auth.authenticated) {
      return {
        ok: false,
        state: "unknown",
        statuses: [],
        checks: [],
        summary: "GitHub login is required to load checks.",
        error: auth.error || createGitHubError({
          kind: "github-auth-missing",
          message: "GitHub login is required for this action."
        })
      };
    }

    const encodedOwner = encodeURIComponent(locator.owner);
    const encodedRepo = encodeURIComponent(locator.repo);
    const encodedRef = encodeURIComponent(gitRef);
    const statusResult = await this.requestJson(`/repos/${encodedOwner}/${encodedRepo}/commits/${encodedRef}/status`);
    if (!statusResult.ok) {
      return createPullRequestCheckFailure(statusResult.error);
    }

    const checkResult = await this.requestJson(`/repos/${encodedOwner}/${encodedRepo}/commits/${encodedRef}/check-runs?per_page=100`);
    if (!checkResult.ok) {
      return createPullRequestCheckFailure(checkResult.error, {
        statuses: normalizeCommitStatuses(statusResult.data && statusResult.data.statuses)
      });
    }

    return normalizePullRequestCheckResult({
      ok: true,
      ref: gitRef,
      state: aggregateCheckState(statusResult.data, checkResult.data),
      summary: pullRequestCheckSummary(aggregateCheckState(statusResult.data, checkResult.data)),
      statuses: normalizeCommitStatuses(statusResult.data && statusResult.data.statuses),
      checks: normalizeCheckRuns(checkResult.data && checkResult.data.check_runs),
      error: null
    });
  }

  async loadPullRequestReviewContext({ owner, repo, repository, pullNumber, branch, commitMessages = [] } = {}) {
    const locator = normalizeRepositoryLocator({ owner, repo, repository });
    if (!locator.ok) {
      return createPullRequestReviewContextFailure(locator.error);
    }

    const issueNumbers = extractIssueNumbers([branch, ...commitMessages]);
    const auth = await this.getAuthStatus();
    if (!auth.authenticated) {
      return createPullRequestReviewContextFailure(auth.error || createGitHubError({
        kind: "github-auth-missing",
        message: "GitHub login is required for this action."
      }), {
        issueLinks: issueNumbers.map((number) => createUnverifiedIssueLink(locator, number))
      });
    }

    const encodedOwner = encodeURIComponent(locator.owner);
    const encodedRepo = encodeURIComponent(locator.repo);
    const reviewComments = [];
    if (Number.isInteger(pullNumber) && pullNumber > 0) {
      const commentsResult = await this.requestJson(`/repos/${encodedOwner}/${encodedRepo}/pulls/${pullNumber}/comments?per_page=100`);
      if (!commentsResult.ok) {
        return createPullRequestReviewContextFailure(commentsResult.error, {
          issueLinks: await this.loadIssueLinks(locator, issueNumbers)
        });
      }
      reviewComments.push(...normalizePullRequestReviewComments(commentsResult.data));
    }

    return normalizePullRequestReviewContextResult({
      ok: true,
      reviewComments,
      issueLinks: await this.loadIssueLinks(locator, issueNumbers),
      summary: reviewContextSummary(reviewComments.length, issueNumbers.length),
      error: null
    });
  }

  async loadIssueLinks(locator, issueNumbers) {
    const uniqueNumbers = Array.from(new Set((issueNumbers || []).filter((number) => Number.isInteger(number) && number > 0)));
    const links = [];
    for (const number of uniqueNumbers) {
      const result = await this.requestJson(
        `/repos/${encodeURIComponent(locator.owner)}/${encodeURIComponent(locator.repo)}/issues/${number}`
      );
      if (result.ok) {
        links.push(normalizeIssueLink(result.data, locator, number));
      } else {
        links.push(createFailedIssueLink(locator, number, result.error));
      }
    }
    return links;
  }

  async requestJson(path, { token, method = "GET", body } = {}) {
    if (typeof this.fetch !== "function") {
      return {
        ok: false,
        error: createGitHubError({
          kind: "github-network-error",
          message: "GitHub API fetch is not available in this runtime."
        })
      };
    }

    const stored = token ? { token } : await this.readStoredToken();
    if (!token && (!stored.ok || !stored.record || !stored.record.token)) {
      return {
        ok: false,
        error: stored.error || createGitHubError({
          kind: "github-auth-missing",
          message: "GitHub login is required for this action."
        })
      };
    }

    const requestToken = token || stored.record.token;
    let response;
    try {
      const headers = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${requestToken}`,
        "X-GitHub-Api-Version": "2022-11-28"
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";

      response = await this.fetch(`${this.apiBaseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (error) {
      return {
        ok: false,
        error: normalizeGitHubError(error, {
          kind: "github-network-error",
          message: "Network error while contacting GitHub."
        })
      };
    }

    const data = await readJsonResponse(response);
    if (!response.ok) {
      return {
        ok: false,
        error: normalizeGitHubResponseError(response, data)
      };
    }

    return {
      ok: true,
      data,
      response
    };
  }

  async readStoredToken() {
    try {
      const record = await this.tokenStore.read();
      return {
        ok: true,
        record
      };
    } catch (error) {
      return {
        ok: false,
        record: null,
        error: normalizeGitHubError(error, {
          kind: "secure-storage-unavailable",
          message: "Secure token storage is not available."
        })
      };
    }
  }
}

class GitHubAuthBridgeBackend {
  constructor({
    githubClient,
    tokenStore,
    deviceFlow,
    fetchImpl,
    apiBaseUrl,
    requiredScopes,
    now
  } = {}) {
    this.deviceFlow = deviceFlow || null;
    this.client = githubClient || new GitHubApiClient({
      tokenStore,
      deviceFlow,
      fetchImpl,
      apiBaseUrl,
      requiredScopes,
      now
    });
    this.activeLogin = null;
    this.nextLoginId = 1;
  }

  async getAuthStatus() {
    return normalizeTokenFreeAuthStatus(await this.client.getAuthStatus());
  }

  async startDeviceLogin(options = {}) {
    if (!this.deviceFlow || typeof this.deviceFlow.startDeviceLoginSession !== "function") {
      return createDeviceLoginStatusFailure("github-login-unavailable", "GitHub device login is not available in this runtime.");
    }

    try {
      if (this.activeLogin && typeof this.deviceFlow.cancelDeviceLogin === "function") {
        await this.deviceFlow.cancelDeviceLogin({ loginId: this.activeLogin.loginId });
      }
    } catch {
      // Replacing an in-flight login should not make the new login unavailable.
    }

    try {
      const started = await this.deviceFlow.startDeviceLoginSession({
        scopes: [...this.client.requiredScopes],
        openBrowser: Boolean(options.openBrowser)
      });
      const loginId = clean(started && started.loginId) || `github-login-${this.nextLoginId++}`;
      this.activeLogin = {
        loginId,
        deviceCode: clean(started && (started.deviceCode || started.device_code)),
        userCode: clean(started && (started.userCode || started.user_code)),
        verificationUrl: clean(started && (started.verificationUrl || started.verification_uri || started.verification_uri_complete)),
        expiresAt: clean(started && (started.expiresAt || started.expires_at)),
        intervalSeconds: parseInteger(started && (started.intervalSeconds || started.interval)) || 5,
        status: "pending",
        error: null
      };
      return normalizeDeviceLoginStatus(this.activeLogin);
    } catch (error) {
      this.activeLogin = null;
      return normalizeDeviceLoginStatus({
        status: "failed",
        error: normalizeGitHubError(error)
      });
    }
  }

  async getLoginStatus() {
    if (!this.activeLogin) {
      return normalizeDeviceLoginStatus({
        status: "idle",
        error: null
      });
    }
    return normalizeDeviceLoginStatus(this.activeLogin);
  }

  async pollDeviceLogin(options = {}) {
    if (!this.activeLogin) {
      return createDeviceLoginStatusFailure("github-login-cancelled", "No GitHub device login is running.");
    }
    if (!this.deviceFlow || typeof this.deviceFlow.pollDeviceLogin !== "function") {
      return createDeviceLoginStatusFailure("github-login-unavailable", "GitHub device login polling is not available in this runtime.");
    }

    try {
      const result = await this.deviceFlow.pollDeviceLogin({
        loginId: this.activeLogin.loginId,
        deviceCode: this.activeLogin.deviceCode,
        scopes: [...this.client.requiredScopes],
        ...normalizeRequest(options)
      });
      const status = clean(result && result.status);

      if (status === "authorization_pending" || status === "pending" || (!status && !(result && result.token))) {
        this.activeLogin = {
          ...this.activeLogin,
          status: "pending",
          error: null
        };
        return normalizeDeviceLoginStatus(this.activeLogin);
      }

      if (status === "slow_down") {
        this.activeLogin = {
          ...this.activeLogin,
          status: "pending",
          intervalSeconds: this.activeLogin.intervalSeconds + 5,
          error: null
        };
        return normalizeDeviceLoginStatus(this.activeLogin);
      }

      if (status === "expired_token" || status === "expired") {
        const failed = normalizeDeviceLoginStatus({
          ...this.activeLogin,
          status: "expired",
          error: createGitHubError({
            kind: "github-login-expired",
            message: "GitHub device login expired."
          })
        });
        this.activeLogin = null;
        return failed;
      }

      if (status === "access_denied" || status === "cancelled" || status === "canceled") {
        const failed = normalizeDeviceLoginStatus({
          ...this.activeLogin,
          status: "cancelled",
          error: createGitHubError({
            kind: "github-login-cancelled",
            message: "GitHub device login was cancelled."
          })
        });
        this.activeLogin = null;
        return failed;
      }

      if (result && result.token) {
        const auth = await this.client.completeDeviceLogin(result);
        const completed = normalizeDeviceLoginStatus({
          ...this.activeLogin,
          status: auth.authenticated ? "authenticated" : "failed",
          auth,
          error: auth.error
        });
        this.activeLogin = null;
        return completed;
      }

      throw createGitHubError({
        kind: "github-api-error",
        message: "GitHub device login returned an unsupported status."
      });
    } catch (error) {
      const failed = normalizeDeviceLoginStatus({
        ...this.activeLogin,
        status: "failed",
        error: normalizeGitHubError(error)
      });
      this.activeLogin = null;
      return failed;
    }
  }

  async cancelDeviceLogin() {
    const login = this.activeLogin;
    this.activeLogin = null;
    if (login && this.deviceFlow && typeof this.deviceFlow.cancelDeviceLogin === "function") {
      try {
        await this.deviceFlow.cancelDeviceLogin({
          loginId: login.loginId,
          deviceCode: login.deviceCode
        });
      } catch (error) {
        return normalizeDeviceLoginStatus({
          ...login,
          status: "failed",
          error: normalizeGitHubError(error)
        });
      }
    }

    return normalizeDeviceLoginStatus({
      ...(login || {}),
      status: "cancelled",
      error: null
    });
  }

  async login() {
    return normalizeTokenFreeAuthStatus(await this.client.login());
  }

  async logout(options = {}) {
    this.activeLogin = null;
    return normalizeTokenFreeAuthStatus(await this.client.logout(options));
  }

  async listUserRepositories(options = {}) {
    return normalizeRepositoryResult(await this.client.listUserRepositories(options));
  }

  async searchUserRepositories(options = {}) {
    return normalizeRepositoryResult(await this.client.searchUserRepositories(options));
  }

  async createRepository(options = {}) {
    return normalizeSingleRepositoryResult(await this.client.createRepository(options));
  }

  async listPullRequests(options = {}) {
    return normalizePullRequestResult(await this.client.listPullRequests(options));
  }

  async createPullRequest(options = {}) {
    return normalizeSinglePullRequestResult(await this.client.createPullRequest(options));
  }

  async loadPullRequestChecks(options = {}) {
    return normalizePullRequestCheckResult(await this.client.loadPullRequestChecks(options));
  }

  async loadPullRequestReviewContext(options = {}) {
    return normalizePullRequestReviewContextResult(await this.client.loadPullRequestReviewContext(options));
  }
}

function createGitHubApiClient(options) {
  return new GitHubApiClient(options);
}

function createGitHubBridgeClient(bridge) {
  return new GitHubBridgeClient(bridge);
}

function createGitHubAuthBridgeBackend(options) {
  return new GitHubAuthBridgeBackend(options);
}

function createDesktopGitHubAuthBridgeBackend(options = {}) {
  return createGitHubAuthBridgeBackend({
    ...options,
    tokenStore: options.tokenStore || new DesktopSecureTokenStore(options.tokenStoreOptions),
    deviceFlow: options.deviceFlow || new GitHubDeviceFlow(options.deviceFlowOptions)
  });
}

function createDesktopSecureTokenStore(options) {
  return new DesktopSecureTokenStore(options);
}

function createGitHubDeviceFlow(options) {
  return new GitHubDeviceFlow(options);
}

function createPlatformCredentialAdapter({
  platform = process.platform,
  runCommand = runCredentialCommand
} = {}) {
  if (platform === "win32") return createWindowsCredentialAdapter(runCommand);
  if (platform === "darwin") return createMacOSCredentialAdapter(runCommand);
  return createLinuxCredentialAdapter(runCommand);
}

function createWindowsCredentialAdapter(runCommand) {
  return {
    async read({ service, account }) {
      const result = await runCredentialJson("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        windowsCredentialScript("read")
      ], {
        service,
        account
      }, runCommand);
      return result.token || "";
    },
    async write({ service, account, login, token }) {
      await runCredentialJson("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        windowsCredentialScript("write")
      ], {
        service,
        account,
        login,
        token
      }, runCommand);
    },
    async delete({ service, account }) {
      await runCredentialJson("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        windowsCredentialScript("delete")
      ], {
        service,
        account
      }, runCommand);
    }
  };
}

function createMacOSCredentialAdapter(runCommand) {
  return {
    async read({ service, account }) {
      const result = await runCommand("security", [
        "find-generic-password",
        "-s",
        service,
        "-a",
        account,
        "-w"
      ]);
      return result.stdout.trim();
    },
    async write({ service, account, login, token }) {
      await runCommand("security", [
        "add-generic-password",
        "-U",
        "-s",
        service,
        "-a",
        account,
        "-l",
        "Source Companion GitHub Token",
        "-D",
        "application password",
        "-j",
        login,
        "-w",
        token
      ]);
    },
    async delete({ service, account }) {
      await runCommand("security", [
        "delete-generic-password",
        "-s",
        service,
        "-a",
        account
      ], { allowFailure: true });
    }
  };
}

function createLinuxCredentialAdapter(runCommand) {
  return {
    async read({ service, account }) {
      const result = await runCommand("secret-tool", [
        "lookup",
        "service",
        service,
        "account",
        account
      ]);
      return result.stdout.trim();
    },
    async write({ service, account, login, token }) {
      await runCommand("secret-tool", [
        "store",
        "--label",
        "Source Companion GitHub Token",
        "service",
        service,
        "account",
        account,
        "login",
        login
      ], {
        stdin: token
      });
    },
    async delete({ service, account }) {
      await runCommand("secret-tool", [
        "clear",
        "service",
        service,
        "account",
        account
      ], { allowFailure: true });
    }
  };
}

async function runCredentialJson(command, args, payload, runCommand) {
  const result = await runCommand(command, args, {
    stdin: JSON.stringify(payload)
  });
  const text = clean(result.stdout);
  return text ? JSON.parse(text) : {};
}

function runCredentialCommand(command, args = [], options = {}) {
  if (typeof spawn !== "function") {
    return Promise.reject(createGitHubError({
      kind: "secure-storage-unavailable",
      message: "Credential-store commands are not available in this runtime."
    }));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdoutText = "";
    let stderrText = "";
    child.stdout.on("data", (chunk) => {
      stdoutText += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderrText += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(createGitHubError({
        kind: "secure-storage-unavailable",
        message: "Operating system credential store is not available.",
        raw: error
      }));
    });
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) {
        resolve({ stdout: stdoutText, stderr: stderrText, code });
        return;
      }
      reject(createGitHubError({
        kind: "secure-storage-unavailable",
        message: clean(stderrText) || `Credential-store command failed with exit code ${code}.`,
        raw: { command, args: args.map(redactCredentialArg), code, stderr: stderrText }
      }));
    });

    if (options.stdin !== undefined) {
      child.stdin.end(String(options.stdin));
    } else {
      child.stdin.end();
    }
  });
}

function windowsCredentialScript(action) {
  const operation = clean(action);
  return `
$ErrorActionPreference = "Stop"
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$target = "$($payload.service)/$($payload.account)"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SourceCompanionCredMan {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr credential);
}
"@
if ("${operation}" -eq "write") {
  $bytes = [Text.Encoding]::Unicode.GetBytes([string]$payload.token)
  $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
    $credential = New-Object SourceCompanionCredMan+CREDENTIAL
    $credential.Type = 1
    $credential.TargetName = $target
    $credential.UserName = [string]$payload.login
    $credential.CredentialBlobSize = $bytes.Length
    $credential.CredentialBlob = $blob
    $credential.Persist = 2
    if (-not [SourceCompanionCredMan]::CredWrite([ref]$credential, 0)) {
      throw "Windows Credential Manager write failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
    }
    "{}"
  } finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
  }
} elseif ("${operation}" -eq "read") {
  $ptr = [IntPtr]::Zero
  if (-not [SourceCompanionCredMan]::CredRead($target, 1, 0, [ref]$ptr)) {
    "{}"
  } else {
    try {
      $credential = [Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][SourceCompanionCredMan+CREDENTIAL])
      $token = [Runtime.InteropServices.Marshal]::PtrToStringUni($credential.CredentialBlob, $credential.CredentialBlobSize / 2)
      @{ token = $token } | ConvertTo-Json -Compress
    } finally {
      [SourceCompanionCredMan]::CredFree($ptr)
    }
  }
} elseif ("${operation}" -eq "delete") {
  [void][SourceCompanionCredMan]::CredDelete($target, 1, 0)
  "{}"
}
`;
}

function normalizeOAuthDeviceError(data) {
  const error = clean(data && data.error);
  if (error === "slow_down") {
    return createGitHubError({
      kind: "github-secondary-rate-limit",
      message: clean(data.error_description) || "GitHub asked to slow down device login polling."
    });
  }
  if (error === "expired_token") {
    return createGitHubError({
      kind: "github-login-expired",
      message: clean(data.error_description) || "GitHub device login expired."
    });
  }
  if (error === "access_denied") {
    return createGitHubError({
      kind: "github-login-cancelled",
      message: clean(data.error_description) || "GitHub device login was cancelled."
    });
  }
  return createGitHubError({
    kind: "github-api-error",
    message: clean(data && data.error_description) || "GitHub device login failed.",
    raw: data || null
  });
}

function normalizeTokenFreeAuthStatus(auth) {
  const source = auth || {};
  return {
    authenticated: Boolean(source.authenticated),
    user: clean(source.user || source.login) || null,
    login: clean(source.login || source.user) || null,
    scopes: normalizeScopes(source.scopes),
    tokenSource: clean(source.tokenSource) || null,
    lastValidatedAt: source.lastValidatedAt || null,
    error: source.error ? normalizeGitHubError(source.error) : null
  };
}

function normalizeDeviceLoginStatus(status) {
  const source = status || {};
  const auth = source.auth ? normalizeTokenFreeAuthStatus(source.auth) : null;
  return {
    status: clean(source.status) || (auth && auth.authenticated ? "authenticated" : "idle"),
    loginId: clean(source.loginId) || null,
    userCode: clean(source.userCode || source.user_code) || null,
    verificationUrl: clean(source.verificationUrl || source.verification_uri || source.verification_uri_complete) || null,
    expiresAt: clean(source.expiresAt || source.expires_at) || null,
    intervalSeconds: parseInteger(source.intervalSeconds || source.interval) || null,
    authenticated: auth ? auth.authenticated : false,
    auth,
    error: source.error ? normalizeGitHubError(source.error) : null
  };
}

function createDeviceLoginStatusFailure(kind, message) {
  return normalizeDeviceLoginStatus({
    status: "failed",
    error: createGitHubError({ kind, message })
  });
}

function normalizeRepositoryResult(result) {
  const source = result || {};
  const ok = Boolean(source.ok);
  return {
    ok,
    repositories: Array.isArray(source.repositories) ? source.repositories.map(normalizeRepository) : [],
    error: ok ? null : normalizeGitHubError(source.error || createGitHubError({
      kind: "github-api-error",
      message: "GitHub repositories could not be loaded."
    }))
  };
}

function normalizeSingleRepositoryResult(result) {
  const source = result || {};
  const ok = Boolean(source.ok);
  return {
    ok,
    repository: ok && source.repository ? normalizeRepository(source.repository) : null,
    error: ok ? null : normalizeGitHubError(source.error || createGitHubError({
      kind: "github-api-error",
      message: "GitHub repository could not be created."
    }))
  };
}

function normalizePullRequestResult(result) {
  const source = result || {};
  const ok = Boolean(source.ok);
  return {
    ok,
    pullRequests: Array.isArray(source.pullRequests) ? source.pullRequests.map(normalizePullRequest) : [],
    error: ok ? null : normalizeGitHubError(source.error || createGitHubError({
      kind: "github-api-error",
      message: "GitHub pull requests could not be loaded."
    }))
  };
}

function normalizeSinglePullRequestResult(result) {
  const source = result || {};
  const ok = Boolean(source.ok);
  return {
    ok,
    pullRequest: ok && source.pullRequest ? normalizePullRequest(source.pullRequest) : null,
    error: ok ? null : normalizeGitHubError(source.error || createGitHubError({
      kind: "github-api-error",
      message: "GitHub pull request could not be created."
    }))
  };
}

function normalizePullRequestCheckResult(result) {
  const source = result || {};
  const ok = Boolean(source.ok);
  const statuses = Array.isArray(source.statuses) ? source.statuses.map(normalizeCommitStatus) : [];
  const checks = Array.isArray(source.checks) ? source.checks.map(normalizeCheckRun) : [];
  const state = clean(source.state) || aggregateNormalizedCheckState(statuses, checks);
  return {
    ok,
    ref: clean(source.ref),
    state: state || "unknown",
    summary: clean(source.summary) || (ok ? pullRequestCheckSummary(state) : "GitHub checks could not be loaded."),
    statuses,
    checks,
    error: ok ? null : normalizeGitHubError(source.error || createGitHubError({
      kind: "github-api-error",
      message: "GitHub checks could not be loaded."
    }))
  };
}

function normalizePullRequestReviewContextResult(result) {
  const source = result || {};
  const ok = Boolean(source.ok);
  const reviewComments = Array.isArray(source.reviewComments)
    ? source.reviewComments.map(normalizePullRequestReviewComment)
    : [];
  const issueLinks = Array.isArray(source.issueLinks)
    ? source.issueLinks.map(normalizeIssueLink)
    : [];
  return {
    ok,
    reviewComments,
    issueLinks,
    summary: clean(source.summary) || (ok
      ? reviewContextSummary(reviewComments.length, issueLinks.length)
      : "GitHub review context could not be loaded."),
    error: ok ? null : normalizeGitHubError(source.error || createGitHubError({
      kind: "github-api-error",
      message: "GitHub review context could not be loaded."
    }))
  };
}

function normalizeRepository(repo) {
  const owner = repo && repo.owner && typeof repo.owner === "object" ? clean(repo.owner.login) : clean(repo && repo.owner);
  const name = clean(repo && repo.name);
  const stars = Number.isInteger(repo && repo.stargazers_count) ? repo.stargazers_count :
    (Number.isInteger(repo && repo.stars) ? repo.stars : 0);
  return {
    id: repo && repo.id ? repo.id : null,
    owner,
    name,
    fullName: clean(repo && (repo.full_name || repo.fullName)) || (owner && name ? `${owner}/${name}` : name),
    description: clean(repo && repo.description),
    private: Boolean(repo && repo.private),
    visibility: clean(repo && repo.visibility) || (repo && repo.private ? "private" : "public"),
    stars,
    cloneUrl: clean(repo && (repo.clone_url || repo.cloneUrl)),
    sshUrl: clean(repo && (repo.ssh_url || repo.sshUrl)),
    htmlUrl: clean(repo && (repo.html_url || repo.htmlUrl)),
    updatedAt: clean(repo && (repo.updated_at || repo.updatedAt))
  };
}

function normalizePullRequest(pr) {
  const source = pr || {};
  return {
    id: source.id || null,
    number: Number.isInteger(source.number) ? source.number : null,
    title: clean(source.title),
    state: clean(source.state) || "unknown",
    draft: Boolean(source.draft),
    htmlUrl: clean(source.html_url || source.htmlUrl),
    url: clean(source.url),
    createdAt: clean(source.created_at || source.createdAt),
    updatedAt: clean(source.updated_at || source.updatedAt),
    mergedAt: clean(source.merged_at || source.mergedAt) || null,
    head: normalizePullRequestRef(source.head),
    base: normalizePullRequestRef(source.base)
  };
}

function normalizePullRequestRef(ref) {
  const source = ref || {};
  const repo = source.repo || {};
  const owner = repo.owner && typeof repo.owner === "object" ? clean(repo.owner.login) : clean(repo.owner);
  return {
    label: clean(source.label),
    ref: clean(source.ref),
    sha: clean(source.sha),
    owner,
    repo: clean(repo.name),
    fullName: clean(repo.full_name || repo.fullName) || (owner && repo.name ? `${owner}/${repo.name}` : "")
  };
}

function normalizePullRequestReviewComments(comments) {
  return Array.isArray(comments) ? comments.map(normalizePullRequestReviewComment) : [];
}

function normalizePullRequestReviewComment(comment) {
  const source = comment || {};
  const user = source.user || {};
  return {
    id: source.id || null,
    path: clean(source.path),
    body: clean(source.body),
    author: clean(user.login || source.author),
    htmlUrl: clean(source.html_url || source.htmlUrl),
    pullRequestReviewId: source.pull_request_review_id || source.pullRequestReviewId || null,
    line: parseInteger(source.line) || parseInteger(source.original_line),
    side: clean(source.side || source.original_side),
    createdAt: clean(source.created_at || source.createdAt),
    updatedAt: clean(source.updated_at || source.updatedAt)
  };
}

function normalizeIssueLink(issue, locator = {}, fallbackNumber = null) {
  const source = issue || {};
  const number = Number.isInteger(source.number) ? source.number : fallbackNumber;
  return {
    number,
    title: clean(source.title),
    state: clean(source.state) || "unknown",
    htmlUrl: clean(source.html_url || source.htmlUrl) || issueHtmlUrl(locator, number),
    status: clean(source.status) || "found",
    message: clean(source.message) || (number ? `Issue #${number} linked.` : "Issue linked."),
    error: source.error ? normalizeGitHubError(source.error) : null
  };
}

function createUnverifiedIssueLink(locator, number) {
  return normalizeIssueLink({
    number,
    status: "unverified",
    message: "Issue link was detected but not verified because GitHub login is unavailable."
  }, locator, number);
}

function createFailedIssueLink(locator, number, error) {
  const normalized = normalizeGitHubError(error);
  const notFound = normalized.status === 404 || normalized.kind === "github-not-found";
  return normalizeIssueLink({
    number,
    status: notFound ? "not-found" : "failed",
    message: notFound ? `Issue #${number} was not found or is not visible.` : normalized.message,
    error: normalized
  }, locator, number);
}

function issueHtmlUrl(locator, number) {
  if (!locator || !locator.owner || !locator.repo || !number) return "";
  return `https://github.com/${locator.owner}/${locator.repo}/issues/${number}`;
}

function createPullRequestReviewContextFailure(error, partial = {}) {
  return normalizePullRequestReviewContextResult({
    ok: false,
    reviewComments: partial.reviewComments || [],
    issueLinks: partial.issueLinks || [],
    summary: error && error.message ? error.message : "GitHub review context could not be loaded.",
    error
  });
}

function reviewContextSummary(reviewCommentCount, issueLinkCount) {
  const comments = `${reviewCommentCount} review comment${reviewCommentCount === 1 ? "" : "s"}`;
  const issues = `${issueLinkCount} issue link${issueLinkCount === 1 ? "" : "s"}`;
  return `${comments}; ${issues}.`;
}

function extractIssueNumbers(values) {
  const numbers = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const text = clean(value);
    if (!text) return;
    const patterns = [
      /(?:^|[^\w])(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)\b/gi,
      /(?:^|[^\w])(?:issue|gh)[-_ ]?#(\d+)\b/gi,
      /(?:^|[^\w])(?:issue|gh)[-_ ]?(\d+)\b/gi,
      /(?:^|[^\w])#(\d+)\b/g
    ];
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const number = parseInteger(match[1]);
        if (number && !numbers.includes(number)) numbers.push(number);
      }
    });
  });
  return numbers;
}

function normalizeCommitStatuses(statuses) {
  return Array.isArray(statuses) ? statuses.map(normalizeCommitStatus) : [];
}

function normalizeCommitStatus(status) {
  const source = status || {};
  const state = normalizeCheckState(source.state);
  return {
    id: source.id || null,
    name: clean(source.context || source.name) || "Status",
    state,
    rawState: clean(source.state) || "unknown",
    description: clean(source.description),
    targetUrl: clean(source.target_url || source.targetUrl || source.detailsUrl || source.htmlUrl),
    htmlUrl: clean(source.htmlUrl || source.target_url || source.targetUrl || source.detailsUrl),
    detailsUrl: clean(source.detailsUrl || source.htmlUrl || source.target_url || source.targetUrl),
    startedAt: clean(source.created_at || source.createdAt),
    completedAt: clean(source.updated_at || source.updatedAt)
  };
}

function normalizeCheckRuns(checkRuns) {
  return Array.isArray(checkRuns) ? checkRuns.map(normalizeCheckRun) : [];
}

function normalizeCheckRun(checkRun) {
  const source = checkRun || {};
  const output = source.output || {};
  const state = normalizeCheckState(source.conclusion || source.status);
  return {
    id: source.id || null,
    name: clean(source.name) || "Check",
    state,
    rawState: clean(source.status) || "unknown",
    conclusion: clean(source.conclusion),
    description: clean(source.description || output.title || output.summary),
    detailsUrl: clean(source.detailsUrl || source.html_url || source.htmlUrl || source.details_url),
    htmlUrl: clean(source.htmlUrl || source.html_url || source.details_url || source.detailsUrl),
    startedAt: clean(source.started_at || source.startedAt),
    completedAt: clean(source.completed_at || source.completedAt)
  };
}

function createPullRequestCheckFailure(error, partial = {}) {
  return normalizePullRequestCheckResult({
    ok: false,
    state: "unknown",
    summary: error && error.message ? error.message : "GitHub checks could not be loaded.",
    statuses: partial.statuses || [],
    checks: partial.checks || [],
    error
  });
}

function aggregateCheckState(statusData, checkData) {
  return aggregateNormalizedCheckState(
    normalizeCommitStatuses(statusData && statusData.statuses),
    normalizeCheckRuns(checkData && checkData.check_runs)
  );
}

function aggregateNormalizedCheckState(statuses, checks) {
  const items = [...(statuses || []), ...(checks || [])];
  if (items.length === 0) return "unknown";
  if (items.some((item) => item.state === "failure")) return "failure";
  if (items.some((item) => item.state === "running")) return "running";
  if (items.every((item) => item.state === "success" || item.state === "neutral")) return "success";
  return "unknown";
}

function normalizeCheckState(value) {
  const state = clean(value).toLowerCase();
  if (["success", "skipped"].includes(state)) return "success";
  if (["neutral"].includes(state)) return "neutral";
  if (["failure", "failed", "error", "timed_out", "cancelled", "action_required"].includes(state)) return "failure";
  if (["pending", "queued", "in_progress", "requested", "waiting"].includes(state)) return "running";
  return "unknown";
}

function pullRequestCheckSummary(state) {
  if (state === "success") return "Checks passing.";
  if (state === "failure") return "Checks failing.";
  if (state === "running") return "Checks running.";
  return "No checks reported.";
}

function normalizeRepositoryLocator({ owner, repo, repository } = {}) {
  const source = repository || {};
  const normalizedOwner = clean(owner || source.owner);
  const normalizedRepo = clean(repo || source.repo || source.name || source.repository);
  if (!normalizedOwner || !normalizedRepo) {
    return {
      ok: false,
      error: createGitHubError({
        kind: "github-remote-missing",
        message: "A GitHub owner and repository are required for this action."
      })
    };
  }

  return {
    ok: true,
    owner: normalizedOwner,
    repo: normalizedRepo
  };
}

function createMissingScopeError(requiredScopes, grantedScopes) {
  const required = normalizeScopes(requiredScopes);
  const granted = normalizeScopes(grantedScopes);
  const missing = required.filter((scope) => !granted.includes(scope));
  if (missing.length === 0) return null;

  return createGitHubError({
    kind: "github-scope-missing",
    message: `GitHub token is missing required scopes: ${missing.join(", ")}.`,
    scopesRequired: required,
    scopesGranted: granted
  });
}

function normalizeGitHubResponseError(response, data) {
  const status = response.status || null;
  const headers = response.headers;
  const message = clean(data && data.message) || `GitHub API request failed with status ${status}.`;
  const grantedScopes = parseScopeHeader(getHeader(headers, "x-oauth-scopes"));
  const retryAfterSeconds = parseInteger(getHeader(headers, "retry-after"));
  const rateLimit = parseRateLimit(headers, retryAfterSeconds);

  if (status === 401 || /bad credentials/i.test(message)) {
    return createGitHubError({
      kind: "github-token-invalid",
      message: "GitHub token is invalid or has been revoked.",
      status,
      scopesGranted: grantedScopes,
      raw: data
    });
  }

  if (status === 403 && rateLimit && rateLimit.remaining === 0) {
    return createGitHubError({
      kind: "github-rate-limit",
      message: "GitHub rate limit reached.",
      status,
      scopesGranted: grantedScopes,
      rateLimit,
      retryAfterSeconds,
      raw: data
    });
  }

  if (status === 403 && (retryAfterSeconds || /secondary rate limit|abuse/i.test(message))) {
    return createGitHubError({
      kind: "github-secondary-rate-limit",
      message: "GitHub secondary rate limit reached.",
      status,
      scopesGranted: grantedScopes,
      rateLimit,
      retryAfterSeconds,
      raw: data
    });
  }

  if (status === 403) {
    return createGitHubError({
      kind: "github-permission-missing",
      message: "GitHub permissions are not sufficient for this action.",
      status,
      scopesGranted: grantedScopes,
      rateLimit,
      retryAfterSeconds,
      raw: data
    });
  }

  if (status === 404) {
    return createGitHubError({
      kind: "github-not-found",
      message: "GitHub resource was not found or is not visible with the current permissions.",
      status,
      scopesGranted: grantedScopes,
      raw: data
    });
  }

  if (status === 422 && /name|already exists|creation failed/i.test(message)) {
    return createGitHubError({
      kind: "github-repository-name-taken",
      message: "A GitHub repository with this name already exists or cannot be created for this account.",
      status,
      scopesGranted: grantedScopes,
      raw: data
    });
  }

  return createGitHubError({
    kind: "github-api-error",
    message,
    status,
    scopesGranted: grantedScopes,
    rateLimit,
    retryAfterSeconds,
    raw: data
  });
}

function normalizeGitHubError(error, fallback = {}) {
  if (error && error.kind) {
    return createGitHubError({
      ...error,
      raw: error.raw || null
    });
  }

  return createGitHubError({
    kind: fallback.kind || "github-network-error",
    message: error && error.message ? error.message : fallback.message || "GitHub operation failed.",
    status: fallback.status || null,
    raw: error || null
  });
}

function createGitHubError({
  kind,
  message,
  status = null,
  scopesRequired = [],
  scopesGranted = [],
  rateLimit = null,
  retryAfterSeconds = null,
  raw = null
}) {
  return {
    kind: kind || "github-api-error",
    message: message || "GitHub operation failed.",
    status,
    scopesRequired: normalizeScopes(scopesRequired),
    scopesGranted: normalizeScopes(scopesGranted),
    rateLimit,
    retryAfterSeconds,
    raw
  };
}

function createNoTokenStatus(error = null, overrides = {}) {
  return {
    authenticated: false,
    user: overrides.user || null,
    login: overrides.user || null,
    scopes: normalizeScopes(overrides.scopes),
    tokenSource: overrides.tokenSource || null,
    lastValidatedAt: null,
    error
  };
}

async function readJsonResponse(response) {
  if (!response || typeof response.json !== "function") return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseRateLimit(headers, retryAfterSeconds) {
  const limit = parseInteger(getHeader(headers, "x-ratelimit-limit"));
  const remaining = parseInteger(getHeader(headers, "x-ratelimit-remaining"));
  const reset = parseInteger(getHeader(headers, "x-ratelimit-reset"));
  if (limit === null && remaining === null && reset === null && retryAfterSeconds === null) return null;

  return {
    limit,
    remaining,
    resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
    retryAfterSeconds
  };
}

function defaultAuthMetadataPath() {
  if (!path || !os) return "";
  const home = os.homedir && os.homedir();
  const base = process.platform === "win32"
    ? process.env.LOCALAPPDATA || (home ? path.join(home, "AppData", "Local") : "")
    : process.platform === "darwin"
      ? (home ? path.join(home, "Library", "Application Support") : "")
      : process.env.XDG_CONFIG_HOME || (home ? path.join(home, ".config") : "");
  return base ? path.join(base, "Source Companion", DEFAULT_AUTH_METADATA_FILENAME) : "";
}

function defaultGitHubClientId() {
  return clean(process.env.SOURCE_COMPANION_GITHUB_CLIENT_ID || process.env.GITHUB_OAUTH_CLIENT_ID);
}

function accountKeyForLogin(login) {
  return `github.com:${clean(login)}`;
}

function expiresAtFromSeconds(expiresIn, now) {
  const seconds = parseInteger(expiresIn);
  const date = typeof now === "function" ? now() : new Date();
  const timestamp = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!seconds || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp + seconds * 1000).toISOString();
}

async function openUrlInSystemBrowser(url) {
  const target = clean(url);
  if (!target) return;
  const platform = process.platform;
  if (platform === "win32") {
    await runCredentialCommand("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$target = [Console]::In.ReadToEnd(); if ($target) { Start-Process -FilePath $target }"
    ], {
      stdin: target,
      allowFailure: true
    });
    return;
  }
  if (platform === "darwin") {
    await runCredentialCommand("open", [target], { allowFailure: true });
    return;
  }
  await runCredentialCommand("xdg-open", [target], { allowFailure: true });
}

function redactCredentialArg(value) {
  const text = clean(value);
  if (!text) return text;
  if (/token|password|secret/i.test(text)) return "[redacted]";
  return text;
}

function getHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const lowerName = name.toLowerCase();
  const key = Object.keys(headers).find((item) => item.toLowerCase() === lowerName);
  return key ? headers[key] : "";
}

function parseScopeHeader(value) {
  return String(value || "").split(",").map((scope) => scope.trim()).filter(Boolean);
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes)) return parseScopeHeader(scopes);
  return [...new Set(scopes.map(clean).filter(Boolean))];
}

function parseInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireString(value, name) {
  const normalized = clean(value);
  if (!normalized) throw new TypeError(`${name} is required.`);
  return normalized;
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return {};
  return { ...request };
}

function clean(value) {
  return String(value || "").trim();
}

if (typeof window !== "undefined") {
  window.SourceCompanionGitHubClient = {
    createGitHubBridgeClient,
    normalizeGitHubError
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    GitHubApiClient,
    GitHubBridgeClient,
    GitHubAuthBridgeBackend,
    GitHubDeviceFlow,
    DesktopSecureTokenStore,
    FileSecureTokenMetadataStore,
    MemorySecureTokenStore,
    UnavailableSecureTokenStore,
    createGitHubApiClient,
    createGitHubAuthBridgeBackend,
    createGitHubBridgeClient,
    createDesktopGitHubAuthBridgeBackend,
    createDesktopSecureTokenStore,
    createGitHubDeviceFlow,
    createPlatformCredentialAdapter,
    normalizeGitHubError,
    normalizeDeviceLoginStatus,
    normalizePullRequestReviewContextResult,
    normalizePullRequestCheckResult,
    normalizePullRequest,
    normalizeRepository
  };
}
