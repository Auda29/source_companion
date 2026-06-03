(function () {
  const STORAGE_KEY = "source-companion.recentRepositories.v1";
  const MAX_RECENT = 8;

  const state = {
    recent: loadRecent(),
    tabs: [],
    activeTabId: null,
    message: null,
    repositoryStateLoader: resolveRepositoryStateLoader()
  };

  const dialogs = {
    open: document.getElementById("openDialog"),
    clone: document.getElementById("cloneDialog"),
    github: document.getElementById("githubDialog"),
    publish: document.getElementById("publishDialog")
  };

  const recentList = document.getElementById("recentList");
  const tabList = document.getElementById("tabList");
  const messageHost = document.getElementById("messageHost");
  const workspaceContent = document.getElementById("workspaceContent");
  const clearRecentButton = document.getElementById("clearRecentButton");

  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      const dialog = dialogs[button.dataset.openDialog];
      if (dialog) {
        dialog.showModal();
        const input = dialog.querySelector("input");
        if (input) input.focus();
      }
    });
  });

  document.querySelectorAll(".dialog-body").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const submitter = event.submitter;
      if (submitter && submitter.value === "cancel") {
        form.closest("dialog").close();
        return;
      }

      const handled = handleFlow(form.dataset.flow, new FormData(form));
      if (handled) {
        form.reset();
        form.closest("dialog").close();
      }
    });
  });

  clearRecentButton.addEventListener("click", () => {
    state.recent = [];
    persistRecent();
    setMessage("success", "Recent repositories cleared.");
    render();
  });

  render();

  function handleFlow(flow, formData) {
    if (flow === "open") {
      return openRepository(formData.get("path"));
    }

    if (flow === "clone") {
      return prepareClone(formData.get("url"), formData.get("target"), "Clone setup", "clone");
    }

    if (flow === "github") {
      const name = clean(formData.get("name"));
      const target = clean(formData.get("target"));
      if (!name.includes("/") || !isAbsolutePath(target)) {
        setMessage("error", "Enter owner/repository and an absolute target folder.");
        render();
        return false;
      }

      const repoName = name.split("/").pop();
      const path = joinPath(target, repoName);
      openPreparedRepository(path, repoName, "GitHub clone setup", { initialOperationKind: "clone" });
      return true;
    }

    if (flow === "publish") {
      const path = clean(formData.get("path"));
      const name = clean(formData.get("name")) || displayNameFromPath(path);
      const visibility = clean(formData.get("visibility"));
      if (!isAbsolutePath(path) || !name) {
        setMessage("error", "Enter an absolute local folder and a repository name.");
        render();
        return false;
      }

      openPreparedRepository(path, name, `Publish setup: ${visibility}`, { initialOperationKind: "init" });
      return true;
    }

    return false;
  }

  function openRepository(pathValue) {
    const path = clean(pathValue);
    if (!isAbsolutePath(path)) {
      setMessage("error", "Enter an absolute local path, for example C:\\code\\project.");
      render();
      return false;
    }

    openPreparedRepository(path, displayNameFromPath(path), "Repository opened");
    return true;
  }

  function prepareClone(urlValue, targetValue, status, operationKind) {
    const url = clean(urlValue);
    const target = clean(targetValue);
    if (!isCloneUrl(url) || !isAbsolutePath(target)) {
      setMessage("error", "Enter a Git URL and an absolute target folder.");
      render();
      return false;
    }

    const repoName = repoNameFromUrl(url);
    openPreparedRepository(joinPath(target, repoName), repoName, status, { initialOperationKind: operationKind });
    return true;
  }

  function openPreparedRepository(path, name, status, options = {}) {
    const existing = state.tabs.find((tab) => samePath(tab.path, path));
    if (existing) {
      state.activeTabId = existing.id;
      setMessage("success", `${existing.displayName} is already open.`);
      render();
      refreshRepositoryState(existing.id, "reopen");
      return;
    }

    const tab = createRepositoryContext({
      displayName: name,
      path,
      entryStatus: status,
      initialOperationKind: options.initialOperationKind
    });

    state.tabs.push(tab);
    state.activeTabId = tab.id;
    addRecent(tab);
    setMessage("success", `${name} opened in a repository tab.`);
    render();
    refreshRepositoryState(tab.id, "opening");
  }

  function addRecent(repo) {
    state.recent = [
      {
        name: repo.displayName,
        path: repo.path,
        lastOpenedAt: repo.openedAt
      },
      ...state.recent.filter((item) => !samePath(item.path, repo.path))
    ].slice(0, MAX_RECENT);
    persistRecent();
  }

  function closeTab(tabId) {
    const index = state.tabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) return;

    state.tabs.splice(index, 1);
    if (state.activeTabId === tabId) {
      const fallback = state.tabs[index] || state.tabs[index - 1] || null;
      state.activeTabId = fallback ? fallback.id : null;
    }

    render();
  }

  function render() {
    renderRecent();
    renderTabs();
    renderMessage();
    renderWorkspace();
  }

  function renderRecent() {
    recentList.innerHTML = "";

    if (state.recent.length === 0) {
      recentList.innerHTML = '<div class="empty-list">No recent repositories.</div>';
      return;
    }

    state.recent.forEach((repo) => {
      const isValid = isAbsolutePath(repo.path);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent-item";
      button.innerHTML = `
        <span>
          <span class="recent-title">${escapeHtml(repo.name)}</span>
          <span class="recent-path">${escapeHtml(repo.path)}</span>
        </span>
        <span class="status-pill ${isValid ? "ready" : "error"}">${isValid ? "Ready" : "Invalid"}</span>
      `;

      button.addEventListener("click", () => {
        if (!isValid) {
          setMessage("error", `${repo.name} has an invalid saved path.`);
          render();
          return;
        }

        openPreparedRepository(repo.path, repo.name, "Repository opened");
      });

      recentList.appendChild(button);
    });
  }

  function renderTabs() {
    tabList.innerHTML = "";

    state.tabs.forEach((tab) => {
      const tabNode = document.createElement("div");
      tabNode.className = `tab${tab.id === state.activeTabId ? " active" : ""}`;
      tabNode.innerHTML = `
        <button class="tab-main" type="button">
          <span class="tab-label">${escapeHtml(tab.displayName)}</span>
        </button>
        <span class="status-pill ${healthClass(tab)}">${escapeHtml(repositoryHealthLabel(tab))}</span>
        <button class="tab-close" type="button" aria-label="Close ${escapeHtml(tab.displayName)}">x</button>
      `;

      tabNode.querySelector(".tab-main").addEventListener("click", () => {
        state.activeTabId = tab.id;
        render();
      });

      tabNode.querySelector(".tab-close").addEventListener("click", () => closeTab(tab.id));

      tabList.appendChild(tabNode);
    });
  }

  function renderMessage() {
    if (!state.message) {
      messageHost.innerHTML = "";
      return;
    }

    messageHost.innerHTML = `<div class="message ${state.message.kind}">${escapeHtml(state.message.text)}</div>`;
  }

  function renderWorkspace() {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);

    if (!active) {
      workspaceContent.innerHTML = `
        <div class="empty-state">
          <h2>No repository open</h2>
          <div class="empty-actions">
            <button class="button primary" data-open-dialog="open">Open Repo</button>
            <button class="button" data-open-dialog="clone">Clone Repo</button>
            <button class="button" data-open-dialog="github">Clone from GitHub</button>
            <button class="button" data-open-dialog="publish">Publish to GitHub</button>
          </div>
        </div>
      `;

      workspaceContent.querySelectorAll("[data-open-dialog]").forEach((button) => {
        button.addEventListener("click", () => dialogs[button.dataset.openDialog].showModal());
      });
      return;
    }

    workspaceContent.innerHTML = `
      <article class="repo-summary">
        <header>
          <div>
            <h2 class="repo-name">${escapeHtml(active.displayName)}</h2>
            <p class="repo-path">${escapeHtml(active.path)}</p>
          </div>
          <span class="status-pill ${healthClass(active)}">${escapeHtml(repositoryHealthLabel(active))}</span>
        </header>
        ${active.error ? `
          <div class="context-error">
            <strong>${escapeHtml(active.error.kind)}</strong>
            <span>${escapeHtml(active.error.message)}</span>
          </div>
        ` : ""}
        <div class="repo-meta">
          <div class="meta-item">
            <div class="meta-label">Repository state</div>
            <div class="meta-value">${escapeHtml(repositoryKindLabel(active.kind))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Branch</div>
            <div class="meta-value">${escapeHtml(branchLabel(active.git.branch))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Upstream</div>
            <div class="meta-value">${escapeHtml(upstreamLabel(active.git.upstream))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Divergence</div>
            <div class="meta-value">${escapeHtml(divergenceLabel(active.git.divergence))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Remote</div>
            <div class="meta-value">${escapeHtml(remoteLabel(active.git.remote))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">GitHub</div>
            <div class="meta-value">${escapeHtml(githubLabel(active.github))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Changes</div>
            <div class="meta-value">${escapeHtml(changesLabel(active.git))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Operation</div>
            <div class="meta-value">${escapeHtml(operationLabel(active.operations))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Refresh</div>
            <div class="meta-value">${escapeHtml(refreshLabel(active.lastRefresh))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Entry point</div>
            <div class="meta-value">${escapeHtml(active.entryStatus)}</div>
          </div>
        </div>
      </article>
    `;
  }

  function createRepositoryContext({ displayName, path, entryStatus, initialOperationKind }) {
    const id = createId();
    const openedAt = new Date().toISOString();
    const queuedOperation = initialOperationKind ? {
      id: `${id}:${initialOperationKind}:queued`,
      repositoryId: id,
      kind: initialOperationKind,
      action: initialOperationKind,
      priority: "normal",
      status: "queued",
      queuedAt: openedAt,
      startedAt: null,
      completedAt: null,
      abortable: true
    } : null;

    return {
      id,
      displayName,
      path,
      kind: "git-repository",
      health: queuedOperation ? "operation-running" : "ready",
      entryStatus,
      openedAt,
      git: {
        branch: null,
        remote: null,
        upstream: null,
        divergence: { ahead: 0, behind: 0 },
        files: []
      },
      github: null,
      operations: {
        running: [],
        queued: queuedOperation ? [queuedOperation] : [],
        completed: [],
        lastCompleted: null
      },
      error: null,
      lastRefresh: {
        status: "scheduled",
        requestedAt: openedAt,
        completedAt: null
      }
    };
  }

  async function refreshRepositoryState(tabId, reason) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.lastRefresh = {
      status: "running",
      requestedAt: new Date().toISOString(),
      completedAt: null,
      reason
    };
    render();

    const loadRepositoryState = state.repositoryStateLoader;
    if (!loadRepositoryState) {
      applyRepositoryState(tabId, {
        kind: tab.kind,
        health: "error",
        git: tab.git,
        github: tab.github,
        operations: tab.operations,
        error: {
          kind: "repository-state-unavailable",
          message: "Repository state loader is not available in this runtime."
        }
      }, "failed");
      return;
    }

    try {
      const loaded = await loadRepositoryState({
        repositoryPath: tab.path,
        operations: tab.operations
      });
      applyRepositoryState(tabId, loaded, "idle");
    } catch (error) {
      applyRepositoryState(tabId, {
        kind: tab.kind,
        health: "error",
        git: tab.git,
        github: tab.github,
        operations: tab.operations,
        error: {
          kind: "repository-state-error",
          message: error && error.message ? error.message : "Repository state refresh failed."
        }
      }, "failed");
    }
  }

  function applyRepositoryState(tabId, loaded, refreshStatus) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.kind = loaded.kind;
    tab.health = loaded.health;
    tab.git = normalizeGitState(loaded.git);
    tab.github = loaded.github || null;
    tab.operations = normalizeOperations(loaded.operations || tab.operations);
    tab.error = loaded.error || null;
    tab.lastRefresh = {
      ...tab.lastRefresh,
      status: refreshStatus,
      completedAt: new Date().toISOString()
    };

    render();
  }

  function resolveRepositoryStateLoader() {
    if (window.SourceCompanionRepositoryState && typeof window.SourceCompanionRepositoryState.loadRepositoryState === "function") {
      return window.SourceCompanionRepositoryState.loadRepositoryState;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-state", "./src/repository-state"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.loadRepositoryState === "function") {
          return loaded.loadRepositoryState;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function createId() {
    return crypto.randomUUID ? crypto.randomUUID() : `repo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function repositoryHealthLabel(repo) {
    if (repo.health === "operation-running") return "Operation";
    if (repo.health === "conflict") return "Conflict";
    if (repo.health === "error") return "Error";
    return "Ready";
  }

  function healthClass(repo) {
    if (repo.health === "operation-running") return "warning";
    if (repo.health === "conflict" || repo.health === "error") return "error";
    return "ready";
  }

  function repositoryKindLabel(kind) {
    if (kind === "folder-without-git") return "Folder without Git";
    if (kind === "no-folder") return "No folder";
    if (kind === "remote-repository") return "Git repository with remote";
    if (kind === "github-remote") return "GitHub remote";
    if (kind === "github-authenticated") return "GitHub authenticated";
    return "Git repository";
  }

  function branchLabel(branch) {
    if (!branch) return "Unknown";
    return branch.detached ? `Detached at ${branch.headSha || "HEAD"}` : branch.name;
  }

  function upstreamLabel(upstream) {
    if (!upstream) return "None";
    if (upstream.name) return upstream.name;
    if (upstream.ref) return upstream.ref;
    if (upstream.remoteName && upstream.branchName) return `${upstream.remoteName}/${upstream.branchName}`;
    return "Configured";
  }

  function divergenceLabel(divergence) {
    const counts = divergence || { ahead: 0, behind: 0 };
    return `${Number(counts.ahead) || 0} ahead, ${Number(counts.behind) || 0} behind`;
  }

  function remoteLabel(remote) {
    if (!remote) return "Unknown";
    return `${remote.name} (${remote.kind})`;
  }

  function githubLabel(github) {
    if (!github) return "Not linked";
    const repo = github.owner && github.name ? `${github.owner}/${github.name}` : "GitHub remote";
    return github.authenticated ? `${repo} authenticated` : repo;
  }

  function changesLabel(git) {
    const staged = countFiles(git.staged);
    const unstaged = countFiles(git.unstaged);
    const untracked = countFiles(git.untracked);
    const conflicted = countFiles(git.conflicted);
    return `${staged} staged, ${unstaged} unstaged, ${untracked} untracked, ${conflicted} conflicted`;
  }

  function refreshLabel(lastRefresh) {
    if (!lastRefresh) return "Idle";
    if (lastRefresh.status === "running") return "Running";
    if (lastRefresh.status === "failed") return "Failed";
    if (lastRefresh.completedAt) return `Updated at ${lastRefresh.completedAt}`;
    return "Scheduled";
  }

  function operationLabel(operations) {
    if (operations.running.length > 0) {
      return operations.running.map((operation) => `${operation.kind} ${operation.status || "running"}`).join(", ");
    }

    if (operations.queued.length > 0) {
      return operations.queued.map((operation) => `${operation.kind} ${operation.status || "queued"}`).join(", ");
    }

    if (operations.lastCompleted) {
      return `${operations.lastCompleted.status} at ${operations.lastCompleted.completedAt}`;
    }

    return "Idle";
  }

  function setMessage(kind, text) {
    state.message = { kind, text };
  }

  function normalizeGitState(git) {
    const source = git || {};
    const files = Array.isArray(source.files) ? source.files : [];

    return {
      branch: source.branch || null,
      remote: source.remote || null,
      remotes: Array.isArray(source.remotes) ? source.remotes : [],
      upstream: source.upstream || null,
      divergence: source.divergence || { ahead: 0, behind: 0 },
      files,
      staged: Array.isArray(source.staged) ? source.staged : files.filter((file) => file.staged),
      unstaged: Array.isArray(source.unstaged) ? source.unstaged : files.filter((file) => file.unstaged),
      untracked: Array.isArray(source.untracked) ? source.untracked : files.filter((file) => file.untracked),
      conflicted: Array.isArray(source.conflicted) ? source.conflicted : files.filter((file) => file.conflicted)
    };
  }

  function normalizeOperations(operations) {
    const source = operations || {};
    return {
      running: Array.isArray(source.running) ? source.running : [],
      queued: Array.isArray(source.queued) ? source.queued : [],
      completed: Array.isArray(source.completed) ? source.completed : [],
      lastCompleted: source.lastCompleted || null
    };
  }

  function countFiles(files) {
    return Array.isArray(files) ? files.length : 0;
  }

  function loadRecent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item.path === "string")
        .map((item) => ({
          name: clean(item.name) || displayNameFromPath(item.path),
          path: clean(item.path),
          lastOpenedAt: clean(item.lastOpenedAt)
        }))
        .slice(0, MAX_RECENT);
    } catch {
      return [];
    }
  }

  function persistRecent() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recent));
  }

  function isAbsolutePath(path) {
    return /^[a-zA-Z]:[\\/][^<>:"|?*]+/.test(path) || /^\/[^/].+/.test(path);
  }

  function isCloneUrl(url) {
    return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(url) ||
      /^git@github\.com:[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(url) ||
      /^ssh:\/\/.+/.test(url);
  }

  function displayNameFromPath(path) {
    const cleaned = clean(path).replace(/[\\/]+$/, "");
    return cleaned.split(/[\\/]/).pop() || "Repository";
  }

  function repoNameFromUrl(url) {
    const cleaned = clean(url).replace(/\.git$/i, "");
    return cleaned.split(/[/:]/).pop() || "repository";
  }

  function joinPath(parent, child) {
    const separator = parent.includes("\\") ? "\\" : "/";
    return `${parent.replace(/[\\/]+$/, "")}${separator}${child}`;
  }

  function samePath(first, second) {
    return clean(first).toLowerCase() === clean(second).toLowerCase();
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
