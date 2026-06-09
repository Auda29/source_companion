"use strict";

const DEFAULT_API_BASE_URL = "https://api.github.com";
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

class GitHubBridgeClient {
  constructor(bridge) {
    this.bridge = bridge || null;
  }

  async getAuthStatus() {
    return normalizeTokenFreeAuthStatus(await this.callBridge("getAuthStatus"));
  }

  async login() {
    return normalizeTokenFreeAuthStatus(await this.callBridge("login"));
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

  async requestJson(path, { token } = {}) {
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
      response = await this.fetch(`${this.apiBaseUrl}${path}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${requestToken}`,
          "X-GitHub-Api-Version": "2022-11-28"
        }
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

function createGitHubApiClient(options) {
  return new GitHubApiClient(options);
}

function createGitHubBridgeClient(bridge) {
  return new GitHubBridgeClient(bridge);
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
    MemorySecureTokenStore,
    UnavailableSecureTokenStore,
    createGitHubApiClient,
    createGitHubBridgeClient,
    normalizeGitHubError,
    normalizeRepository
  };
}
