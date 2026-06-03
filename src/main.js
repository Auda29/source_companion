(function () {
  const STORAGE_KEY = "source-companion.recentRepositories.v1";
  const MAX_RECENT = 8;

  const state = {
    recent: loadRecent(),
    tabs: [],
    activeTabId: null,
    message: null,
    repositoryStateLoader: resolveRepositoryStateLoader(),
    repositoryDiffLoader: resolveRepositoryDiffLoader(),
    repositoryFileActionRunner: resolveRepositoryFileActionRunner(),
    repositoryHunkActionRunner: resolveRepositoryHunkActionRunner(),
    repositoryCommitActionRunner: resolveRepositoryCommitActionRunner(),
    repositoryBranchActionRunner: resolveRepositoryBranchActionRunner(),
    repositorySyncActionRunner: resolveRepositorySyncActionRunner(),
    repositoryStashActionRunner: resolveRepositoryStashActionRunner(),
    repositoryCloneActionRunner: resolveRepositoryCloneActionRunner(),
    repositoryStatusWatcher: null
  };
  state.repositoryStatusWatcher = resolveRepositoryStatusWatcher(state.repositoryStateLoader);

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
      return prepareClone(formData.get("url"), formData.get("target"));
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

  function prepareClone(urlValue, targetValue) {
    const url = clean(urlValue);
    const target = clean(targetValue);
    if (!isCloneUrl(url) || !isAbsolutePath(target)) {
      setMessage("error", "Enter an HTTPS, SSH, or GitHub URL and an absolute target folder.");
      render();
      return false;
    }

    const repoName = repoNameFromUrl(url);
    openCloneRepository({
      url,
      targetPath: joinPath(target, repoName),
      displayName: repoName
    });
    return true;
  }

  function openCloneRepository({ url, targetPath, displayName }) {
    const existing = state.tabs.find((tab) => samePath(tab.path, targetPath));
    if (existing) {
      state.activeTabId = existing.id;
      setMessage("success", `${existing.displayName} is already open.`);
      render();
      return;
    }

    const tab = createRepositoryContext({
      displayName,
      path: targetPath,
      entryStatus: "Clone running",
      initialOperationKind: "clone"
    });
    tab.cloneRequest = { url, targetPath };
    tab.cloneAction = {
      status: "running",
      action: "clone",
      message: "Cloning repository.",
      completedAt: null
    };
    tab.health = "operation-running";
    tab.operations.running = tab.operations.queued.map((operation) => ({
      ...operation,
      status: "running",
      startedAt: new Date().toISOString()
    }));
    tab.operations.queued = [];

    state.tabs.push(tab);
    state.activeTabId = tab.id;
    setMessage("success", `Cloning ${displayName}.`);
    render();
    runRepositoryCloneAction(tab.id);
  }

  function openPreparedRepository(path, name, status, options = {}) {
    const existing = state.tabs.find((tab) => samePath(tab.path, path));
    if (existing) {
      state.activeTabId = existing.id;
      setMessage("success", `${existing.displayName} is already open.`);
      render();
      startRepositoryWatch(existing);
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
    startRepositoryWatch(tab);
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

    const [closedTab] = state.tabs.splice(index, 1);
    stopRepositoryWatch(closedTab);
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
      ${renderSourceControl(active)}
    `;

    workspaceContent.querySelectorAll("[data-change-key]").forEach((button) => {
      button.addEventListener("click", () => {
        selectChange(active.id, button.dataset.changeKey);
        render();
      });
    });

    workspaceContent.querySelectorAll("[data-file-action]").forEach((button) => {
      button.addEventListener("click", () => {
        runSelectedFileAction(active.id, button.dataset.fileAction);
      });
    });

    workspaceContent.querySelectorAll("[data-hunk-action]").forEach((button) => {
      button.addEventListener("click", () => {
        runSelectedHunkAction(active.id, button.dataset.hunkAction, button.dataset.hunkIndex);
      });
    });

    workspaceContent.querySelectorAll("[data-commit-form]").forEach((form) => {
      const textarea = form.querySelector("[data-commit-message]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runRepositoryCommitAction(active.id, "commit");
      });
      if (textarea) {
        textarea.addEventListener("input", () => {
          const tab = state.tabs.find((item) => item.id === active.id);
          if (!tab) return;
          tab.commitMessage = textarea.value;
          syncCommitControls(form, tab);
        });
      }
      syncCommitControls(form, active);
    });

    workspaceContent.querySelectorAll("[data-commit-action]").forEach((button) => {
      button.addEventListener("click", () => {
        runRepositoryCommitAction(active.id, button.dataset.commitAction);
      });
    });

    workspaceContent.querySelectorAll("[data-branch-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runRepositoryBranchAction(active.id, form.dataset.branchAction, new FormData(form));
      });
    });

    workspaceContent.querySelectorAll("[data-sync-action]").forEach((button) => {
      button.addEventListener("click", () => {
        runRepositorySyncAction(active.id, button.dataset.syncAction);
      });
    });

    workspaceContent.querySelectorAll("[data-stash-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runRepositoryStashAction(active.id, form.dataset.stashAction, new FormData(form));
      });
    });

    workspaceContent.querySelectorAll("button[data-stash-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const formData = new FormData();
        if (button.dataset.stashRef) formData.set("ref", button.dataset.stashRef);
        runRepositoryStashAction(active.id, button.dataset.stashAction, formData);
      });
    });
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
      },
      selectedChangeKey: null,
      diffPreview: null,
      fileAction: null,
      commitMessage: "",
      commitAction: null,
      branchAction: null,
      syncAction: null,
      stashAction: null,
      cloneAction: null,
      cloneRequest: null,
      gitOutput: [],
      watchHandle: null
    };
  }

  function startRepositoryWatch(tab) {
    if (!tab || tab.watchHandle || !state.repositoryStatusWatcher) return;

    try {
      tab.watchHandle = state.repositoryStatusWatcher.watchRepository({
        repositoryId: tab.id,
        repositoryPath: tab.path,
        operationsProvider: () => {
          const current = state.tabs.find((item) => item.id === tab.id);
          return current ? current.operations : tab.operations;
        },
        onState: (loaded) => {
          applyRepositoryState(tab.id, loaded, "idle");
        },
        onError: (error) => {
          applyRepositoryWatchError(tab.id, error);
        }
      });
    } catch (error) {
      applyRepositoryWatchError(tab.id, {
        kind: "repository-watch-error",
        message: error && error.message ? error.message : "Repository watcher could not start."
      });
    }
  }

  function stopRepositoryWatch(tab) {
    if (!tab || !tab.watchHandle) return;
    tab.watchHandle.close();
    tab.watchHandle = null;
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
    tab.selectedChangeKey = normalizeSelectedChangeKey(tab, tab.selectedChangeKey);
    if (tab.diffPreview && tab.diffPreview.key !== tab.selectedChangeKey) {
      tab.diffPreview = null;
    }
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

  function selectChange(tabId, changeKeyValue) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.selectedChangeKey = changeKeyValue;
    tab.diffPreview = {
      key: changeKeyValue,
      status: "loading",
      message: "Loading unified diff."
    };

    loadSelectedDiff(tabId, changeKeyValue);
  }

  async function loadSelectedDiff(tabId, changeKeyValue) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const selected = selectedChange(tab, changeBuckets(tab.git));
    if (!selected || selected.key !== changeKeyValue) return;

    const loadFileDiff = state.repositoryDiffLoader;
    if (!loadFileDiff) {
      applyDiffPreview(tabId, changeKeyValue, {
        status: "error",
        message: "Repository diff loader is not available in this runtime.",
        diff: ""
      });
      return;
    }

    try {
      const diff = await loadFileDiff({
        repositoryPath: tab.path,
        file: selected.file,
        bucketId: selected.bucket.id
      });
      applyDiffPreview(tabId, changeKeyValue, diff);
    } catch (error) {
      applyDiffPreview(tabId, changeKeyValue, {
        status: "error",
        message: error && error.message ? error.message : "Diff loading failed.",
        diff: ""
      });
    }
  }

  function applyDiffPreview(tabId, changeKeyValue, diff) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || tab.selectedChangeKey !== changeKeyValue) return;

    tab.diffPreview = {
      key: changeKeyValue,
      status: diff.status || "ready",
      message: diff.message || "",
      mode: diff.mode || null,
      fileType: diff.fileType || null,
      diff: diff.diff || "",
      error: diff.error || null,
      raw: diff.raw || ""
    };
    render();
  }

  async function runSelectedFileAction(tabId, action) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const selected = selectedChange(tab, changeBuckets(tab.git));
    if (!selected) return;

    if (action === "discard" && !confirmDiscard(selected)) {
      return;
    }

    tab.fileAction = {
      status: "running",
      action,
      path: selected.file.path,
      message: `${fileActionLabel(action)} ${selected.file.path}`
    };
    render();

    const runFileAction = state.repositoryFileActionRunner;
    if (!runFileAction) {
      applyFileActionResult(tabId, {
        ok: false,
        action,
        path: selected.file.path,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository file actions are not available in this runtime.",
        error: {
          kind: "repository-actions-unavailable",
          message: "Repository file actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runFileAction({
        repositoryPath: tab.path,
        file: selected.file,
        bucketId: selected.bucket.id,
        action
      });
      applyFileActionResult(tabId, result);
      if (result.ok) {
        const updated = state.tabs.find((item) => item.id === tabId);
        if (updated) {
          updated.diffPreview = null;
          refreshRepositoryState(tabId, `file-${action}`);
        }
      }
    } catch (error) {
      applyFileActionResult(tabId, {
        ok: false,
        action,
        path: selected.file.path,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : `${fileActionLabel(action)} failed.`,
        error: {
          kind: "file-action-error",
          message: error && error.message ? error.message : `${fileActionLabel(action)} failed.`
        }
      });
    }
  }

  async function runSelectedHunkAction(tabId, action, hunkIndexValue) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const selected = selectedChange(tab, changeBuckets(tab.git));
    const preview = selected ? selectedPreview(selected) : null;
    if (!selected || !preview || preview.status !== "ready") return;

    const hunkIndex = Number(hunkIndexValue);
    tab.fileAction = {
      status: "running",
      action,
      path: selected.file.path,
      message: `${fileActionLabel(action)} ${selected.file.path}`
    };
    render();

    const runHunkAction = state.repositoryHunkActionRunner;
    if (!runHunkAction) {
      applyFileActionResult(tabId, {
        ok: false,
        action,
        path: selected.file.path,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository hunk actions are not available in this runtime.",
        error: {
          kind: "repository-hunk-actions-unavailable",
          message: "Repository hunk actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runHunkAction({
        repositoryPath: tab.path,
        file: selected.file,
        bucketId: selected.bucket.id,
        action,
        diff: preview.diff,
        hunkIndex
      });
      applyFileActionResult(tabId, result);
      if (result.ok) {
        const updated = state.tabs.find((item) => item.id === tabId);
        if (updated) {
          updated.diffPreview = null;
          refreshRepositoryState(tabId, action);
        }
      }
    } catch (error) {
      applyFileActionResult(tabId, {
        ok: false,
        action,
        path: selected.file.path,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : `${fileActionLabel(action)} failed.`,
        error: {
          kind: "hunk-action-error",
          message: error && error.message ? error.message : `${fileActionLabel(action)} failed.`
        }
      });
    }
  }

  async function runRepositoryCommitAction(tabId, action) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const messageInput = workspaceContent.querySelector("[data-commit-message]");
    if (messageInput) {
      tab.commitMessage = messageInput.value;
    }

    if (action === "commit-and-push") {
      await runRepositorySyncAction(tabId, action);
      return;
    }

    const validation = validateCommitAction(tab, action);
    if (!validation.ok) {
      tab.commitAction = {
        status: "failed",
        action,
        message: validation.message,
        completedAt: new Date().toISOString()
      };
      render();
      return;
    }

    if (action === "amend" && !confirmAmend()) {
      return;
    }

    tab.commitAction = {
      status: "running",
      action,
      message: commitActionRunningLabel(action),
      completedAt: null
    };
    render();

    const runCommitAction = state.repositoryCommitActionRunner;
    if (!runCommitAction) {
      applyCommitActionResult(tabId, {
        ok: false,
        action,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository commit actions are not available in this runtime.",
        error: {
          kind: "repository-commit-actions-unavailable",
          message: "Repository commit actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runCommitAction({
        repositoryPath: tab.path,
        git: tab.git,
        message: tab.commitMessage,
        action
      });
      applyCommitActionResult(tabId, result);
      if (result.ok) {
        const updated = state.tabs.find((item) => item.id === tabId);
        if (updated) {
          updated.commitMessage = "";
          updated.diffPreview = null;
          refreshRepositoryState(tabId, action);
        }
      }
    } catch (error) {
      applyCommitActionResult(tabId, {
        ok: false,
        action,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Commit failed.",
        error: {
          kind: "commit-action-error",
          message: error && error.message ? error.message : "Commit failed."
        }
      });
    }
  }

  async function runRepositorySyncAction(tabId, action) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const messageInput = workspaceContent.querySelector("[data-commit-message]");
    if (messageInput) {
      tab.commitMessage = messageInput.value;
    }

    const validation = validateSyncAction(tab, action);
    if (!validation.ok) {
      tab.syncAction = {
        status: "failed",
        action,
        message: validation.message,
        completedAt: new Date().toISOString()
      };
      if (action === "commit-and-push") {
        tab.commitAction = {
          status: "failed",
          action,
          message: validation.message,
          completedAt: new Date().toISOString()
        };
      }
      render();
      return;
    }

    tab.syncAction = {
      status: "running",
      action,
      message: syncActionRunningLabel(action),
      completedAt: null
    };
    if (action === "commit-and-push") {
      tab.commitAction = {
        status: "running",
        action,
        message: syncActionRunningLabel(action),
        completedAt: null
      };
    }
    render();

    const runSyncAction = state.repositorySyncActionRunner;
    if (!runSyncAction) {
      applySyncActionResult(tabId, {
        ok: false,
        action,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository sync actions are not available in this runtime.",
        error: {
          kind: "repository-sync-actions-unavailable",
          message: "Repository sync actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runSyncAction({
        repositoryPath: tab.path,
        git: tab.git,
        action,
        message: tab.commitMessage
      });
      applySyncActionResult(tabId, result);
      const updated = state.tabs.find((item) => item.id === tabId);
      if (updated && result.ok && action === "commit-and-push") {
        updated.commitMessage = "";
        updated.diffPreview = null;
      }
      refreshRepositoryState(tabId, `sync-${action}`);
    } catch (error) {
      applySyncActionResult(tabId, {
        ok: false,
        action,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Sync action failed.",
        error: {
          kind: "sync-action-error",
          message: error && error.message ? error.message : "Sync action failed."
        }
      });
    }
  }

  async function runRepositoryBranchAction(tabId, action, formData) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const values = {
      name: clean(formData.get("name")),
      startPoint: clean(formData.get("startPoint")),
      remoteBranch: clean(formData.get("remoteBranch")),
      localName: clean(formData.get("localName"))
    };

    if (action === "delete" && values.name && !confirmBranchDelete(values.name)) {
      return;
    }

    tab.branchAction = {
      status: "running",
      action,
      branch: branchActionTarget(action, values),
      message: branchActionRunningLabel(action),
      completedAt: null
    };
    render();

    const runBranchAction = state.repositoryBranchActionRunner;
    if (!runBranchAction) {
      applyBranchActionResult(tabId, {
        ok: false,
        action,
        branch: branchActionTarget(action, values),
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository branch actions are not available in this runtime.",
        error: {
          kind: "repository-branch-actions-unavailable",
          message: "Repository branch actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runBranchAction({
        repositoryPath: tab.path,
        git: tab.git,
        action,
        name: values.name,
        startPoint: values.startPoint,
        remoteBranch: values.remoteBranch,
        localName: values.localName
      });
      applyBranchActionResult(tabId, result);
      if (result.ok) {
        refreshRepositoryState(tabId, `branch-${action}`);
      }
    } catch (error) {
      applyBranchActionResult(tabId, {
        ok: false,
        action,
        branch: branchActionTarget(action, values),
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Branch action failed.",
        error: {
          kind: "branch-action-error",
          message: error && error.message ? error.message : "Branch action failed."
        }
      });
    }
  }

  async function runRepositoryStashAction(tabId, action, formData) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const values = {
      message: clean(formData && formData.get("message")),
      includeUntracked: Boolean(formData && formData.get("includeUntracked")),
      ref: clean(formData && formData.get("ref"))
    };

    const validation = validateStashAction(tab, action, values);
    if (!validation.ok) {
      tab.stashAction = {
        status: "failed",
        action,
        ref: values.ref || null,
        message: validation.message,
        completedAt: new Date().toISOString()
      };
      render();
      return;
    }

    if (action === "drop" && values.ref && !confirmStashDrop(values.ref)) {
      return;
    }

    tab.stashAction = {
      status: "running",
      action,
      ref: values.ref || null,
      message: stashActionRunningLabel(action),
      completedAt: null
    };
    render();

    const runStashAction = state.repositoryStashActionRunner;
    if (!runStashAction) {
      applyStashActionResult(tabId, {
        ok: false,
        action,
        ref: values.ref || null,
        stashes: [],
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository stash actions are not available in this runtime.",
        error: {
          kind: "repository-stash-actions-unavailable",
          message: "Repository stash actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runStashAction({
        repositoryPath: tab.path,
        action,
        message: values.message,
        includeUntracked: values.includeUntracked,
        ref: values.ref
      });
      applyStashActionResult(tabId, result);
      if (result.ok) {
        const updated = state.tabs.find((item) => item.id === tabId);
        if (updated && action === "list") {
          updated.git = {
            ...updated.git,
            stashes: Array.isArray(result.stashes) ? result.stashes : []
          };
          render();
        }
        if (action !== "list") {
          refreshRepositoryState(tabId, `stash-${action}`);
        }
      }
    } catch (error) {
      applyStashActionResult(tabId, {
        ok: false,
        action,
        ref: values.ref || null,
        stashes: [],
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Stash action failed.",
        error: {
          kind: "stash-action-error",
          message: error && error.message ? error.message : "Stash action failed."
        }
      });
    }
  }

  async function runRepositoryCloneAction(tabId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || !tab.cloneRequest) return;

    const runCloneAction = state.repositoryCloneActionRunner;
    if (!runCloneAction) {
      applyCloneActionResult(tabId, {
        ok: false,
        action: "clone",
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository clone actions are not available in this runtime.",
        error: {
          kind: "repository-clone-actions-unavailable",
          message: "Repository clone actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runCloneAction({
        url: tab.cloneRequest.url,
        targetPath: tab.cloneRequest.targetPath
      });
      applyCloneActionResult(tabId, result);
      if (result.ok) {
        const updated = state.tabs.find((item) => item.id === tabId);
        if (updated) {
          updated.entryStatus = "Clone completed";
          updated.cloneRequest = null;
          addRecent(updated);
          startRepositoryWatch(updated);
          refreshRepositoryState(tabId, "clone");
        }
      }
    } catch (error) {
      applyCloneActionResult(tabId, {
        ok: false,
        action: "clone",
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Clone failed.",
        error: {
          kind: "clone-action-error",
          message: error && error.message ? error.message : "Clone failed."
        }
      });
    }
  }

  function applyCommitActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.commitAction = {
      status: result.ok ? "succeeded" : "failed",
      action: result.action,
      message: result.message,
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Commit completed." : "Commit failed."));
    render();
  }

  function applyBranchActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.branchAction = {
      status: result.ok ? "succeeded" : "failed",
      action: result.action,
      branch: result.branch || null,
      message: result.message,
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Branch action completed." : "Branch action failed."));
    render();
  }

  function applySyncActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.syncAction = {
      status: result.ok ? "succeeded" : "failed",
      action: result.action,
      message: result.message,
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
    if (result.action === "commit-and-push") {
      tab.commitAction = {
        status: result.ok ? "succeeded" : "failed",
        action: result.action,
        message: result.message,
        error: result.error || null,
        completedAt: new Date().toISOString()
      };
    }
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Sync action completed." : "Sync action failed."));
    render();
  }

  function applyStashActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.stashAction = {
      status: result.ok ? "succeeded" : "failed",
      action: result.action,
      ref: result.ref || null,
      message: result.message,
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Stash action completed." : "Stash action failed."));
    render();
  }

  function applyCloneActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const completedAt = new Date().toISOString();
    tab.cloneAction = {
      status: result.ok ? "succeeded" : "failed",
      action: "clone",
      message: result.message,
      error: result.error || null,
      completedAt
    };
    tab.operations.running = [];
    tab.operations.queued = [];
    tab.operations.lastCompleted = {
      id: `${tab.id}:clone:completed`,
      repositoryId: tab.id,
      kind: "clone",
      action: "clone",
      status: result.ok ? "succeeded" : "failed",
      queuedAt: tab.openedAt,
      startedAt: null,
      completedAt,
      error: result.error || null
    };
    tab.operations.completed = [tab.operations.lastCompleted, ...tab.operations.completed].slice(0, 8);
    if (!result.ok) {
      tab.health = "error";
      tab.error = result.error || {
        kind: "clone-error",
        message: result.message || "Clone failed."
      };
      tab.lastRefresh = {
        ...tab.lastRefresh,
        status: "failed",
        completedAt
      };
    }
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Clone completed." : "Clone failed."));
    render();
  }

  function applyFileActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.fileAction = {
      status: result.ok ? "succeeded" : "failed",
      action: result.action,
      path: result.path,
      message: result.message,
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Git action completed." : "Git action failed."));
    render();
  }

  function createGitOutputEntry(result) {
    const command = result.command || {};
    const args = command.args && command.args.length > 0
      ? command.args
      : [command.action || result.action].filter(Boolean);

    return {
      ok: Boolean(result.ok),
      action: result.action || command.action || "git",
      command: command.display || (args.length > 0 ? `git ${args.join(" ")}` : "git"),
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
      message: result.message || "",
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
  }

  function confirmDiscard(selected) {
    const path = selected.file.oldPath ? `${selected.file.oldPath} -> ${selected.file.path}` : selected.file.path;
    const detail = selected.bucket.id === "untracked"
      ? "This will permanently remove the untracked file."
      : "This will permanently discard local changes for this file.";

    return window.confirm(`${detail}\n\n${path}`);
  }

  function confirmAmend() {
    return window.confirm("Amend rewrites the most recent commit on this branch.\n\nContinue only if you intend to change history.");
  }

  function confirmBranchDelete(name) {
    return window.confirm(`Delete local branch '${name}'?\n\nGit will refuse the deletion if it is not fully merged.`);
  }

  function confirmStashDrop(ref) {
    return window.confirm(`Delete stash '${ref}'?\n\nThis removes the saved stash entry.`);
  }

  function applyRepositoryWatchError(tabId, error) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.error = {
      kind: error && error.kind ? error.kind : "repository-watch-error",
      message: error && error.message ? error.message : "Repository watcher reported an error.",
      raw: error && error.raw ? error.raw : null
    };
    tab.lastRefresh = {
      ...tab.lastRefresh,
      status: "failed",
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

  function resolveRepositoryStatusWatcher(loadState) {
    if (window.SourceCompanionRepositoryStatusWatcher &&
      typeof window.SourceCompanionRepositoryStatusWatcher.RepositoryStatusWatcher === "function") {
      return new window.SourceCompanionRepositoryStatusWatcher.RepositoryStatusWatcher({
        loadState: loadState || undefined
      });
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-status-watcher", "./src/repository-status-watcher"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.RepositoryStatusWatcher === "function") {
          return new loaded.RepositoryStatusWatcher({
            loadState: loadState || undefined
          });
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryDiffLoader() {
    if (window.SourceCompanionRepositoryDiff && typeof window.SourceCompanionRepositoryDiff.loadFileDiff === "function") {
      return window.SourceCompanionRepositoryDiff.loadFileDiff;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-diff", "./src/repository-diff"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.loadFileDiff === "function") {
          return loaded.loadFileDiff;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryFileActionRunner() {
    if (window.SourceCompanionRepositoryFileActions && typeof window.SourceCompanionRepositoryFileActions.runFileAction === "function") {
      return window.SourceCompanionRepositoryFileActions.runFileAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-file-actions", "./src/repository-file-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runFileAction === "function") {
          return loaded.runFileAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryHunkActionRunner() {
    if (window.SourceCompanionRepositoryHunkActions && typeof window.SourceCompanionRepositoryHunkActions.runHunkAction === "function") {
      return window.SourceCompanionRepositoryHunkActions.runHunkAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-hunk-actions", "./src/repository-hunk-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runHunkAction === "function") {
          return loaded.runHunkAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryCommitActionRunner() {
    if (window.SourceCompanionRepositoryCommitActions && typeof window.SourceCompanionRepositoryCommitActions.runCommitAction === "function") {
      return window.SourceCompanionRepositoryCommitActions.runCommitAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-commit-actions", "./src/repository-commit-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runCommitAction === "function") {
          return loaded.runCommitAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryBranchActionRunner() {
    if (window.SourceCompanionRepositoryBranchActions && typeof window.SourceCompanionRepositoryBranchActions.runBranchAction === "function") {
      return window.SourceCompanionRepositoryBranchActions.runBranchAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-branch-actions", "./src/repository-branch-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runBranchAction === "function") {
          return loaded.runBranchAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositorySyncActionRunner() {
    if (window.SourceCompanionRepositorySyncActions && typeof window.SourceCompanionRepositorySyncActions.runSyncAction === "function") {
      return window.SourceCompanionRepositorySyncActions.runSyncAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-sync-actions", "./src/repository-sync-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runSyncAction === "function") {
          return loaded.runSyncAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryStashActionRunner() {
    if (window.SourceCompanionRepositoryStashActions && typeof window.SourceCompanionRepositoryStashActions.runStashAction === "function") {
      return window.SourceCompanionRepositoryStashActions.runStashAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-stash-actions", "./src/repository-stash-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runStashAction === "function") {
          return loaded.runStashAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryCloneActionRunner() {
    if (window.SourceCompanionRepositoryCloneActions && typeof window.SourceCompanionRepositoryCloneActions.runCloneAction === "function") {
      return window.SourceCompanionRepositoryCloneActions.runCloneAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-clone-actions", "./src/repository-clone-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runCloneAction === "function") {
          return loaded.runCloneAction;
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

  function currentBranchName(git) {
    const branch = git && git.branch ? git.branch : null;
    if (!branch || branch.detached) return "";
    return clean(branch.name);
  }

  function primaryRemoteName(git) {
    if (git && git.remote && clean(git.remote.name)) return clean(git.remote.name);
    const remotes = git && Array.isArray(git.remotes) ? git.remotes : [];
    const origin = remotes.find((remote) => clean(remote.name) === "origin");
    const remote = origin || remotes[0];
    return remote ? clean(remote.name) : "";
  }

  function upstreamParts(git) {
    const upstream = git && git.upstream ? git.upstream : null;
    if (!upstream) return null;

    if (clean(upstream.remoteName) && clean(upstream.branchName)) {
      return {
        remote: clean(upstream.remoteName),
        branch: clean(upstream.branchName)
      };
    }

    const name = clean(upstream.name || upstream.ref);
    if (!name || !name.includes("/")) return null;
    const [remote, ...branchParts] = name.split("/");
    const branch = branchParts.join("/");
    if (!remote || !branch) return null;

    return { remote, branch };
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

  function renderSourceControl(repo) {
    const buckets = changeBuckets(repo.git);
    const selected = selectedChange(repo, buckets);

    return `
      <section class="source-control" aria-label="Source control changes">
        ${renderClonePanel(repo)}
        ${renderBranchPanel(repo)}
        ${renderSyncPanel(repo)}
        ${renderStashPanel(repo)}
        ${renderCommitBox(repo)}
        <div class="source-control-layout">
          <div class="change-lists">
            ${buckets.map((bucket) => renderChangeBucket(bucket, repo.selectedChangeKey)).join("")}
          </div>
          <div class="change-detail" aria-live="polite">
            ${selected ? renderChangeDetail(selected) : renderNoSelectedChange(buckets)}
            ${renderGitOutput(repo)}
          </div>
        </div>
      </section>
    `;
  }

  function renderClonePanel(repo) {
    if (!repo.cloneAction && !repo.cloneRequest) return "";
    const status = repo.cloneAction || {
      status: "idle",
      message: "Clone is ready."
    };
    const request = repo.cloneRequest || {};

    return `
      <section class="sync-panel" aria-label="Clone progress">
        <div class="sync-panel-heading">
          <div>
            <h3>Clone</h3>
            <p>${escapeHtml(request.url || "Repository cloned")} / ${escapeHtml(repo.path)}</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        <div class="sync-status ${commitStatusClass(status)}">${escapeHtml(status.message || "")}</div>
      </section>
    `;
  }

  function renderSyncPanel(repo) {
    const running = repo.syncAction && repo.syncAction.status === "running";
    const actions = ["fetch", "pull", "push", "sync", "publish-branch"];
    const status = repo.syncAction ? repo.syncAction : {
      status: isSyncActionAvailable(repo) ? "idle" : "blocked",
      message: isSyncActionAvailable(repo) ? "Sync actions are ready." : "Open a Git repository with a remote before syncing."
    };

    return `
      <section class="sync-panel" aria-label="Remote sync actions">
        <div class="sync-panel-heading">
          <div>
            <h3>Remote Sync</h3>
            <p>${escapeHtml(remoteLabel(repo.git.remote))} / ${escapeHtml(upstreamLabel(repo.git.upstream))} / ${escapeHtml(divergenceLabel(repo.git.divergence))}</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        <div class="sync-actions">
          ${actions.map((action) => {
            const validation = validateSyncAction(repo, action);
            return `
              <button class="button" type="button" data-sync-action="${escapeHtml(action)}" ${validation.ok && !running ? "" : "disabled"} title="${escapeHtml(validation.message)}">
                ${escapeHtml(syncActionLabel(action))}
              </button>
            `;
          }).join("")}
        </div>
        <div class="sync-status ${commitStatusClass(status)}">${escapeHtml(status.message || "")}</div>
      </section>
    `;
  }

  function renderStashPanel(repo) {
    const stashes = Array.isArray(repo.git.stashes) ? repo.git.stashes : [];
    const running = repo.stashAction && repo.stashAction.status === "running";
    const pushValidation = validateStashAction(repo, "push", {});
    const status = repo.stashAction ? repo.stashAction : {
      status: isStashActionAvailable(repo) ? "idle" : "blocked",
      message: isStashActionAvailable(repo) ? "Stash actions are ready." : "Open a Git repository before using stashes."
    };
    const blocked = running || !isStashActionAvailable(repo);

    return `
      <section class="stash-panel" aria-label="Stash actions">
        <div class="stash-panel-heading">
          <div>
            <h3>Stash</h3>
            <p>${stashes.length} saved / ${escapeHtml(changesLabel(repo.git))}</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        <form class="stash-form" data-stash-form data-stash-action="push">
          <label>
            Message
            <input name="message" autocomplete="off" placeholder="optional stash note" ${blocked ? "disabled" : ""}>
          </label>
          <label class="checkbox-label">
            <input name="includeUntracked" type="checkbox" ${blocked ? "disabled" : ""}>
            Include untracked
          </label>
          <button class="button" type="submit" ${pushValidation.ok && !running ? "" : "disabled"} title="${escapeHtml(pushValidation.message)}">Stash changes</button>
          <button class="button" type="button" data-stash-action="list" ${blocked ? "disabled" : ""}>Refresh list</button>
        </form>
        <div class="stash-list">
          ${stashes.length === 0 ? '<div class="stash-empty">No stashes.</div>' : stashes.map((stash) => renderStashItem(stash, running)).join("")}
        </div>
        <div class="stash-status ${commitStatusClass(status)}">${escapeHtml(status.message || "")}</div>
      </section>
    `;
  }

  function renderStashItem(stash, running) {
    const ref = stash.ref || "";
    const summary = stash.message || stash.summary || ref || "Stash entry";
    const detail = stash.branch ? `On ${stash.branch}` : stash.summary || ref;

    return `
      <article class="stash-item">
        <div class="stash-text">
          <strong>${escapeHtml(ref || "stash")}</strong>
          <span>${escapeHtml(summary)}</span>
          <small>${escapeHtml(detail)}</small>
        </div>
        <div class="stash-actions">
          <button class="button" type="button" data-stash-action="apply" data-stash-ref="${escapeHtml(ref)}" ${ref && !running ? "" : "disabled"}>Apply</button>
          <button class="button danger" type="button" data-stash-action="drop" data-stash-ref="${escapeHtml(ref)}" ${ref && !running ? "" : "disabled"}>Delete</button>
        </div>
      </article>
    `;
  }

  function renderBranchPanel(repo) {
    const disabled = !isBranchActionAvailable(repo);
    const running = repo.branchAction && repo.branchAction.status === "running";
    const blocked = disabled || running;
    const status = repo.branchAction ? repo.branchAction : {
      status: disabled ? "blocked" : "idle",
      message: disabled ? "Open a Git repository before running branch actions." : "Branch actions are ready."
    };

    return `
      <section class="branch-panel" aria-label="Branch actions">
        <div class="branch-panel-heading">
          <div>
            <h3>Branch</h3>
            <p>${escapeHtml(branchLabel(repo.git.branch))} / ${escapeHtml(upstreamLabel(repo.git.upstream))} / ${escapeHtml(divergenceLabel(repo.git.divergence))}</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        <div class="branch-grid">
          <form class="branch-form" data-branch-form data-branch-action="create">
            <label>
              New branch
              <input name="name" autocomplete="off" placeholder="feature/name" ${blocked ? "disabled" : ""}>
            </label>
            <label>
              Start point
              <input name="startPoint" autocomplete="off" placeholder="${escapeHtml(branchLabel(repo.git.branch))}" ${blocked ? "disabled" : ""}>
            </label>
            <button class="button" type="submit" ${blocked ? "disabled" : ""}>Create</button>
          </form>
          <form class="branch-form" data-branch-form data-branch-action="switch">
            <label>
              Switch to
              <input name="name" autocomplete="off" placeholder="main" ${blocked ? "disabled" : ""}>
            </label>
            <button class="button" type="submit" ${blocked ? "disabled" : ""}>Switch</button>
          </form>
          <form class="branch-form" data-branch-form data-branch-action="checkout-remote">
            <label>
              Remote branch
              <input name="remoteBranch" autocomplete="off" placeholder="origin/feature" ${blocked ? "disabled" : ""}>
            </label>
            <label>
              Local name
              <input name="localName" autocomplete="off" placeholder="optional" ${blocked ? "disabled" : ""}>
            </label>
            <button class="button" type="submit" ${blocked ? "disabled" : ""}>Check out</button>
          </form>
          <form class="branch-form danger-zone" data-branch-form data-branch-action="delete">
            <label>
              Delete local branch
              <input name="name" autocomplete="off" placeholder="old-branch" ${blocked ? "disabled" : ""}>
            </label>
            <button class="button danger" type="submit" ${blocked ? "disabled" : ""}>Delete</button>
          </form>
        </div>
        <div class="branch-status ${commitStatusClass(status)}">${escapeHtml(status.message || "")}</div>
      </section>
    `;
  }

  function renderCommitBox(repo) {
    const validation = validateCommitAction(repo, "commit");
    const running = repo.commitAction && repo.commitAction.status === "running" || repo.syncAction && repo.syncAction.status === "running";
    const stagedCount = countFiles(repo.git.staged);
    const status = repo.commitAction ? repo.commitAction : {
      status: validation.ok ? "idle" : "blocked",
      message: validation.message
    };

    return `
      <form class="commit-box" data-commit-form>
        <label class="commit-message-label">
          <span>Commit Message</span>
          <textarea data-commit-message rows="3" autocomplete="off" placeholder="Describe the staged changes">${escapeHtml(repo.commitMessage || "")}</textarea>
        </label>
        <div class="commit-actions">
          <button class="button primary" type="submit" data-commit-primary ${validation.ok && !running ? "" : "disabled"}>Commit</button>
          <details class="commit-menu">
            <summary class="button">Variants</summary>
            <div class="commit-menu-list">
              <button class="commit-menu-item" type="button" data-commit-action="commit-staged" ${running ? "disabled" : ""}>Commit staged changes</button>
              <button class="commit-menu-item" type="button" data-commit-action="commit-and-push" ${running ? "disabled" : ""}>Commit and Push</button>
              <button class="commit-menu-item history" type="button" data-commit-action="amend" ${running ? "disabled" : ""}>Amend Commit</button>
            </div>
          </details>
          <span class="commit-count">${stagedCount} staged</span>
        </div>
        <div class="commit-status ${commitStatusClass(status)}" data-commit-status>${escapeHtml(status.message || "")}</div>
      </form>
    `;
  }

  function renderChangeBucket(bucket, selectedKey) {
    const count = bucket.files.length;
    return `
      <section class="change-bucket">
        <h3>
          <span>${escapeHtml(bucket.title)}</span>
          <span class="bucket-count">${count}</span>
        </h3>
        ${count === 0 ? '<div class="change-empty">No files</div>' : `
          <div class="change-list">
            ${bucket.files.map((file, index) => renderChangeItem(bucket, file, index, selectedKey)).join("")}
          </div>
        `}
      </section>
    `;
  }

  function renderChangeItem(bucket, file, index, selectedKey) {
    const key = changeKey(bucket.id, file, index);
    const selected = key === selectedKey ? " selected" : "";
    const path = file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path;

    return `
      <button class="change-item${selected}" type="button" data-change-key="${escapeHtml(key)}">
        <span class="change-status ${escapeHtml(bucket.id)}">${escapeHtml(statusSymbol(file, bucket.id))}</span>
        <span class="change-text">
          <span class="change-path">${escapeHtml(path)}</span>
          <span class="change-kind">${escapeHtml(changeTypeLabel(file))}</span>
        </span>
      </button>
    `;
  }

  function renderChangeDetail(selected) {
    const file = selected.file;
    const mode = selected.bucket.id === "conflicted" || file.conflicted ? "Conflict" : "Diff";
    const path = file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path;

    return `
      <section class="change-preview ${mode.toLowerCase()}">
        <div class="preview-heading">
          <span class="status-pill ${mode === "Conflict" ? "error" : "ready"}">${mode}</span>
          <div>
            <h3>${escapeHtml(path)}</h3>
            <p>${escapeHtml(selected.bucket.detailLabel)} / ${escapeHtml(file.status || "--")} / ${escapeHtml(changeTypeLabel(file))}</p>
          </div>
        </div>
        ${renderFileActions(selected)}
        ${renderDiffBody(selected)}
      </section>
    `;
  }

  function renderFileActions(selected) {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);
    const actionState = active && active.fileAction ? active.fileAction : null;
    const running = actionState && actionState.status === "running";
    const actions = fileActionsForSelected(selected);

    if (actions.length === 0) {
      return '<div class="file-action-note">No file actions are available for this state.</div>';
    }

    return `
      <div class="file-actions">
        ${actions.map((item) => `
          <button class="button ${item.danger ? "danger" : ""}" type="button" data-file-action="${escapeHtml(item.id)}" ${running ? "disabled" : ""}>
            ${escapeHtml(item.label)}
          </button>
        `).join("")}
      </div>
      ${actionState && actionState.path === selected.file.path ? renderFileActionStatus(actionState) : ""}
    `;
  }

  function fileActionsForSelected(selected) {
    if (selected.bucket.id === "conflicted" || selected.file.conflicted) return [];
    if (selected.bucket.id === "staged") {
      return [
        { id: "unstage", label: "Unstage" },
        { id: "discard", label: "Discard", danger: true }
      ];
    }
    if (selected.bucket.id === "unstaged") {
      return [
        { id: "stage", label: "Stage" },
        { id: "discard", label: "Discard", danger: true }
      ];
    }
    if (selected.bucket.id === "untracked") {
      return [
        { id: "stage", label: "Stage" },
        { id: "discard", label: "Discard", danger: true }
      ];
    }
    return [];
  }

  function renderFileActionStatus(actionState) {
    const statusClass = actionState.status === "failed" ? "error" : actionState.status === "running" ? "running" : "success";
    return `<div class="file-action-status ${statusClass}">${escapeHtml(actionState.message || "")}</div>`;
  }

  function renderDiffBody(selected) {
    const preview = selectedPreview(selected);
    if (!preview) {
      return '<div class="preview-state">Select this file again to load its diff.</div>';
    }

    if (preview.status === "loading") {
      return `<div class="preview-state">${escapeHtml(preview.message || "Loading unified diff.")}</div>`;
    }

    if (preview.status !== "ready") {
      return `
        <div class="preview-state ${escapeHtml(preview.status)}">
          ${escapeHtml(preview.message || "No unified diff is available.")}
        </div>
      `;
    }

    return `
      <div class="diff-meta">${escapeHtml(preview.message || "Unified diff.")}</div>
      ${renderHunkActions(selected, preview)}
      <pre class="diff-view" tabindex="0"><code>${renderUnifiedDiff(preview.diff)}</code></pre>
    `;
  }

  function renderHunkActions(selected, preview) {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);
    const actionState = active && active.fileAction ? active.fileAction : null;
    const running = actionState && actionState.status === "running";
    const action = hunkActionForSelected(selected);
    if (!action) return "";

    const hunks = diffHunkSummaries(preview.diff);
    if (hunks.length === 0) {
      return '<div class="file-action-note">No applicable hunks were found in this diff.</div>';
    }

    return `
      <div class="hunk-actions" aria-label="Hunk actions">
        ${hunks.map((hunk) => `
          <div class="hunk-action-row">
            <span>${escapeHtml(hunk.header)}</span>
            <button class="button" type="button" data-hunk-action="${escapeHtml(action.id)}" data-hunk-index="${hunk.index}" ${running ? "disabled" : ""}>
              ${escapeHtml(action.label)}
            </button>
          </div>
        `).join("")}
      </div>
    `;
  }

  function hunkActionForSelected(selected) {
    if (selected.bucket.id === "unstaged") return { id: "stage-hunk", label: "Stage hunk" };
    if (selected.bucket.id === "staged") return { id: "unstage-hunk", label: "Unstage hunk" };
    return null;
  }

  function diffHunkSummaries(diff) {
    return String(diff || "").split(/\r?\n/)
      .filter((line) => line.startsWith("@@"))
      .map((header, index) => ({ index, header }));
  }

  function selectedPreview(selected) {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!active || !active.diffPreview || active.diffPreview.key !== selected.key) return null;
    return active.diffPreview;
  }

  function renderUnifiedDiff(diff) {
    return String(diff || "").split(/\r?\n/).map((line) => {
      const kind = diffLineClass(line);
      return `<span class="${kind}">${escapeHtml(line) || " "}</span>`;
    }).join("\n");
  }

  function diffLineClass(line) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) return "diff-line meta";
    if (line.startsWith("@@")) return "diff-line hunk";
    if (line.startsWith("+")) return "diff-line added";
    if (line.startsWith("-")) return "diff-line removed";
    return "diff-line context";
  }

  function renderNoSelectedChange(buckets) {
    const total = buckets.reduce((sum, bucket) => sum + bucket.files.length, 0);
    return `
      <section class="change-preview empty">
        <h3>${total === 0 ? "No changes" : "No file selected"}</h3>
        <div class="preview-state">${total === 0 ? "Working tree is clean." : "Select a file from a change list."}</div>
      </section>
    `;
  }

  function renderGitOutput(repo) {
    const output = Array.isArray(repo.gitOutput) ? repo.gitOutput : [];
    return `
      <section class="git-output" aria-label="Git output">
        <h3>Git Output</h3>
        ${output.length === 0 ? '<div class="git-output-empty">No Git actions have run in this tab.</div>' : `
          <div class="git-output-list">
            ${output.map(renderGitOutputEntry).join("")}
          </div>
        `}
      </section>
    `;
  }

  function renderGitOutputEntry(entry) {
    const raw = [entry.stdout, entry.stderr].filter((value) => clean(value)).join("\n").trim();
    const status = entry.ok ? `exit ${entry.exitCode === null ? 0 : entry.exitCode}` : `failed${entry.exitCode === null ? "" : ` exit ${entry.exitCode}`}`;
    return `
      <article class="git-output-entry ${entry.ok ? "success" : "error"}">
        <div class="git-output-meta">
          <strong>${escapeHtml(entry.command)}</strong>
          <span>${escapeHtml(status)}</span>
        </div>
        <div class="git-output-message">${escapeHtml(entry.message || "")}</div>
        ${raw ? `<pre>${escapeHtml(raw)}</pre>` : ""}
      </article>
    `;
  }

  function syncCommitControls(form, repo) {
    const primary = form.querySelector("[data-commit-primary]");
    const status = form.querySelector("[data-commit-status]");
    const running = repo.commitAction && repo.commitAction.status === "running";
    const currentRepo = {
      ...repo,
      commitMessage: form.querySelector("[data-commit-message]")?.value || ""
    };
    const validation = validateCommitAction(currentRepo, "commit");

    if (primary) {
      primary.disabled = !validation.ok || running;
    }
    if (status && (!repo.commitAction || repo.commitAction.status !== "running")) {
      status.className = `commit-status ${validation.ok ? "idle" : "error"}`;
      status.textContent = validation.message;
    }
  }

  function validateCommitAction(repo, action) {
    if (!repo || repo.kind === "no-folder" || repo.kind === "folder-without-git") {
      return { ok: false, message: "Open a Git repository before committing." };
    }
    if (repo.health === "conflict" || countFiles(repo.git.conflicted) > 0) {
      return { ok: false, message: "Resolve conflicts before committing." };
    }
    if (repo.commitAction && repo.commitAction.status === "running") {
      return { ok: false, message: "Commit is running." };
    }
    if (repo.syncAction && repo.syncAction.status === "running") {
      return { ok: false, message: "Sync action is running." };
    }
    if (!clean(repo.commitMessage)) {
      return { ok: false, message: "Enter a commit message before committing." };
    }
    if (action !== "amend" && countFiles(repo.git.staged) === 0) {
      return { ok: false, message: "Stage at least one change before committing." };
    }
    return { ok: true, message: action === "amend" ? "Amend will rewrite the latest commit." : "Ready to commit staged changes." };
  }

  function commitStatusClass(status) {
    if (!status) return "idle";
    if (status.status === "running") return "running";
    if (status.status === "failed" || status.status === "blocked") return "error";
    if (status.status === "succeeded") return "success";
    return "idle";
  }

  function commitActionRunningLabel(action) {
    if (action === "amend") return "Amending commit.";
    if (action === "commit-staged") return "Committing staged changes.";
    if (action === "commit-and-push") return "Committing staged changes and pushing.";
    return "Creating commit.";
  }

  function changeBuckets(git) {
    return [
      { id: "unstaged", title: "Changed", detailLabel: "Unstaged changes", files: Array.isArray(git.unstaged) ? git.unstaged : [] },
      { id: "staged", title: "Staged", detailLabel: "Staged changes", files: Array.isArray(git.staged) ? git.staged : [] },
      { id: "untracked", title: "Untracked", detailLabel: "Untracked file", files: Array.isArray(git.untracked) ? git.untracked : [] },
      { id: "conflicted", title: "Conflicts", detailLabel: "Conflict", files: Array.isArray(git.conflicted) ? git.conflicted : [] }
    ];
  }

  function selectedChange(repo, buckets) {
    if (!repo.selectedChangeKey) return null;

    for (const bucket of buckets) {
      const found = bucket.files
        .map((file, index) => ({ bucket, file, key: changeKey(bucket.id, file, index) }))
        .find((item) => item.key === repo.selectedChangeKey);
      if (found) return found;
    }

    return null;
  }

  function normalizeSelectedChangeKey(repo, selectedKey) {
    if (!selectedKey) return null;
    return selectedChange({ ...repo, selectedChangeKey: selectedKey }, changeBuckets(repo.git)) ? selectedKey : null;
  }

  function changeKey(bucketId, file, index) {
    return `${bucketId}:${index}:${file.status || ""}:${file.oldPath || ""}:${file.path || ""}`;
  }

  function statusSymbol(file, bucketId) {
    if (bucketId === "conflicted" || file.conflicted) return "!";
    if (bucketId === "untracked" || file.untracked) return "?";
    if (file.type === "added") return "A";
    if (file.type === "deleted") return "D";
    if (file.type === "renamed") return "R";
    if (file.type === "modified") return "M";
    return "C";
  }

  function changeTypeLabel(file) {
    if (!file) return "changed";
    if (file.type === "conflict") return "conflict";
    if (file.type === "untracked") return "untracked";
    if (file.type === "renamed") return "renamed";
    if (file.type === "added") return "added";
    if (file.type === "deleted") return "deleted";
    if (file.type === "modified") return "modified";
    return "changed";
  }

  function fileActionLabel(action) {
    if (action === "stage") return "Staging";
    if (action === "unstage") return "Unstaging";
    if (action === "stage-hunk") return "Staging hunk";
    if (action === "unstage-hunk") return "Unstaging hunk";
    if (action === "discard") return "Discarding";
    return "Git action";
  }

  function branchActionRunningLabel(action) {
    if (action === "create") return "Creating branch.";
    if (action === "switch") return "Switching branch.";
    if (action === "delete") return "Deleting branch.";
    if (action === "checkout-remote") return "Checking out remote branch.";
    return "Running branch action.";
  }

  function syncActionLabel(action) {
    if (action === "fetch") return "Fetch";
    if (action === "pull") return "Pull";
    if (action === "push") return "Push";
    if (action === "sync") return "Sync";
    if (action === "commit-and-push") return "Commit and Push";
    if (action === "publish-branch") return "Publish Branch";
    return "Sync";
  }

  function syncActionRunningLabel(action) {
    if (action === "fetch") return "Fetching remote refs.";
    if (action === "pull") return "Pulling upstream changes.";
    if (action === "push") return "Pushing local commits.";
    if (action === "sync") return "Fetching, pulling, then pushing.";
    if (action === "commit-and-push") return "Committing staged changes and pushing.";
    if (action === "publish-branch") return "Publishing branch upstream.";
    return "Running sync action.";
  }

  function stashActionRunningLabel(action) {
    if (action === "list") return "Refreshing stash list.";
    if (action === "push") return "Stashing changes.";
    if (action === "apply") return "Applying stash.";
    if (action === "drop") return "Deleting stash.";
    return "Running stash action.";
  }

  function validateSyncAction(repo, action) {
    if (!repo || repo.kind === "no-folder" || repo.kind === "folder-without-git") {
      return { ok: false, message: "Open a Git repository before syncing." };
    }
    if (repo.syncAction && repo.syncAction.status === "running") {
      return { ok: false, message: "Sync action is running." };
    }
    if (repo.branchAction && repo.branchAction.status === "running") {
      return { ok: false, message: "Branch action is running." };
    }
    if (repo.commitAction && repo.commitAction.status === "running") {
      return { ok: false, message: "Commit is running." };
    }

    const remote = primaryRemoteName(repo.git);
    if (!remote) {
      return { ok: false, message: "Configure a remote before running sync actions." };
    }

    if (action === "fetch") {
      return { ok: true, message: `Ready to fetch ${remote}.` };
    }

    const branch = currentBranchName(repo.git);
    if (!branch) {
      return { ok: false, message: "Check out a local branch before running this sync action." };
    }

    if (action === "publish-branch") {
      return { ok: true, message: `Ready to publish ${branch} to ${remote}.` };
    }

    if (repo.health === "conflict" || countFiles(repo.git.conflicted) > 0) {
      return { ok: false, message: "Resolve conflicts before pulling, syncing, or committing and pushing." };
    }

    const upstream = upstreamParts(repo.git);
    if (!upstream) {
      return { ok: false, message: "Publish this branch or set an upstream before pulling, pushing, or syncing." };
    }

    if (action === "commit-and-push") {
      const commitValidation = validateCommitAction(repo, action);
      if (!commitValidation.ok) return commitValidation;
      return { ok: true, message: `Ready to commit staged changes and push ${branch}.` };
    }

    if (action === "pull") return { ok: true, message: `Ready to pull ${upstream.remote}/${upstream.branch}.` };
    if (action === "push") return { ok: true, message: `Ready to push ${branch} to ${upstream.remote}.` };
    if (action === "sync") return { ok: true, message: `Ready to fetch, pull, and push ${branch}.` };

    return { ok: false, message: "Unknown sync action." };
  }

  function validateStashAction(repo, action, values = {}) {
    if (!repo || repo.kind === "no-folder" || repo.kind === "folder-without-git") {
      return { ok: false, message: "Open a Git repository before using stashes." };
    }
    if (repo.stashAction && repo.stashAction.status === "running") {
      return { ok: false, message: "Stash action is running." };
    }
    if (repo.branchAction && repo.branchAction.status === "running") {
      return { ok: false, message: "Branch action is running." };
    }
    if (repo.commitAction && repo.commitAction.status === "running") {
      return { ok: false, message: "Commit is running." };
    }
    if (repo.syncAction && repo.syncAction.status === "running") {
      return { ok: false, message: "Sync action is running." };
    }

    if (action === "list") {
      return { ok: true, message: "Ready to refresh stashes." };
    }

    if (action === "push") {
      if (repo.health === "conflict" || countFiles(repo.git.conflicted) > 0) {
        return { ok: false, message: "Resolve conflicts before stashing changes." };
      }
      const changeCount = countFiles(repo.git.staged) + countFiles(repo.git.unstaged) + countFiles(repo.git.untracked);
      if (changeCount === 0) {
        return { ok: false, message: "No local changes are available to stash." };
      }
      return { ok: true, message: "Ready to stash local changes." };
    }

    if (action === "apply" || action === "drop") {
      if (!clean(values.ref)) {
        return { ok: false, message: "Choose a stash entry first." };
      }
      return { ok: true, message: action === "apply" ? "Ready to apply stash." : "Ready to delete stash." };
    }

    return { ok: false, message: "Unknown stash action." };
  }

  function branchActionTarget(action, values) {
    if (action === "checkout-remote") return clean(values.localName) || clean(values.remoteBranch) || null;
    return clean(values.name) || null;
  }

  function isBranchActionAvailable(repo) {
    return Boolean(repo && repo.kind !== "no-folder" && repo.kind !== "folder-without-git");
  }

  function isSyncActionAvailable(repo) {
    return Boolean(repo &&
      repo.kind !== "no-folder" &&
      repo.kind !== "folder-without-git" &&
      primaryRemoteName(repo.git));
  }

  function isStashActionAvailable(repo) {
    return Boolean(repo && repo.kind !== "no-folder" && repo.kind !== "folder-without-git");
  }

  function branchStatusLabel(status) {
    if (!status) return "Ready";
    if (status.status === "running") return "Running";
    if (status.status === "failed" || status.status === "blocked") return "Error";
    return "Ready";
  }

  function branchStatusClass(status) {
    if (!status) return "ready";
    if (status.status === "running") return "warning";
    if (status.status === "failed" || status.status === "blocked") return "error";
    return "ready";
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
      conflicted: Array.isArray(source.conflicted) ? source.conflicted : files.filter((file) => file.conflicted),
      stashes: Array.isArray(source.stashes) ? source.stashes : []
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
    return /^https:\/\/[^\s]+$/i.test(url) ||
      /^git@github\.com:[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(url) ||
      /^git@[A-Za-z0-9_.-]+:[^\s]+$/i.test(url) ||
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
