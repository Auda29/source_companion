(function () {
  const STORAGE_KEY = "source-companion.recentRepositories.v1";
  const MAX_RECENT = 8;

  const state = {
    recent: loadRecent(),
    tabs: [],
    activeTabId: null,
    message: null
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
      return prepareClone(formData.get("url"), formData.get("target"), "Clone setup");
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
      openPreparedRepository(path, repoName, "GitHub clone setup");
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

      openPreparedRepository(path, name, `Publish setup: ${visibility}`);
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

  function prepareClone(urlValue, targetValue, status) {
    const url = clean(urlValue);
    const target = clean(targetValue);
    if (!isCloneUrl(url) || !isAbsolutePath(target)) {
      setMessage("error", "Enter a Git URL and an absolute target folder.");
      render();
      return false;
    }

    const repoName = repoNameFromUrl(url);
    openPreparedRepository(joinPath(target, repoName), repoName, status);
    return true;
  }

  function openPreparedRepository(path, name, status) {
    const existing = state.tabs.find((tab) => samePath(tab.path, path));
    if (existing) {
      state.activeTabId = existing.id;
      setMessage("success", `${existing.name} is already open.`);
      render();
      return;
    }

    const tab = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      path,
      status,
      openedAt: new Date().toISOString()
    };

    state.tabs.push(tab);
    state.activeTabId = tab.id;
    addRecent(tab);
    setMessage("success", `${name} opened in a repository tab.`);
    render();
  }

  function addRecent(repo) {
    state.recent = [
      {
        name: repo.name,
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
          <span class="tab-label">${escapeHtml(tab.name)}</span>
        </button>
        <span class="status-pill ready">${escapeHtml(tab.status)}</span>
        <button class="tab-close" type="button" aria-label="Close ${escapeHtml(tab.name)}">x</button>
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
            <h2 class="repo-name">${escapeHtml(active.name)}</h2>
            <p class="repo-path">${escapeHtml(active.path)}</p>
          </div>
          <span class="status-pill ready">${escapeHtml(active.status)}</span>
        </header>
        <div class="repo-meta">
          <div class="meta-item">
            <div class="meta-label">Repository state</div>
            <div class="meta-value">Not loaded</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Branch</div>
            <div class="meta-value">Unknown</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Remote</div>
            <div class="meta-value">Unknown</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Operation</div>
            <div class="meta-value">Idle</div>
          </div>
        </div>
      </article>
    `;
  }

  function setMessage(kind, text) {
    state.message = { kind, text };
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
