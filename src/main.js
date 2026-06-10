(function () {
  const STORAGE_KEY = "source-companion.recentRepositories.v1";
  const MAX_RECENT = 8;
  let desktopBridge = resolveDesktopRepositoryBridge();

  const state = {
    desktopBridge,
    uiMode: resolveInitialUiMode(),
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
    repositoryMergeActionRunner: resolveRepositoryMergeActionRunner(),
    repositoryStashActionRunner: resolveRepositoryStashActionRunner(),
    repositoryCloneActionRunner: resolveRepositoryCloneActionRunner(),
    repositoryPublishPreflightRunner: resolveRepositoryPublishPreflightRunner(),
    repositoryPublishActionRunner: resolveRepositoryPublishActionRunner(),
    githubClient: resolveGitHubClient(),
    githubAuth: noGitHubAuthStatus(),
    githubRepositories: {
      status: "idle",
      query: "",
      items: [],
      selected: null,
      error: null
    },
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
  const githubAuthStatus = document.getElementById("githubAuthStatus");
  const githubRepoList = document.getElementById("githubRepoList");
  const githubRepoSearch = document.getElementById("githubRepoSearch");
  const githubRepositoryName = document.getElementById("githubRepositoryName");
  const githubSelectedUrl = document.getElementById("githubSelectedUrl");
  const appShell = typeof document.querySelector === "function" ? document.querySelector(".app-shell") : null;
  const floatingModeButton = document.getElementById("floatingModeButton");

  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      openDialog(button.dataset.openDialog);
    });
  });

  document.querySelectorAll("[data-folder-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      handleFolderDialog(button.dataset.folderDialog, button);
    });
  });

  document.querySelectorAll(".dialog-body").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitter = event.submitter;
      if (submitter && submitter.value === "cancel") {
        form.closest("dialog").close();
        return;
      }

      const handled = await handleFlow(form.dataset.flow, new FormData(form));
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

  if (floatingModeButton) {
    floatingModeButton.addEventListener("click", () => {
      setUiMode(state.uiMode === "floating" ? "full" : "floating");
    });
  }

  if (dialogs.github) {
    dialogs.github.addEventListener("click", (event) => {
      const target = event.target;
      if (!target) return;

      const authTarget = target.closest ? target.closest("[data-github-auth-action]") : target;
      if (authTarget && authTarget.dataset && authTarget.dataset.githubAuthAction) {
        runGitHubAuthAction(authTarget.dataset.githubAuthAction);
      }

      const searchTarget = target.closest ? target.closest("[data-github-repo-search]") : target;
      if (searchTarget && searchTarget.dataset &&
        Object.prototype.hasOwnProperty.call(searchTarget.dataset, "githubRepoSearch")) {
        searchGitHubRepositories();
      }

      const repoTarget = target.closest ? target.closest("[data-github-repo-name]") : target;
      if (repoTarget && repoTarget.dataset && repoTarget.dataset.githubRepoName) {
        const fullName = repoTarget.dataset.githubRepoName;
        selectGitHubRepository(
          state.githubRepositories.items.find((repo) => repo.fullName === fullName) || {
            fullName,
            cloneUrl: repoTarget.dataset.githubRepoCloneUrl || ""
          }
        );
      }
    });
  }

  if (githubRepoSearch) {
    githubRepoSearch.addEventListener("input", () => {
      state.githubRepositories.query = githubRepoSearch.value;
      renderGitHubDialog();
    });
  }

  render();
  refreshGitHubAuthStatus("startup");

  function openDialog(name) {
    const dialog = dialogs[name];
    if (!dialog) return;

    if (name === "github") {
      ensureGitHubClient();
      renderGitHubDialog();
      if (state.githubClient && state.githubAuth.status === "idle") {
        refreshGitHubAuthStatus("dialog");
      }
    }

    if (name === "publish") {
      preparePublishDialog(dialog);
    }

    dialog.showModal();
    const input = dialog.querySelector("input");
    if (input) input.focus();
  }

  function preparePublishDialog(dialog) {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!active) return;

    const pathInput = dialog.querySelector('input[name="path"]');
    const nameInput = dialog.querySelector('input[name="name"]');
    if (pathInput && !clean(pathInput.value)) {
      pathInput.value = active.path;
    }
    if (nameInput && !clean(nameInput.value)) {
      nameInput.value = displayNameFromPath(active.path);
    }
  }

  async function handleFolderDialog(flow, button) {
    const bridge = ensureDesktopBridge();
    if (!bridge) {
      setMessage("error", "Native folder dialogs are only available in the desktop app.");
      render();
      return;
    }

    const method = {
      open: "pickRepositoryFolder",
      clone: "pickCloneTargetFolder",
      github: "pickCloneTargetFolder",
      publish: "pickPublishFolder"
    }[flow];
    const field = {
      open: "path",
      clone: "target",
      github: "target",
      publish: "path"
    }[flow];
    if (!method || typeof bridge[method] !== "function") return;

    const form = button && typeof button.closest === "function" ? button.closest("form") : null;
    const input = form && typeof form.querySelector === "function"
      ? form.querySelector(`input[name="${field}"]`)
      : null;

    try {
      const result = await bridge[method]({ flow });
      if (!result || result.canceled) {
        setMessage("error", "Folder selection canceled.");
        render();
        return;
      }
      if (!result.ok || !isAbsolutePath(result.path)) {
        const message = result && result.error && result.error.message
          ? result.error.message
          : "Choose an existing local folder.";
        setMessage("error", message);
        render();
        return;
      }

      if (input) input.value = result.path;
      if (flow === "publish" && form) {
        const nameInput = form.querySelector('input[name="name"]');
        if (nameInput && !clean(nameInput.value)) {
          nameInput.value = displayNameFromPath(result.path);
        }
      }
      setMessage("success", "Folder selected.");
      render();
    } catch (error) {
      setMessage("error", error && error.message ? error.message : "Native folder dialog failed.");
      render();
    }
  }

  async function handleFlow(flow, formData) {
    if (flow === "open") {
      return openRepository(formData.get("path"));
    }

    if (flow === "clone") {
      return prepareClone(formData.get("url"), formData.get("target"));
    }

    if (flow === "github") {
      return prepareGitHubClone(formData.get("name"), formData.get("target"));
    }

    if (flow === "publish") {
      const path = clean(formData.get("path"));
      const name = clean(formData.get("name")) || displayNameFromPath(path);
      const description = clean(formData.get("description"));
      const visibility = clean(formData.get("visibility"));
      const initIfNeeded = Boolean(formData.get("initIfNeeded"));
      if (!isAbsolutePath(path) || !name) {
        setMessage("error", "Enter an absolute local folder and a repository name.");
        render();
        return false;
      }

      if (visibility === "public" && !confirmPublicPublish(name)) {
        return false;
      }

      await openPublishRepository({
        path,
        name,
        description,
        visibility,
        initIfNeeded,
        publicConfirmed: visibility === "public"
      });
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

    openCloneRepository({
      url,
      targetPath: target,
      displayName: displayNameFromPath(target)
    });
    return true;
  }

  function prepareGitHubClone(nameValue, targetValue) {
    const name = clean(nameValue);
    const target = clean(targetValue);
    const selected = selectedGitHubRepositoryForName(name);
    const cloneUrl = selected ? clean(selected.cloneUrl) : "";

    if (!selected || !name.includes("/") || !isCloneUrl(cloneUrl) || !isAbsolutePath(target)) {
      setMessage("error", "Select a GitHub repository and enter an absolute target folder.");
      render();
      return false;
    }

    openCloneRepository({
      url: cloneUrl,
      targetPath: target,
      displayName: displayNameFromPath(target) || selected.name || name.split("/").pop()
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

  async function openPublishRepository({ path, name, description, visibility, initIfNeeded, publicConfirmed }) {
    const existing = state.tabs.find((tab) => samePath(tab.path, path));
    if (existing) {
      state.activeTabId = existing.id;
      existing.publishRequest = {
        name,
        description,
        visibility,
        initIfNeeded,
        publicConfirmed
      };
      existing.publishAction = {
        status: "running",
        action: "publish-preflight",
        message: "Checking publish prerequisites.",
        completedAt: null
      };
      setMessage("success", `Checking publish prerequisites for ${name}.`);
      render();
      await runRepositoryPublishPreflight(existing.id);
      return;
    }

    const tab = createRepositoryContext({
      displayName: displayNameFromPath(path) || name,
      path,
      entryStatus: `Publish preflight: ${visibility || "private"}`
    });
    tab.publishRequest = {
      name,
      description,
      visibility,
      initIfNeeded,
      publicConfirmed
    };
    tab.publishAction = {
      status: "running",
      action: "publish-preflight",
      message: "Checking publish prerequisites.",
      completedAt: null
    };

    state.tabs.push(tab);
    state.activeTabId = tab.id;
    setMessage("success", `Checking publish prerequisites for ${name}.`);
    render();
    await runRepositoryPublishPreflight(tab.id);
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
    applyUiModeToShell();
    renderFloatingModeButton();
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

  function setUiMode(mode) {
    const nextMode = mode === "floating" ? "floating" : "full";
    state.uiMode = nextMode;
    render();
    applyNativeWindowMode(nextMode);
  }

  function applyUiModeToShell() {
    if (appShell && appShell.classList && typeof appShell.classList.toggle === "function") {
      appShell.classList.toggle("floating-mode", state.uiMode === "floating");
    }
  }

  function renderFloatingModeButton() {
    if (!floatingModeButton) return;
    floatingModeButton.textContent = state.uiMode === "floating" ? "Full UI" : "Floating Window";
    if (typeof floatingModeButton.setAttribute === "function") {
      floatingModeButton.setAttribute("aria-pressed", state.uiMode === "floating" ? "true" : "false");
    }
  }

  function applyNativeWindowMode(mode) {
    const bridge = state.desktopBridge;
    if (!bridge || typeof bridge.setWindowMode !== "function") return;

    const active = state.tabs.find((tab) => tab.id === state.activeTabId) || null;
    Promise.resolve(bridge.setWindowMode({
      mode,
      activeRepositoryId: active ? active.id : null,
      activeRepositoryPath: active ? active.path : null
    })).then((result) => {
      if (!result || result.ok !== false) return;
      const message = result.error && result.error.message
        ? result.error.message
        : "Desktop window mode could not be changed.";
      setMessage("error", message);
      render();
    }).catch((error) => {
      setMessage("error", error && error.message ? error.message : "Desktop window mode could not be changed.");
      render();
    });
  }

  function renderWorkspace() {
    const active = state.tabs.find((tab) => tab.id === state.activeTabId);

    if (state.uiMode === "floating") {
      renderFloatingWorkspace(active);
      return;
    }

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
        button.addEventListener("click", () => openDialog(button.dataset.openDialog));
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

    workspaceContent.querySelectorAll("[data-source-control-action]").forEach((button) => {
      button.addEventListener("click", () => {
        runSourceControlToolbarAction(active.id, button.dataset.sourceControlAction);
      });
    });

    workspaceContent.querySelectorAll("[data-source-control-view]").forEach((button) => {
      button.addEventListener("click", () => {
        setSourceControlViewMode(active.id, button.dataset.sourceControlView);
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

    workspaceContent.querySelectorAll("[data-merge-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runRepositoryMergeAction(active.id, new FormData(form));
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

    workspaceContent.querySelectorAll("[data-pr-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runPullRequestAction(active.id, "create", new FormData(form));
      });
    });

    workspaceContent.querySelectorAll("[data-pr-action]").forEach((button) => {
      button.addEventListener("click", () => {
        runPullRequestAction(active.id, button.dataset.prAction, null);
      });
    });
  }

  function renderFloatingWorkspace(active) {
    workspaceContent.innerHTML = active ? renderFloatingWindow(active) : renderFloatingEmpty();

    workspaceContent.querySelectorAll("[data-floating-commit-form]").forEach((form) => {
      const textarea = form.querySelector("[data-commit-message]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (textarea) {
          const tab = state.tabs.find((item) => item.id === state.activeTabId);
          if (tab) tab.commitMessage = textarea.value;
        }
        if (active) runRepositoryCommitAction(active.id, "commit");
      });
      if (textarea) {
        textarea.addEventListener("input", () => {
          const tab = state.tabs.find((item) => item.id === state.activeTabId);
          if (!tab) return;
          tab.commitMessage = textarea.value;
        });
      }
    });

    workspaceContent.querySelectorAll("[data-floating-commit-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (active) runRepositoryCommitAction(active.id, button.dataset.floatingCommitAction);
      });
    });

    workspaceContent.querySelectorAll("[data-floating-sync-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (active) runRepositorySyncAction(active.id, button.dataset.floatingSyncAction);
      });
    });

    workspaceContent.querySelectorAll("[data-floating-action]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.floatingAction === "open-full-ui") {
          setUiMode("full");
        }
        if (button.dataset.floatingAction === "refresh" && active) {
          runSourceControlToolbarAction(active.id, "refresh");
        }
      });
    });
  }

  function renderFloatingEmpty() {
    return `
      <article class="floating-window empty" aria-label="Floating source control">
        <div class="floating-header">
          <div>
            <h2>No repository open</h2>
            <p>Open the Full UI to choose a repository.</p>
          </div>
        </div>
        <div class="floating-actions">
          <button class="button primary" type="button" data-floating-action="open-full-ui">Open Full UI</button>
        </div>
      </article>
    `;
  }

  function renderFloatingWindow(repo) {
    const commitValidation = validateFloatingCommitAction(repo, "commit");
    const commitAndPushValidation = validateFloatingSyncAction(repo, "commit-and-push");
    const pushValidation = validateFloatingSyncAction(repo, "push");
    const syncValidation = validateFloatingSyncAction(repo, "sync");
    const refreshRunning = repo.lastRefresh && repo.lastRefresh.status === "running";
    const writeBusy = isRepositoryWriteBusy(repo);
    const status = floatingStatus(repo);

    return `
      <article class="floating-window" aria-label="Floating source control">
        <div class="floating-header">
          <div>
            <h2>${escapeHtml(repo.displayName)}</h2>
            <p title="${escapeHtml(repo.path)}">${escapeHtml(branchLabel(repo.git.branch))} / ${escapeHtml(upstreamLabel(repo.git.upstream))} / ${escapeHtml(divergenceLabel(repo.git.divergence))}</p>
          </div>
          <span class="status-pill ${escapeHtml(floatingSyncStateClass(repo))}">${escapeHtml(floatingSyncStateLabel(repo))}</span>
        </div>
        <div class="floating-counts" aria-label="Change counts">
          ${floatingChangeCountItems(repo.git).map((item) => `
            <div>
              <strong>${escapeHtml(item.count)}</strong>
              <span>${escapeHtml(item.label)}</span>
            </div>
          `).join("")}
        </div>
        <form class="floating-commit" data-floating-commit-form>
          <label class="commit-message-label">
            <span>Commit Message</span>
            <textarea data-commit-message rows="3" autocomplete="off" placeholder="Describe staged changes">${escapeHtml(repo.commitMessage || "")}</textarea>
          </label>
          <div class="floating-actions">
            <button class="button primary" type="submit" ${commitValidation.ok && !writeBusy ? "" : "disabled"} title="${escapeHtml(commitValidation.message)}">Commit</button>
            <button class="button" type="button" data-floating-commit-action="commit-and-push" ${commitAndPushValidation.ok && !writeBusy ? "" : "disabled"} title="${escapeHtml(commitAndPushValidation.message)}">Commit and Push</button>
            <button class="button" type="button" data-floating-sync-action="push" ${pushValidation.ok && !writeBusy ? "" : "disabled"} title="${escapeHtml(pushValidation.message)}">Push</button>
            <button class="button" type="button" data-floating-sync-action="sync" ${syncValidation.ok && !writeBusy ? "" : "disabled"} title="${escapeHtml(syncValidation.message)}">Pull/Sync</button>
          </div>
        </form>
        <div class="floating-status ${escapeHtml(status.kind)}" tabindex="0">${escapeHtml(status.message)}</div>
        <div class="floating-actions secondary">
          <button class="button compact" type="button" data-floating-action="refresh" ${refreshRunning ? "disabled" : ""}>Refresh</button>
          <button class="button compact" type="button" data-floating-action="open-full-ui">Open Full UI</button>
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
        files: [],
        history: emptyHistoryState()
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
      sourceControlViewMode: "split",
      selectedChangeKey: null,
      diffPreview: null,
      fileAction: null,
      commitMessage: "",
      commitAction: null,
      branchAction: null,
      syncAction: null,
      mergeAction: null,
      stashAction: null,
      cloneAction: null,
      cloneRequest: null,
      publishAction: null,
      publishRequest: null,
      pullRequest: emptyPullRequestState(),
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
        githubAuthProvider: () => state.githubAuth,
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
        operations: tab.operations,
        githubAuth: state.githubAuth
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
    syncPullRequestState(tab);
    tab.operations = normalizeOperations(loaded.operations || tab.operations);
    tab.error = loaded.error || null;
    tab.lastRefresh = {
      ...tab.lastRefresh,
      status: refreshStatus,
      completedAt: new Date().toISOString()
    };

    render();
    maybeAutoLoadPullRequests(tab.id);
  }

  async function refreshGitHubAuthStatus(reason) {
    const githubClient = ensureGitHubClient();
    if (!githubClient || typeof githubClient.getAuthStatus !== "function") {
      state.githubAuth = noGitHubAuthStatus({
        kind: "github-login-unavailable",
        message: "GitHub login is not available in this runtime."
      });
      renderGitHubDialog();
      return;
    }

    state.githubAuth = {
      ...state.githubAuth,
      status: "running",
      error: null,
      reason
    };
    renderGitHubDialog();

    try {
      state.githubAuth = normalizeGitHubAuthStatus(await githubClient.getAuthStatus());
    } catch (error) {
      state.githubAuth = noGitHubAuthStatus({
        kind: "github-auth-error",
        message: error && error.message ? error.message : "GitHub auth status could not be loaded."
      });
    }

    renderGitHubDialog();
    refreshOpenRepositoryGitHubState();
  }

  async function runGitHubAuthAction(action) {
    const githubClient = ensureGitHubClient();
    if (!githubClient) {
      state.githubAuth = noGitHubAuthStatus({
        kind: "github-login-unavailable",
        message: "GitHub login is not available in this runtime."
      });
      renderGitHubDialog();
      return;
    }

    state.githubAuth = {
      ...state.githubAuth,
      status: "running",
      error: null
    };
    renderGitHubDialog();

    try {
      if (action === "login" && typeof githubClient.login === "function") {
        state.githubAuth = normalizeGitHubAuthStatus(await githubClient.login());
      } else if (action === "logout" && typeof githubClient.logout === "function") {
        state.githubAuth = normalizeGitHubAuthStatus(await githubClient.logout());
        state.githubRepositories.items = [];
        state.githubRepositories.selected = null;
      } else {
        state.githubAuth = noGitHubAuthStatus({
          kind: "github-login-unavailable",
          message: "GitHub auth action is not available in this runtime."
        });
      }
    } catch (error) {
      state.githubAuth = noGitHubAuthStatus({
        kind: "github-auth-error",
        message: error && error.message ? error.message : "GitHub auth action failed."
      });
    }

    renderGitHubDialog();
    refreshOpenRepositoryGitHubState();
  }

  async function searchGitHubRepositories() {
    const githubClient = ensureGitHubClient();
    const query = githubRepoSearch ? githubRepoSearch.value : state.githubRepositories.query;
    state.githubRepositories = {
      ...state.githubRepositories,
      status: "running",
      query,
      error: null
    };
    renderGitHubDialog();

    if (!githubClient || typeof githubClient.searchUserRepositories !== "function") {
      state.githubRepositories = {
        ...state.githubRepositories,
        status: "failed",
        items: [],
        error: {
          kind: "github-api-unavailable",
          message: "GitHub repository search is not available in this runtime."
        }
      };
      renderGitHubDialog();
      return;
    }

    try {
      const result = await githubClient.searchUserRepositories({ query });
      state.githubRepositories = {
        ...state.githubRepositories,
        status: result.ok ? "idle" : "failed",
        items: result.ok ? result.repositories : [],
        selected: result.ok ? state.githubRepositories.selected : null,
        error: result.ok ? null : result.error
      };
    } catch (error) {
      state.githubRepositories = {
        ...state.githubRepositories,
        status: "failed",
        items: [],
        error: {
          kind: "github-api-error",
          message: error && error.message ? error.message : "GitHub repositories could not be loaded."
        }
      };
    }

    renderGitHubDialog();
  }

  function selectGitHubRepository(repo) {
    state.githubRepositories.selected = repo;
    if (githubRepositoryName) {
      githubRepositoryName.value = repo.fullName;
    }
    renderGitHubDialog();
  }

  function selectedGitHubRepositoryForName(name) {
    const normalizedName = clean(name);
    const selected = state.githubRepositories.selected;
    if (selected && selected.fullName === normalizedName) return selected;
    return state.githubRepositories.items.find((repo) => repo.fullName === normalizedName) || null;
  }

  function renderGitHubDialog() {
    if (!githubAuthStatus || !githubRepoList) return;

    const auth = state.githubAuth || noGitHubAuthStatus();
    const runningAuth = auth.status === "running";
    const loginLabel = auth.authenticated ? `Logged in as ${auth.user || "GitHub user"}` : "Not logged in";
    const authError = auth.error ? `<span>${escapeHtml(auth.error.kind)}: ${escapeHtml(auth.error.message)}</span>` : "";
    githubAuthStatus.innerHTML = `
      <strong>${escapeHtml(loginLabel)}</strong>
      ${authError}
      ${auth.tokenSource ? `<small>${escapeHtml(auth.tokenSource)}</small>` : ""}
    `;

    dialogs.github.querySelectorAll("[data-github-auth-action]").forEach((button) => {
      const action = button.dataset.githubAuthAction;
      button.disabled = runningAuth || !state.githubClient || (action === "logout" && !auth.authenticated);
    });

    const selected = state.githubRepositories.selected;
    if (githubSelectedUrl) {
      githubSelectedUrl.textContent = selected && selected.cloneUrl ? `Clone URL: ${selected.cloneUrl}` : "";
    }

    const status = state.githubRepositories.status;
    if (!auth.authenticated) {
      githubRepoList.innerHTML = '<div class="github-repo-empty">GitHub login is required to load repositories.</div>';
      return;
    }

    if (status === "running") {
      githubRepoList.innerHTML = '<div class="github-repo-empty">Loading GitHub repositories.</div>';
      return;
    }

    if (state.githubRepositories.error) {
      githubRepoList.innerHTML = `
        <div class="github-repo-error">
          <strong>${escapeHtml(state.githubRepositories.error.kind || "github-api-error")}</strong>
          <span>${escapeHtml(state.githubRepositories.error.message || "GitHub repositories could not be loaded.")}</span>
        </div>
      `;
      return;
    }

    const repos = state.githubRepositories.items;
    if (!repos.length) {
      githubRepoList.innerHTML = '<div class="github-repo-empty">No repositories loaded.</div>';
      return;
    }

    githubRepoList.innerHTML = repos.slice(0, 20).map((repo) => `
      <button class="github-repo-item${selected && selected.fullName === repo.fullName ? " selected" : ""}" type="button" data-github-repo-name="${escapeHtml(repo.fullName)}" data-github-repo-clone-url="${escapeHtml(repo.cloneUrl)}">
        <span>
          <strong>${escapeHtml(repo.fullName)}</strong>
          <small>${escapeHtml(repo.description || "No description")}</small>
          <small>${escapeHtml(repo.cloneUrl || "No clone URL")}</small>
        </span>
        <span class="github-repo-meta">
          <span class="status-pill ${repo.private ? "warning" : "ready"}">${escapeHtml(repo.visibility || (repo.private ? "private" : "public"))}</span>
          <span class="status-pill">${escapeHtml(`${repo.stars || 0} stars`)}</span>
        </span>
      </button>
    `).join("");
  }

  function refreshOpenRepositoryGitHubState() {
    state.tabs.forEach((tab) => {
      if (tab.github) {
        refreshRepositoryState(tab.id, "github-auth");
      }
    });
  }

  function syncPullRequestState(tab) {
    const current = tab.pullRequest || emptyPullRequestState();
    const contextKey = pullRequestContextKey(tab);
    const sameContext = current.contextKey === contextKey;
    const branch = currentBranchName(tab.git);
    const repository = tab.github && tab.github.status === "ready" ? {
      owner: tab.github.owner,
      name: tab.github.name || tab.github.repository,
      fullName: tab.github.fullName,
      remoteName: tab.github.remoteName || tab.github.remote,
      htmlUrl: tab.github.htmlUrl
    } : null;

    tab.pullRequest = {
      ...emptyPullRequestState(),
      ...(sameContext ? current : {}),
      contextKey,
      branch,
      repository,
      base: sameContext ? clean(current.base) || defaultPullRequestBase(tab.git) : defaultPullRequestBase(tab.git),
      title: sameContext ? clean(current.title) : defaultPullRequestTitle(branch),
      description: sameContext ? clean(current.description) : ""
    };
  }

  function maybeAutoLoadPullRequests(tabId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || !tab.pullRequest) return;
    const validation = validatePullRequestAction(tab, "load");
    if (!validation.ok) return;
    if (tab.pullRequest.status === "running") return;
    if (tab.pullRequest.loadedKey === tab.pullRequest.contextKey) return;

    runPullRequestAction(tabId, "load", null);
  }

  async function runPullRequestAction(tabId, action, values) {
    if (action === "load") {
      await loadPullRequests(tabId);
      return;
    }

    if (action === "create") {
      await createPullRequest(tabId, values);
    }
  }

  async function loadPullRequests(tabId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const validation = validatePullRequestAction(tab, "load");
    if (!validation.ok) {
      applyPullRequestResult(tabId, pullRequestFailureResult("github-pr-list", validation.message, {
        kind: "pull-request-unavailable",
        message: validation.message
      }));
      return;
    }

    tab.pullRequest = {
      ...(tab.pullRequest || emptyPullRequestState()),
      status: "running",
      message: "Loading pull requests for this branch.",
      error: null
    };
    render();

    const github = tab.github;
    const branch = currentBranchName(tab.git);
    try {
      const result = await state.githubClient.listPullRequests({
        owner: github.owner,
        repo: github.name || github.repository,
        branch,
        headOwner: github.owner
      });
      const existingPullRequest = result && result.ok ? result.pullRequests && result.pullRequests[0] : null;
      const [checkStatus, reviewContext] = await Promise.all([
        loadPullRequestChecksFor(tab, existingPullRequest),
        loadPullRequestReviewContextFor(tab, existingPullRequest)
      ]);
      applyPullRequestResult(tabId, {
        ...result,
        action: "github-pr-list",
        branch,
        repository: github.fullName,
        checkStatus,
        reviewContext,
        command: { display: "GitHub PR lookup" },
        message: pullRequestListMessage(result)
      });
    } catch (error) {
      applyPullRequestResult(tabId, pullRequestFailureResult("github-pr-list", error && error.message ? error.message : "Pull requests could not be loaded.", {
        kind: "github-pr-list-error",
        message: error && error.message ? error.message : "Pull requests could not be loaded."
      }));
    }
  }

  async function createPullRequest(tabId, values) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const base = clean(values && values.get ? values.get("base") : tab.pullRequest && tab.pullRequest.base);
    const title = clean(values && values.get ? values.get("title") : tab.pullRequest && tab.pullRequest.title);
    const description = clean(values && values.get ? values.get("description") : tab.pullRequest && tab.pullRequest.description);
    const draft = Boolean(values && values.get && values.get("draft"));
    const validation = validatePullRequestAction(tab, "create", { base, title });
    if (!validation.ok) {
      applyPullRequestResult(tabId, pullRequestFailureResult("github-pr-create", validation.message, {
        kind: "pull-request-unavailable",
        message: validation.message
      }));
      return;
    }

    tab.pullRequest = {
      ...(tab.pullRequest || emptyPullRequestState()),
      status: "running",
      base,
      title,
      description,
      message: "Creating pull request.",
      error: null
    };
    render();

    const github = tab.github;
    const head = currentBranchName(tab.git);
    try {
      const result = await state.githubClient.createPullRequest({
        owner: github.owner,
        repo: github.name || github.repository,
        base,
        head,
        title,
        description,
        draft
      });
      const createdPullRequest = result && result.ok ? result.pullRequest : null;
      const [checkStatus, reviewContext] = await Promise.all([
        loadPullRequestChecksFor(tab, createdPullRequest),
        loadPullRequestReviewContextFor(tab, createdPullRequest)
      ]);
      applyPullRequestResult(tabId, {
        ...result,
        action: "github-pr-create",
        base,
        head,
        repository: github.fullName,
        checkStatus,
        reviewContext,
        command: { display: "GitHub PR create" },
        message: pullRequestCreateMessage(result)
      });
    } catch (error) {
      applyPullRequestResult(tabId, pullRequestFailureResult("github-pr-create", error && error.message ? error.message : "Pull request could not be created.", {
        kind: "github-pr-create-error",
        message: error && error.message ? error.message : "Pull request could not be created."
      }));
    }
  }

  async function loadPullRequestChecksFor(tab, pullRequest) {
    if (!pullRequest) return normalizePullRequestCheckState();
    if (!state.githubClient || typeof state.githubClient.loadPullRequestChecks !== "function") {
      return normalizePullRequestCheckState({
        status: "blocked",
        state: "unknown",
        message: "GitHub check lookup is not available in this runtime.",
        error: {
          kind: "github-checks-unavailable",
          message: "GitHub check lookup is not available in this runtime."
        }
      });
    }

    const github = tab.github || {};
    const ref = pullRequest.head && (pullRequest.head.sha || pullRequest.head.ref)
      ? pullRequest.head.sha || pullRequest.head.ref
      : currentBranchName(tab.git);

    try {
      const result = await state.githubClient.loadPullRequestChecks({
        owner: github.owner,
        repo: github.name || github.repository,
        ref,
        branch: currentBranchName(tab.git)
      });
      return normalizePullRequestCheckState({
        status: result.ok ? "succeeded" : "failed",
        state: result.state,
        message: result.summary,
        summary: result.summary,
        statuses: result.statuses,
        checks: result.checks,
        error: result.error || null
      });
    } catch (error) {
      return normalizePullRequestCheckState({
        status: "failed",
        state: "unknown",
        message: error && error.message ? error.message : "GitHub checks could not be loaded.",
        error: {
          kind: "github-checks-error",
          message: error && error.message ? error.message : "GitHub checks could not be loaded."
        }
      });
    }
  }

  async function loadPullRequestReviewContextFor(tab, pullRequest) {
    if (!pullRequest) return normalizePullRequestReviewContextState();
    if (!state.githubClient || typeof state.githubClient.loadPullRequestReviewContext !== "function") {
      return normalizePullRequestReviewContextState({
        status: "blocked",
        summary: "GitHub review context lookup is not available in this runtime.",
        error: {
          kind: "github-review-context-unavailable",
          message: "GitHub review context lookup is not available in this runtime."
        }
      });
    }

    const github = tab.github || {};
    try {
      const result = await state.githubClient.loadPullRequestReviewContext({
        owner: github.owner,
        repo: github.name || github.repository,
        pullNumber: pullRequest.number,
        branch: currentBranchName(tab.git),
        commitMessages: commitMessagesForIssueDetection(tab.git)
      });
      return normalizePullRequestReviewContextState({
        status: result.ok ? "succeeded" : "failed",
        summary: result.summary,
        reviewComments: result.reviewComments,
        issueLinks: result.issueLinks,
        error: result.error || null
      });
    } catch (error) {
      return normalizePullRequestReviewContextState({
        status: "failed",
        summary: error && error.message ? error.message : "GitHub review context could not be loaded.",
        error: {
          kind: "github-review-context-error",
          message: error && error.message ? error.message : "GitHub review context could not be loaded."
        }
      });
    }
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

  function runSourceControlToolbarAction(tabId, action) {
    if (action === "refresh") {
      refreshRepositoryState(tabId, "toolbar");
      return;
    }

    if (action === "commit") {
      runRepositoryCommitAction(tabId, "commit");
    }
  }

  function setSourceControlViewMode(tabId, mode) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.sourceControlViewMode = normalizeSourceControlViewMode(mode);
    render();
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

    if (tab.mergeAction && tab.mergeAction.status === "running") {
      tab.branchAction = {
        status: "failed",
        action,
        branch: branchActionTarget(action, values),
        message: "Merge action is running.",
        completedAt: new Date().toISOString()
      };
      render();
      return;
    }

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

  async function runRepositoryMergeAction(tabId, formData) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const target = clean(formData.get("target"));
    const validation = validateMergeAction(tab, { target });
    if (!validation.ok) {
      tab.mergeAction = {
        status: "failed",
        action: "merge",
        branch: target || null,
        message: validation.message,
        completedAt: new Date().toISOString()
      };
      render();
      return;
    }

    tab.mergeAction = {
      status: "running",
      action: "merge",
      branch: target,
      message: mergeActionRunningLabel(target),
      completedAt: null
    };
    render();

    const runMergeAction = state.repositoryMergeActionRunner;
    if (!runMergeAction) {
      applyMergeActionResult(tabId, {
        ok: false,
        action: "merge",
        branch: target,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository merge actions are not available in this runtime.",
        error: {
          kind: "repository-merge-actions-unavailable",
          message: "Repository merge actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runMergeAction({
        repositoryPath: tab.path,
        git: tab.git,
        target
      });
      applyMergeActionResult(tabId, result);
      refreshRepositoryState(tabId, "merge");
    } catch (error) {
      applyMergeActionResult(tabId, {
        ok: false,
        action: "merge",
        branch: target,
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Merge action failed.",
        error: {
          kind: "merge-action-error",
          message: error && error.message ? error.message : "Merge action failed."
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

  async function runRepositoryPublishAction(tabId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || !tab.publishRequest) return;

    const runPublishAction = state.repositoryPublishActionRunner;
    if (!runPublishAction) {
      applyPublishActionResult(tabId, {
        ok: false,
        action: "publish",
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Repository publish actions are not available in this runtime.",
        error: {
          kind: "repository-publish-actions-unavailable",
          message: "Repository publish actions are not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await runPublishAction({
        repositoryPath: tab.path,
        name: tab.publishRequest.name,
        description: tab.publishRequest.description,
        visibility: tab.publishRequest.visibility,
        initIfNeeded: tab.publishRequest.initIfNeeded,
        githubClient: state.githubClient
      });
      applyPublishActionResult(tabId, result);
      if (result.ok) {
        const updated = state.tabs.find((item) => item.id === tabId);
        if (updated) {
          updated.entryStatus = "Publish completed";
          updated.publishRequest = null;
          addRecent(updated);
          startRepositoryWatch(updated);
          refreshRepositoryState(tabId, "publish");
        }
      }
    } catch (error) {
      applyPublishActionResult(tabId, {
        ok: false,
        action: "publish",
        command: null,
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Publish failed.",
        error: {
          kind: "publish-action-error",
          message: error && error.message ? error.message : "Publish failed."
        }
      });
    }
  }

  async function runRepositoryPublishPreflight(tabId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || !tab.publishRequest) return;

    const preparePublishPreflight = state.repositoryPublishPreflightRunner;
    if (!preparePublishPreflight) {
      applyPublishPreflightResult(tabId, {
        ok: false,
        action: "publish-preflight",
        request: tab.publishRequest,
        command: null,
        checks: [],
        stdout: "",
        stderr: "",
        exitCode: null,
        message: "Publish preflight is not available in this runtime.",
        error: {
          kind: "publish-preflight-unavailable",
          message: "Publish preflight is not available in this runtime."
        }
      });
      return;
    }

    try {
      const result = await preparePublishPreflight({
        repositoryPath: tab.path,
        name: tab.publishRequest.name,
        description: tab.publishRequest.description,
        visibility: tab.publishRequest.visibility,
        initIfNeeded: tab.publishRequest.initIfNeeded,
        publicConfirmed: tab.publishRequest.publicConfirmed,
        githubClient: state.githubClient
      });
      applyPublishPreflightResult(tabId, result);
      startRepositoryWatch(tab);
      refreshRepositoryState(tabId, "publish-preflight");
    } catch (error) {
      applyPublishPreflightResult(tabId, {
        ok: false,
        action: "publish-preflight",
        request: tab.publishRequest,
        command: null,
        checks: [],
        stdout: "",
        stderr: "",
        exitCode: null,
        message: error && error.message ? error.message : "Publish preflight failed.",
        error: {
          kind: "publish-preflight-error",
          message: error && error.message ? error.message : "Publish preflight failed."
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

  function applyMergeActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.mergeAction = {
      status: result.ok ? "succeeded" : "failed",
      action: result.action || "merge",
      branch: result.branch || null,
      message: result.message,
      error: result.error || null,
      completedAt: new Date().toISOString()
    };
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Merge completed." : "Merge failed."));
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

  function applyPublishActionResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const completedAt = new Date().toISOString();
    tab.publishAction = {
      status: result.ok ? "succeeded" : "failed",
      action: "publish",
      visibility: result.visibility || tab.publishRequest && tab.publishRequest.visibility || null,
      repository: result.repository || null,
      message: result.message,
      error: result.error || null,
      completedAt
    };
    tab.operations.running = [];
    tab.operations.queued = [];
    tab.operations.lastCompleted = {
      id: `${tab.id}:publish:completed`,
      repositoryId: tab.id,
      kind: "publish",
      action: "publish",
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
        kind: "publish-error",
        message: result.message || "Publish failed."
      };
      tab.lastRefresh = {
        ...tab.lastRefresh,
        status: "failed",
        completedAt
      };
    }
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Publish completed." : "Publish failed."));
    render();
  }

  function applyPublishPreflightResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const completedAt = new Date().toISOString();
    tab.publishAction = {
      status: result.ok ? "succeeded" : "blocked",
      action: "publish-preflight",
      visibility: result.visibility || tab.publishRequest && tab.publishRequest.visibility || null,
      repository: null,
      checks: Array.isArray(result.checks) ? result.checks : [],
      needsGitInit: Boolean(result.needsGitInit),
      needsCommit: Boolean(result.needsCommit),
      remotes: Array.isArray(result.remotes) ? result.remotes : [],
      message: result.message,
      error: result.error || null,
      completedAt
    };
    tab.entryStatus = result.ok ? "Publish preflight ready" : "Publish preflight blocked";
    tab.error = result.ok ? null : result.error || null;
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", result.message || (result.ok ? "Publish preflight ready." : "Publish preflight blocked."));
    render();
  }

  function applyPullRequestResult(tabId, result) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    const existingState = tab.pullRequest || emptyPullRequestState();
    const pullRequests = Array.isArray(result.pullRequests) ? result.pullRequests :
      (result.pullRequest ? [result.pullRequest, ...existingState.pullRequests.filter((item) => item.number !== result.pullRequest.number)] : existingState.pullRequests);
    const existing = result.pullRequest || pullRequests[0] || null;
    const completedAt = new Date().toISOString();

    tab.pullRequest = {
      ...existingState,
      status: result.ok ? "succeeded" : "failed",
      message: result.message || (result.ok ? "Pull request action completed." : "Pull request action failed."),
      pullRequests,
      existing,
      checkStatus: normalizePullRequestCheckState(result.checkStatus || existingState.checkStatus),
      reviewContext: normalizePullRequestReviewContextState(result.reviewContext || existingState.reviewContext),
      loadedKey: result.ok ? existingState.contextKey : existingState.loadedKey,
      created: result.pullRequest || existingState.created,
      error: result.error || null,
      completedAt
    };
    tab.gitOutput = [createGitOutputEntry(result), ...tab.gitOutput].slice(0, 8);
    setMessage(result.ok ? "success" : "error", tab.pullRequest.message);
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
      command: sanitizeGitOutputText(gitOutputCommandLabel(result, command, args)),
      stdout: sanitizeGitOutputText(result.stdout || ""),
      stderr: sanitizeGitOutputText(result.stderr || ""),
      exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
      message: sanitizeGitOutputText(result.message || ""),
      error: result.error || null,
      details: gitOutputDetails(result).map(sanitizeGitOutputText),
      completedAt: new Date().toISOString()
    };
  }

  function gitOutputCommandLabel(result, command, args) {
    if (command.display) return command.display;
    if (result.action === "publish-preflight") return "Publish preflight";
    if (result.action === "github-pr-list") return "GitHub PR lookup";
    if (result.action === "github-pr-create") return "GitHub PR create";
    if (args.length > 0) return `git ${args.join(" ")}`;
    return "git";
  }

  function gitOutputDetails(result) {
    const details = [];
    if (result.error && result.error.kind) {
      details.push(`${result.error.kind}: ${result.error.message || result.message || "Action failed."}`);
    }
    if (Array.isArray(result.checks)) {
      result.checks.forEach((check) => {
        details.push(`${check.ok ? "OK" : "Blocked"}: ${check.label || "Check"} - ${check.message || ""}`);
      });
    }
    if (result.repository) details.push(`Repository: ${formatRepositoryDetail(result.repository)}`);
    if (result.branch) details.push(`Branch: ${result.branch}`);
    if (result.base || result.head) details.push(`PR target: ${result.head || "head"} -> ${result.base || "base"}`);
    if (result.pullRequest && result.pullRequest.htmlUrl) details.push(`Pull request: ${result.pullRequest.htmlUrl}`);
    if (Array.isArray(result.pullRequests) && result.pullRequests[0] && result.pullRequests[0].htmlUrl) {
      details.push(`Pull request: ${result.pullRequests[0].htmlUrl}`);
    }
    if (result.checkStatus) {
      const checkStatus = normalizePullRequestCheckState(result.checkStatus);
      details.push(`PR checks: ${pullRequestCheckLabel(checkStatus.state)} - ${checkStatus.message || checkStatus.summary}`);
      [...checkStatus.statuses, ...checkStatus.checks].forEach((check) => {
        details.push(`Check ${check.state || "unknown"}: ${check.name || "Check"}${check.detailsUrl || check.htmlUrl ? ` - ${check.detailsUrl || check.htmlUrl}` : ""}`);
      });
    }
    if (result.reviewContext) {
      const reviewContext = normalizePullRequestReviewContextState(result.reviewContext);
      details.push(`PR review context: ${reviewContext.summary}`);
      reviewContext.reviewComments.forEach((comment) => {
        details.push(`Review comment: ${comment.path || "file"}${comment.line ? `:${comment.line}` : ""}${comment.htmlUrl ? ` - ${comment.htmlUrl}` : ""}`);
      });
      reviewContext.issueLinks.forEach((issue) => {
        details.push(`Issue ${issue.status || "unknown"}: #${issue.number}${issue.htmlUrl ? ` - ${issue.htmlUrl}` : ""}`);
      });
    }
    return details;
  }

  function formatRepositoryDetail(repository) {
    if (!repository || typeof repository !== "object") {
      return sanitizeRepositoryUrl(repository);
    }

    const owner = clean(repository.owner);
    const name = clean(repository.name);
    const fullName = clean(repository.fullName || repository.full_name) || (owner && name ? `${owner}/${name}` : name || owner);
    const visibility = clean(repository.visibility) || (repository.private === true ? "private" : repository.private === false ? "public" : "");
    const url = sanitizeRepositoryUrl(repository.htmlUrl || repository.html_url || repository.cloneUrl || repository.clone_url || repository.sshUrl || repository.ssh_url);
    return [fullName || "GitHub repository", visibility, url].filter(Boolean).join(" / ");
  }

  function sanitizeRepositoryUrl(value) {
    const url = clean(value);
    return sanitizeGitOutputText(url);
  }

  function sanitizeGitOutputText(value) {
    return clean(value).replace(/(https?:\/\/)[^@\s/]+@/gi, "$1");
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

  function confirmPublicPublish(name) {
    return window.confirm(`Publish ${name} as a public GitHub repository?\n\nPublic repositories are visible to everyone.`);
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
    if (desktopBridge && typeof desktopBridge.loadRepositoryState === "function") {
      return desktopBridge.loadRepositoryState;
    }

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
    if (desktopBridge &&
      typeof desktopBridge.startRepositoryWatch === "function" &&
      typeof desktopBridge.getRepositoryWatch === "function" &&
      typeof desktopBridge.stopRepositoryWatch === "function") {
      return createDesktopRepositoryStatusWatcher(desktopBridge);
    }

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

  function createDesktopRepositoryStatusWatcher(bridge) {
    return {
      watchRepository(options = {}) {
        return createDesktopRepositoryWatchHandle(bridge, options);
      }
    };
  }

  function createDesktopRepositoryWatchHandle(bridge, {
    repositoryId,
    repositoryPath,
    githubAuthProvider = () => null,
    onState = () => {},
    onError = () => {}
  } = {}) {
    const pollEveryMs = 500;
    const setIntervalFn = window.setInterval || (typeof setInterval === "function" ? setInterval : null);
    const clearIntervalFn = window.clearInterval || (typeof clearInterval === "function" ? clearInterval : null);
    let closed = false;
    let timer = null;
    let snapshot = {
      repositoryId,
      repositoryPath,
      status: "starting",
      pendingReasons: [],
      watchTargets: [],
      errors: []
    };
    let lastStateToken = null;
    let lastErrorToken = null;

    const request = () => ({
      repositoryId,
      repositoryPath,
      githubAuth: githubAuthProvider()
    });

    const applyWatchResult = (result) => {
      if (closed || !result) return;
      if (result.snapshot) snapshot = result.snapshot;

      const stateToken = result.snapshot
        ? `${result.snapshot.refreshCount || 0}:${result.snapshot.lastRefreshCompletedAt || ""}`
        : "";
      if (result.latestState && stateToken !== lastStateToken) {
        lastStateToken = stateToken;
        onState(result.latestState, { repositoryId, reasons: result.snapshot && result.snapshot.pendingReasons || [] });
      }

      if (result.latestError) {
        const errorToken = `${result.latestError.kind || ""}:${result.latestError.message || ""}`;
        if (errorToken !== lastErrorToken) {
          lastErrorToken = errorToken;
          onError(result.latestError, { repositoryId });
        }
      }
    };

    const poll = async () => {
      if (closed) return;
      try {
        applyWatchResult(await bridge.getRepositoryWatch(request()));
      } catch (error) {
        if (!closed) {
          onError({
            kind: "repository-watch-error",
            message: error && error.message ? error.message : "Desktop repository watcher failed."
          }, { repositoryId });
        }
      }
    };

    Promise.resolve(bridge.startRepositoryWatch(request()))
      .then(applyWatchResult)
      .catch((error) => {
        if (!closed) {
          onError({
            kind: "repository-watch-error",
            message: error && error.message ? error.message : "Desktop repository watcher could not start."
          }, { repositoryId });
        }
      });

    if (setIntervalFn) {
      timer = setIntervalFn(poll, pollEveryMs);
    }

    return {
      close() {
        closed = true;
        if (timer && clearIntervalFn) clearIntervalFn(timer);
        timer = null;
        Promise.resolve(bridge.stopRepositoryWatch(request())).catch(() => {});
      },
      getSnapshot() {
        return {
          ...snapshot,
          pendingReasons: [...(snapshot.pendingReasons || [])],
          watchTargets: [...(snapshot.watchTargets || [])],
          errors: [...(snapshot.errors || [])]
        };
      }
    };
  }

  function resolveRepositoryDiffLoader() {
    if (desktopBridge && typeof desktopBridge.loadFileDiff === "function") {
      return desktopBridge.loadFileDiff;
    }

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
    if (desktopBridge && typeof desktopBridge.runFileAction === "function") {
      return desktopBridge.runFileAction;
    }

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
    if (desktopBridge && typeof desktopBridge.runHunkAction === "function") {
      return desktopBridge.runHunkAction;
    }

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
    if (desktopBridge && typeof desktopBridge.runCommitAction === "function") {
      return desktopBridge.runCommitAction;
    }

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
    if (desktopBridge && typeof desktopBridge.runBranchAction === "function") {
      return desktopBridge.runBranchAction;
    }

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
    if (desktopBridge && typeof desktopBridge.runSyncAction === "function") {
      return desktopBridge.runSyncAction;
    }

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

  function resolveRepositoryMergeActionRunner() {
    if (desktopBridge && typeof desktopBridge.runMergeAction === "function") {
      return desktopBridge.runMergeAction;
    }

    if (window.SourceCompanionRepositoryMergeActions && typeof window.SourceCompanionRepositoryMergeActions.runMergeAction === "function") {
      return window.SourceCompanionRepositoryMergeActions.runMergeAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-merge-actions", "./src/repository-merge-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runMergeAction === "function") {
          return loaded.runMergeAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryStashActionRunner() {
    if (desktopBridge && typeof desktopBridge.runStashAction === "function") {
      return desktopBridge.runStashAction;
    }

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
    if (desktopBridge && typeof desktopBridge.runCloneAction === "function") {
      return desktopBridge.runCloneAction;
    }

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

  function resolveRepositoryPublishActionRunner() {
    if (desktopBridge && typeof desktopBridge.runPublishAction === "function") {
      return (request = {}) => desktopBridge.runPublishAction(toDesktopPublishRequest(request));
    }

    if (window.SourceCompanionRepositoryPublishActions && typeof window.SourceCompanionRepositoryPublishActions.runPublishAction === "function") {
      return window.SourceCompanionRepositoryPublishActions.runPublishAction;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-publish-actions", "./src/repository-publish-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.runPublishAction === "function") {
          return loaded.runPublishAction;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveRepositoryPublishPreflightRunner() {
    if (desktopBridge && typeof desktopBridge.preparePublishPreflight === "function") {
      return (request = {}) => desktopBridge.preparePublishPreflight(toDesktopPublishRequest(request));
    }

    if (window.SourceCompanionRepositoryPublishActions &&
      typeof window.SourceCompanionRepositoryPublishActions.preparePublishPreflight === "function") {
      return window.SourceCompanionRepositoryPublishActions.preparePublishPreflight;
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./repository-publish-actions", "./src/repository-publish-actions"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.preparePublishPreflight === "function") {
          return loaded.preparePublishPreflight;
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function ensureDesktopBridge() {
    if (desktopBridge) return desktopBridge;

    desktopBridge = resolveDesktopRepositoryBridge();
    if (!desktopBridge) return null;
    if (typeof window !== "undefined" && !window.SourceCompanionDesktopBridge) {
      window.SourceCompanionDesktopBridge = desktopBridge;
    }

    state.desktopBridge = desktopBridge;
    state.repositoryStateLoader = resolveRepositoryStateLoader();
    state.repositoryDiffLoader = resolveRepositoryDiffLoader();
    state.repositoryFileActionRunner = resolveRepositoryFileActionRunner();
    state.repositoryHunkActionRunner = resolveRepositoryHunkActionRunner();
    state.repositoryCommitActionRunner = resolveRepositoryCommitActionRunner();
    state.repositoryBranchActionRunner = resolveRepositoryBranchActionRunner();
    state.repositorySyncActionRunner = resolveRepositorySyncActionRunner();
    state.repositoryMergeActionRunner = resolveRepositoryMergeActionRunner();
    state.repositoryStashActionRunner = resolveRepositoryStashActionRunner();
    state.repositoryCloneActionRunner = resolveRepositoryCloneActionRunner();
    state.repositoryPublishPreflightRunner = resolveRepositoryPublishPreflightRunner();
    state.repositoryPublishActionRunner = resolveRepositoryPublishActionRunner();
    state.repositoryStatusWatcher = resolveRepositoryStatusWatcher(state.repositoryStateLoader);
    return desktopBridge;
  }

  function ensureGitHubClient() {
    ensureDesktopBridge();
    if (!state.githubClient) {
      state.githubClient = resolveGitHubClient();
    }
    return state.githubClient;
  }

  function toDesktopPublishRequest(request = {}) {
    return {
      repositoryPath: request.repositoryPath,
      name: request.name,
      description: request.description,
      visibility: request.visibility,
      initIfNeeded: request.initIfNeeded,
      publicConfirmed: request.publicConfirmed
    };
  }

  function resolveGitHubClient() {
    if (window.SourceCompanionGitHubClientInstance &&
      typeof window.SourceCompanionGitHubClientInstance.getAuthStatus === "function") {
      return window.SourceCompanionGitHubClientInstance;
    }

    const bridge = resolveGitHubBackendBridge();
    if (window.SourceCompanionGitHubClient &&
      typeof window.SourceCompanionGitHubClient.createGitHubBridgeClient === "function" &&
      bridge) {
      return window.SourceCompanionGitHubClient.createGitHubBridgeClient(bridge);
    }

    if (typeof require !== "function") {
      return null;
    }

    const candidates = ["./github-api-client", "./src/github-api-client"];
    for (const candidate of candidates) {
      try {
        const loaded = require(candidate);
        if (loaded && typeof loaded.createGitHubApiClient === "function") {
          return loaded.createGitHubApiClient();
        }
      } catch {
        // Try the next runtime-specific path.
      }
    }

    return null;
  }

  function resolveDesktopRepositoryBridge() {
    if (window.SourceCompanionDesktopBridge) return window.SourceCompanionDesktopBridge;
    if (window.SourceCompanionDesktopBridgeFactory &&
      typeof window.SourceCompanionDesktopBridgeFactory.resolveDesktopBridge === "function") {
      return window.SourceCompanionDesktopBridgeFactory.resolveDesktopBridge(window);
    }

    return null;
  }

  function resolveGitHubBackendBridge() {
    if (window.SourceCompanionGitHubBackendBridge) return window.SourceCompanionGitHubBackendBridge;
    if (window.SourceCompanionGitHubBridge) return window.SourceCompanionGitHubBridge;

    const desktopBridge = resolveDesktopRepositoryBridge();
    if (desktopBridge && typeof desktopBridge.getGitHubAuthStatus === "function") {
      const bridge = {
        getAuthStatus: () => desktopBridge.getGitHubAuthStatus(),
        startDeviceLogin: (options) => desktopBridge.startGitHubDeviceLogin(options || {}),
        getLoginStatus: (options) => desktopBridge.getGitHubDeviceLoginStatus(options || {}),
        pollDeviceLogin: (options) => desktopBridge.pollGitHubDeviceLogin(options || {}),
        cancelDeviceLogin: (options) => desktopBridge.cancelGitHubDeviceLogin(options || {}),
        login: (options) => desktopBridge.loginGitHub(options || {}),
        logout: (options) => desktopBridge.logoutGitHub(options || {})
      };
      if (typeof desktopBridge.listGitHubUserRepositories === "function") {
        bridge.listUserRepositories = (options) => desktopBridge.listGitHubUserRepositories(options || {});
      }
      if (typeof desktopBridge.searchGitHubUserRepositories === "function") {
        bridge.searchUserRepositories = (options) => desktopBridge.searchGitHubUserRepositories(options || {});
      }
      if (typeof desktopBridge.listGitHubPullRequests === "function") {
        bridge.listPullRequests = (options) => desktopBridge.listGitHubPullRequests(options || {});
      }
      if (typeof desktopBridge.createGitHubPullRequest === "function") {
        bridge.createPullRequest = (options) => desktopBridge.createGitHubPullRequest(options || {});
      }
      if (typeof desktopBridge.loadGitHubPullRequestChecks === "function") {
        bridge.loadPullRequestChecks = (options) => desktopBridge.loadGitHubPullRequestChecks(options || {});
      }
      if (typeof desktopBridge.loadGitHubPullRequestReviewContext === "function") {
        bridge.loadPullRequestReviewContext = (options) => desktopBridge.loadGitHubPullRequestReviewContext(options || {});
      }
      return bridge;
    }

    const tauriInvoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
    if (typeof tauriInvoke !== "function") return null;

    return {
      getAuthStatus: () => tauriInvoke("github_get_auth_status", { request: {} }),
      startDeviceLogin: (options) => tauriInvoke("github_device_login_start", { request: options || {} }),
      getLoginStatus: (options) => tauriInvoke("github_device_login_status", { request: options || {} }),
      pollDeviceLogin: (options) => tauriInvoke("github_device_login_poll", { request: options || {} }),
      cancelDeviceLogin: (options) => tauriInvoke("github_device_login_cancel", { request: options || {} }),
      login: (options) => tauriInvoke("github_login", { request: options || {} }),
      logout: (options) => tauriInvoke("github_logout", { request: options || {} }),
      listUserRepositories: (options) => tauriInvoke("github_list_user_repositories", options || {}),
      searchUserRepositories: (options) => tauriInvoke("github_search_user_repositories", options || {}),
      createRepository: (options) => tauriInvoke("github_create_repository", options || {}),
      listPullRequests: (options) => tauriInvoke("github_list_pull_requests", options || {}),
      createPullRequest: (options) => tauriInvoke("github_create_pull_request", options || {}),
      loadPullRequestChecks: (options) => tauriInvoke("github_load_pull_request_checks", options || {}),
      loadPullRequestReviewContext: (options) => tauriInvoke("github_load_pull_request_review_context", options || {})
    };
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
    if (github.status === "ambiguous-github-remotes") return "Ambiguous GitHub remotes";
    if (github.status === "not-github-remote") return "No GitHub remote";
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

  function floatingChangeCountItems(git) {
    return [
      { label: "Changed", count: countFiles(git.unstaged) },
      { label: "Staged", count: countFiles(git.staged) },
      { label: "Untracked", count: countFiles(git.untracked) },
      { label: "Conflicts", count: countFiles(git.conflicted) }
    ];
  }

  function floatingSyncStateLabel(repo) {
    if (repo.health === "operation-running" || isRepositoryWriteBusy(repo)) return "running";
    if (repo.health === "conflict" || countFiles(repo.git.conflicted) > 0) return "conflict";
    const divergence = repo.git.divergence || {};
    const ahead = Number(divergence.ahead) || 0;
    const behind = Number(divergence.behind) || 0;
    const changes = countFiles(repo.git.staged) + countFiles(repo.git.unstaged) + countFiles(repo.git.untracked);
    if (ahead > 0 && behind > 0) return "diverged";
    if (ahead > 0) return "ahead";
    if (behind > 0) return "behind";
    if (changes > 0) return "local changes";
    if (repo.health === "error") return "error";
    return "clean";
  }

  function floatingSyncStateClass(repo) {
    const label = floatingSyncStateLabel(repo);
    if (label === "clean") return "ready";
    if (label === "conflict" || label === "error" || label === "diverged") return "error";
    return "warning";
  }

  function floatingStatus(repo) {
    if (state.message && state.message.kind === "error") {
      return { kind: "error", message: state.message.text };
    }

    const running = [
      repo.commitAction,
      repo.syncAction,
      repo.branchAction,
      repo.mergeAction,
      repo.stashAction,
      repo.fileAction,
      repo.cloneAction,
      repo.publishAction
    ].find((action) => action && action.status === "running");
    if (running) {
      return { kind: "running", message: running.message || "Running Git operation." };
    }
    if (repo.lastRefresh && repo.lastRefresh.status === "running") {
      return { kind: "running", message: "Refreshing repository status." };
    }
    if (repo.error) {
      return { kind: "error", message: repo.error.message || "Repository error." };
    }

    const failed = [
      repo.commitAction,
      repo.syncAction,
      repo.branchAction,
      repo.mergeAction,
      repo.stashAction,
      repo.fileAction,
      repo.cloneAction,
      repo.publishAction
    ].find((action) => action && action.status === "failed");
    if (failed) {
      return { kind: "error", message: failed.message || "Git action failed. Open Full UI for details." };
    }

    const succeeded = [
      repo.commitAction,
      repo.syncAction,
      repo.branchAction,
      repo.mergeAction,
      repo.stashAction,
      repo.fileAction,
      repo.cloneAction,
      repo.publishAction
    ].find((action) => action && action.status === "succeeded");
    if (succeeded) {
      return { kind: "success", message: succeeded.message || "Last Git action completed." };
    }

    const commitValidation = validateFloatingCommitAction(repo, "commit");
    return {
      kind: commitValidation.ok ? "idle" : "blocked",
      message: commitValidation.ok ? "Ready." : commitValidation.message
    };
  }

  function isRepositoryWriteBusy(repo) {
    if (!repo) return false;
    const actions = [
      repo.commitAction,
      repo.syncAction,
      repo.branchAction,
      repo.mergeAction,
      repo.stashAction,
      repo.fileAction,
      repo.cloneAction,
      repo.publishAction
    ];
    return actions.some((action) => action && action.status === "running") ||
      Boolean(repo.operations && Array.isArray(repo.operations.running) && repo.operations.running.length > 0);
  }

  function validateFloatingCommitAction(repo, action) {
    const validation = validateCommitAction(repo, action);
    if (validation.ok) return validation;
    return { ok: false, message: floatingValidationMessage(validation.message) };
  }

  function validateFloatingSyncAction(repo, action) {
    const validation = validateSyncAction(repo, action);
    if (validation.ok) return validation;
    return { ok: false, message: floatingValidationMessage(validation.message) };
  }

  function floatingValidationMessage(message) {
    const text = clean(message);
    if (/commit message/i.test(text)) return "Enter a commit message.";
    if (/stage/i.test(text) || /staged/i.test(text)) return "Stage changes before committing.";
    if (/upstream/i.test(text)) return "Set an upstream branch in the Full UI.";
    if (/conflict/i.test(text)) return "Resolve conflicts in the Full UI.";
    if (/path|folder/i.test(text)) return "Repository path is no longer available.";
    return text || "Open Full UI for details.";
  }

  function renderSourceControl(repo) {
    const buckets = changeBuckets(repo.git);
    const selected = selectedChange(repo, buckets);
    const viewMode = sourceControlViewMode(repo);

    return `
      <section class="source-control" aria-label="Source control changes">
        ${renderSourceControlToolbar(repo, selected, viewMode)}
        ${renderClonePanel(repo)}
        ${renderPublishPanel(repo)}
        ${renderBranchPanel(repo)}
        ${renderPullRequestPanel(repo)}
        ${renderMergePanel(repo)}
        ${renderSyncPanel(repo)}
        ${renderStashPanel(repo)}
        ${renderHistoryPanel(repo)}
        ${renderCommitBox(repo)}
        <div class="source-control-layout view-${escapeHtml(viewMode)}">
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

  function renderSourceControlToolbar(repo, selected, viewMode) {
    const refreshRunning = repo.lastRefresh && repo.lastRefresh.status === "running";
    const commitValidation = validateCommitAction(repo, "commit");
    const fileActions = selected ? fileActionsForSelected(selected) : [];
    const fileActionState = repo.fileAction || null;
    const fileActionRunning = fileActionState && fileActionState.status === "running";
    const syncActions = ["fetch", "pull", "push", "sync"];
    const prValidation = validatePullRequestAction(repo, "load");
    const stashValidation = validateStashAction(repo, "list", {});

    return `
      <div class="source-control-toolbar" aria-label="Source control toolbar">
        <div class="toolbar-group">
          <button class="icon-button" type="button" data-source-control-action="refresh" ${refreshRunning ? "disabled" : ""} title="${escapeHtml(refreshRunning ? "Refresh is running." : "Refresh repository status")}">R</button>
          <div class="segmented-control" aria-label="Source control view mode">
            ${["split", "list", "diff"].map((mode) => `
              <button type="button" data-source-control-view="${escapeHtml(mode)}" class="${mode === viewMode ? "active" : ""}" aria-pressed="${mode === viewMode ? "true" : "false"}" title="${escapeHtml(sourceControlViewModeTitle(mode))}">
                ${escapeHtml(sourceControlViewModeLabel(mode))}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="toolbar-group">
          <button class="button compact primary" type="button" data-source-control-action="commit" ${commitValidation.ok ? "" : "disabled"} title="${escapeHtml(commitValidation.message)}">Commit</button>
          ${fileActions.map((item) => `
            <button class="button compact ${item.danger ? "danger" : ""}" type="button" data-file-action="${escapeHtml(item.id)}" ${fileActionRunning ? "disabled" : ""} title="${escapeHtml(selected ? `${item.label} ${selected.file.path || "selected file"}` : item.label)}">
              ${escapeHtml(item.label)}
            </button>
          `).join("")}
          <details class="toolbar-menu">
            <summary title="More Git and GitHub actions">More</summary>
            <div class="toolbar-menu-list">
              ${syncActions.map((action) => {
                const validation = validateSyncAction(repo, action);
                return `<button type="button" data-sync-action="${escapeHtml(action)}" ${validation.ok ? "" : "disabled"} title="${escapeHtml(validation.message)}">${escapeHtml(syncActionLabel(action))}</button>`;
              }).join("")}
              <button type="button" data-stash-action="list" ${stashValidation.ok ? "" : "disabled"} title="${escapeHtml(stashValidation.message)}">Refresh stashes</button>
              <button type="button" data-pr-action="load" ${prValidation.ok ? "" : "disabled"} title="${escapeHtml(prValidation.message)}">Refresh PR</button>
            </div>
          </details>
        </div>
      </div>
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

  function renderPublishPanel(repo) {
    if (!repo.publishAction && !repo.publishRequest) return "";
    const status = repo.publishAction || {
      status: "idle",
      message: "Publish is ready."
    };
    const request = repo.publishRequest || {};
    const target = request.name ? `GitHub: ${request.name}` : "GitHub repository";
    const visibility = request.visibility || repo.publishAction && repo.publishAction.visibility || "private";
    const checks = status.checks || [];
    const remotes = status.remotes || [];

    return `
      <section class="sync-panel" aria-label="Publish progress">
        <div class="sync-panel-heading">
          <div>
            <h3>Publish</h3>
            <p>${escapeHtml(target)} / ${escapeHtml(visibility)} / ${escapeHtml(repo.path)}</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        <div class="sync-status ${commitStatusClass(status)}">${escapeHtml(status.message || "")}</div>
        ${checks.length > 0 ? `
          <div class="publish-checks" aria-label="Publish preflight checks">
            ${checks.map((check) => `
              <div class="publish-check ${check.ok ? "success" : "error"}">
                <strong>${check.ok ? "OK" : "Blocked"}: ${escapeHtml(check.label || "Check")}</strong>
                <span>${escapeHtml(check.message || "")}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${status.needsCommit ? `
          <div class="commit-status error">Create an initial commit in the Commit box below, then run Publish to GitHub again.</div>
        ` : ""}
        ${status.needsGitInit ? `
          <div class="commit-status ${status.needsCommit ? "error" : status.status === "succeeded" ? "success" : "running"}">${status.needsCommit ? "Git init is selected, but publishing stays blocked until an initial commit exists." : "Git init for this folder has been explicitly selected and is waiting for the publish runner."}</div>
        ` : ""}
        ${remotes.length > 0 ? `
          <div class="commit-status error">Existing remotes: ${escapeHtml(remotes.join(", "))}. Source Companion will not overwrite or replace remotes automatically.</div>
        ` : ""}
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

  function renderMergePanel(repo) {
    const running = repo.mergeAction && repo.mergeAction.status === "running";
    const target = repo.mergeAction && repo.mergeAction.branch ? repo.mergeAction.branch : defaultMergeTarget(repo);
    const validation = validateMergeAction(repo, { target });
    const readiness = validateMergeReadiness(repo);
    const status = repo.mergeAction ? repo.mergeAction : {
      status: validation.ok ? "idle" : "blocked",
      message: validation.message
    };

    return `
      <section class="sync-panel" aria-label="Merge action">
        <div class="sync-panel-heading">
          <div>
            <h3>Merge</h3>
            <p>${escapeHtml(branchLabel(repo.git.branch))} receives selected branch</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        <form class="branch-form" data-merge-form>
          <label>
            Merge branch
            <input name="target" autocomplete="off" placeholder="feature/name" value="${escapeHtml(target)}" ${running ? "disabled" : ""}>
          </label>
          <button class="button" type="submit" ${readiness.ok && !running ? "" : "disabled"} title="${escapeHtml(validation.message)}">Merge</button>
        </form>
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
    const mergeRunning = repo.mergeAction && repo.mergeAction.status === "running";
    const blocked = disabled || running || mergeRunning;
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

  function renderPullRequestPanel(repo) {
    const prState = repo.pullRequest || emptyPullRequestState();
    const existing = prState.existing || null;
    const running = prState.status === "running";
    const loadValidation = validatePullRequestAction(repo, "load");
    const createValidation = validatePullRequestAction(repo, "create", {
      base: prState.base,
      title: prState.title
    });
    const status = running || prState.status === "succeeded" || prState.status === "failed" ? prState : {
      status: loadValidation.ok ? "idle" : "blocked",
      message: loadValidation.message
    };
    const github = repo.github || null;
    const remoteLabelText = pullRequestRemoteLabel(github);
    const branch = currentBranchName(repo.git);
    const disabled = running || !loadValidation.ok;

    return `
      <section class="pull-request-panel" aria-label="GitHub pull requests">
        <div class="pull-request-heading">
          <div>
            <h3>GitHub Pull Request</h3>
            <p>${escapeHtml(remoteLabelText)} / head: ${escapeHtml(branch || "no branch")} / base: ${escapeHtml(prState.base || "main")}</p>
          </div>
          <span class="status-pill ${branchStatusClass(status)}">${escapeHtml(branchStatusLabel(status))}</span>
        </div>
        ${github && github.htmlUrl ? `
          <div class="pull-request-remote">
            <span>${escapeHtml(github.remoteName || github.remote || "remote")}: ${escapeHtml(github.fullName || "")}</span>
            <a href="${escapeHtml(github.htmlUrl)}" target="_blank" rel="noreferrer">Open repository</a>
          </div>
        ` : ""}
        ${renderExistingPullRequest(existing, prState.checkStatus, prState.reviewContext)}
        <form class="pull-request-form" data-pr-form>
          <label>
            Base branch
            <input name="base" autocomplete="off" value="${escapeHtml(prState.base || "main")}" ${disabled || existing ? "disabled" : ""}>
          </label>
          <label>
            Head branch
            <input name="head" value="${escapeHtml(branch || "")}" disabled>
          </label>
          <label>
            Title
            <input name="title" autocomplete="off" value="${escapeHtml(prState.title || "")}" ${disabled || existing ? "disabled" : ""}>
          </label>
          <label>
            Description
            <textarea name="description" rows="3" autocomplete="off" ${disabled || existing ? "disabled" : ""}>${escapeHtml(prState.description || "")}</textarea>
          </label>
          <div class="pull-request-actions">
            <button class="button" type="button" data-pr-action="load" ${loadValidation.ok && !running ? "" : "disabled"} title="${escapeHtml(loadValidation.message)}">Refresh PR</button>
            <button class="button primary" type="submit" ${createValidation.ok && !running ? "" : "disabled"} title="${escapeHtml(createValidation.message)}">Create PR</button>
          </div>
        </form>
        <div class="pull-request-status ${commitStatusClass(status)}">${escapeHtml(status.message || "")}</div>
      </section>
    `;
  }

  function renderExistingPullRequest(pr, checkStatus, reviewContext) {
    if (!pr) {
      return '<div class="pull-request-empty">No open pull request loaded for this branch.</div>';
    }

    const number = pr.number ? `#${pr.number}` : "PR";
    const base = pr.base && pr.base.ref ? pr.base.ref : "";
    const head = pr.head && pr.head.ref ? pr.head.ref : "";
    const checks = normalizePullRequestCheckState(checkStatus);
    return `
      <article class="pull-request-card">
        <div>
          <strong>${escapeHtml(`${number} ${pr.title || "Pull request"}`)}</strong>
          <span>${escapeHtml(`${pr.state || "unknown"} / ${head || "head"} -> ${base || "base"}`)}</span>
        </div>
        ${pr.htmlUrl ? `<a class="button" href="${escapeHtml(pr.htmlUrl)}" target="_blank" rel="noreferrer">Open PR</a>` : ""}
      </article>
      ${renderPullRequestChecks(checks)}
      ${renderPullRequestReviewContext(reviewContext)}
    `;
  }

  function renderPullRequestChecks(checkStatus) {
    const state = normalizePullRequestCheckState(checkStatus);
    const checks = [...state.statuses, ...state.checks];

    return `
      <div class="pull-request-checks" aria-label="GitHub pull request checks">
        <div class="pull-request-check-summary ${pullRequestCheckClass(state.state)}">
          <strong>${escapeHtml(pullRequestCheckLabel(state.state))}</strong>
          <span>${escapeHtml(state.message || state.summary || "No checks reported.")}</span>
        </div>
        ${state.error ? `
          <div class="pull-request-check-error">
            <strong>${escapeHtml(state.error.kind || "github-api-error")}</strong>
            <span>${escapeHtml(state.error.message || "GitHub checks could not be loaded.")}</span>
          </div>
        ` : ""}
        ${checks.length > 0 ? `
          <div class="pull-request-check-list">
            ${checks.map((check) => `
              <div class="pull-request-check ${pullRequestCheckClass(check.state)}">
                <span>
                  <strong>${escapeHtml(check.name || "Check")}</strong>
                  <small>${escapeHtml(check.description || check.rawState || check.conclusion || check.state || "unknown")}</small>
                </span>
                ${check.detailsUrl || check.htmlUrl ? `<a href="${escapeHtml(check.detailsUrl || check.htmlUrl)}" target="_blank" rel="noreferrer">Open result</a>` : ""}
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderPullRequestReviewContext(reviewContext) {
    const state = normalizePullRequestReviewContextState(reviewContext);
    return `
      <div class="pull-request-review-context" aria-label="GitHub review comments and issue links">
        <div class="pull-request-review-summary ${state.error ? "error" : "idle"}">
          <strong>Review context</strong>
          <span>${escapeHtml(state.summary || "No review comments or issue links loaded.")}</span>
        </div>
        ${state.error ? `
          <div class="pull-request-review-error">
            <strong>${escapeHtml(state.error.kind || "github-api-error")}</strong>
            <span>${escapeHtml(state.error.message || "GitHub review context could not be loaded.")}</span>
          </div>
        ` : ""}
        ${state.reviewComments.length > 0 ? `
          <div class="pull-request-review-list">
            ${state.reviewComments.map((comment) => `
              <article class="pull-request-review-comment">
                <span>
                  <strong>${escapeHtml(reviewCommentLocation(comment))}</strong>
                  <small>${escapeHtml(comment.author || "GitHub review")} / ${escapeHtml(comment.updatedAt || comment.createdAt || "")}</small>
                </span>
                <p>${escapeHtml(comment.body || "Review comment")}</p>
                ${comment.htmlUrl ? `<a href="${escapeHtml(comment.htmlUrl)}" target="_blank" rel="noreferrer">Open comment</a>` : ""}
              </article>
            `).join("")}
          </div>
        ` : ""}
        ${state.issueLinks.length > 0 ? `
          <div class="pull-request-issue-links">
            ${state.issueLinks.map((issue) => `
              <a class="pull-request-issue-link ${issue.status || "unknown"}" href="${escapeHtml(issue.htmlUrl || "#")}" target="_blank" rel="noreferrer">
                <strong>${escapeHtml(`#${issue.number || "?"}`)}</strong>
                <span>${escapeHtml(issue.title || issue.message || issue.status || "Issue link")}</span>
              </a>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function reviewCommentLocation(comment) {
    const path = comment && comment.path ? comment.path : "Review comment";
    return comment && comment.line ? `${path}:${comment.line}` : path;
  }

  function renderHistoryPanel(repo) {
    const git = repo.git || {};
    const history = normalizeHistoryState(git.history);
    const head = history.head || history.selectedCommit || null;
    const commits = Array.isArray(history.commits) ? history.commits : [];
    const status = history.error ? "failed" : history.status === "ready" ? "idle" : "blocked";
    const headLabel = head ? `${head.shortHash || String(head.hash).slice(0, 7)} ${head.subject || ""}` : "No HEAD commit";

    return `
      <details class="history-panel">
        <summary>
          <span>
            <strong>Graph / History</strong>
            <small>${escapeHtml(branchLabel(git.branch))} / ${escapeHtml(upstreamLabel(git.upstream))} / ${escapeHtml(divergenceLabel(git.divergence))}</small>
          </span>
          <span class="status-pill ${branchStatusClass({ status })}">${escapeHtml(historyStatusLabel(history))}</span>
        </summary>
        <div class="history-content">
          <div class="history-meta">
            <div>
              <span>Current branch</span>
              <strong>${escapeHtml(branchLabel(git.branch))}</strong>
            </div>
            <div>
              <span>Remote branch</span>
              <strong>${escapeHtml(upstreamLabel(git.upstream))}</strong>
            </div>
            <div>
              <span>HEAD</span>
              <strong>${escapeHtml(headLabel)}</strong>
            </div>
            <div>
              <span>Divergence</span>
              <strong>${escapeHtml(divergenceLabel(git.divergence))}</strong>
            </div>
          </div>
          ${history.error ? `
            <div class="history-status error">${escapeHtml(history.error.message || "Commit history could not be loaded.")}</div>
          ` : ""}
          <div class="history-grid">
            <div class="history-list" aria-label="Commit history">
              ${commits.length === 0 ? '<div class="history-empty">No commits.</div>' : commits.map(renderHistoryCommit).join("")}
            </div>
            <div class="history-diff">
              <div class="diff-meta">${escapeHtml(head ? `HEAD commit diff: ${head.shortHash || head.hash}` : history.message || "No commit diff available.")}</div>
              ${history.selectedDiff ? `
                <pre class="diff-view history-diff-view" tabindex="0"><code>${renderUnifiedDiff(history.selectedDiff)}</code></pre>
              ` : '<div class="preview-state empty">No commit diff is available.</div>'}
            </div>
          </div>
        </div>
      </details>
    `;
  }

  function renderHistoryCommit(commit) {
    return `
      <article class="history-commit">
        <span class="history-node" aria-hidden="true"></span>
        <div class="history-commit-text">
          <strong>${escapeHtml(commit.subject || "Commit")}</strong>
          <span>${escapeHtml(commit.shortHash || String(commit.hash || "").slice(0, 7))} / ${escapeHtml(commit.author || "Unknown author")} / ${escapeHtml(commit.authoredAt || "")}</span>
        </div>
      </article>
    `;
  }

  function renderCommitBox(repo) {
    const validation = validateCommitAction(repo, "commit");
    const running = repo.commitAction && repo.commitAction.status === "running" ||
      repo.syncAction && repo.syncAction.status === "running" ||
      repo.mergeAction && repo.mergeAction.status === "running";
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
        ${Array.isArray(entry.details) && entry.details.length > 0 ? `
          <div class="git-output-details">
            ${entry.details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
          </div>
        ` : ""}
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
    if (repo.mergeAction && repo.mergeAction.status === "running") {
      return { ok: false, message: "Merge action is running." };
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

  function sourceControlViewMode(repo) {
    return normalizeSourceControlViewMode(repo && repo.sourceControlViewMode);
  }

  function normalizeSourceControlViewMode(mode) {
    return ["split", "list", "diff"].includes(mode) ? mode : "split";
  }

  function sourceControlViewModeLabel(mode) {
    if (mode === "list") return "List";
    if (mode === "diff") return "Diff";
    return "Split";
  }

  function sourceControlViewModeTitle(mode) {
    if (mode === "list") return "Show change lists only";
    if (mode === "diff") return "Show selected diff and Git output";
    return "Show change lists and selected diff";
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

  function mergeActionRunningLabel(target) {
    return `Merging ${target || "selected branch"}.`;
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
    if (repo.mergeAction && repo.mergeAction.status === "running") {
      return { ok: false, message: "Merge action is running." };
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

  function validateMergeAction(repo, values = {}) {
    const readiness = validateMergeReadiness(repo);
    if (!readiness.ok) return readiness;

    const branch = currentBranchName(repo.git);
    const target = clean(values.target);
    if (!target) {
      return { ok: false, message: "Choose a branch to merge into the current branch." };
    }
    if (target === branch) {
      return { ok: false, message: "Choose a different branch to merge." };
    }

    return { ok: true, message: `Ready to merge ${target} into ${branch}.` };
  }

  function validateMergeReadiness(repo) {
    if (!repo || repo.kind === "no-folder" || repo.kind === "folder-without-git") {
      return { ok: false, message: "Open a Git repository before merging." };
    }
    if (repo.mergeAction && repo.mergeAction.status === "running") {
      return { ok: false, message: "Merge action is running." };
    }
    if (repo.branchAction && repo.branchAction.status === "running") {
      return { ok: false, message: "Branch action is running." };
    }
    if (repo.syncAction && repo.syncAction.status === "running") {
      return { ok: false, message: "Sync action is running." };
    }
    if (repo.commitAction && repo.commitAction.status === "running") {
      return { ok: false, message: "Commit is running." };
    }
    if (repo.stashAction && repo.stashAction.status === "running") {
      return { ok: false, message: "Stash action is running." };
    }
    if (repo.health === "conflict" || countFiles(repo.git.conflicted) > 0) {
      return { ok: false, message: "Resolve existing conflicts before starting another merge." };
    }

    const branch = currentBranchName(repo.git);
    if (!branch) {
      return { ok: false, message: "Check out a local branch before merging." };
    }

    if (countFiles(repo.git.staged) + countFiles(repo.git.unstaged) + countFiles(repo.git.untracked) > 0) {
      return { ok: false, message: "Commit, stash, or discard local changes before merging." };
    }

    return { ok: true, message: "Ready to choose a branch to merge." };
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
    if (repo.mergeAction && repo.mergeAction.status === "running") {
      return { ok: false, message: "Merge action is running." };
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

  function validatePullRequestAction(repo, action, values = {}) {
    if (!repo || repo.kind === "no-folder" || repo.kind === "folder-without-git") {
      return { ok: false, message: "Open a Git repository before using pull requests." };
    }
    if (!state.githubClient) {
      return { ok: false, message: "GitHub actions are not available in this runtime." };
    }
    if (!repo.github) {
      return { ok: false, message: "Configure a GitHub remote before using pull requests." };
    }
    if (repo.github.status !== "ready") {
      return { ok: false, message: repo.github.message || "Resolve the GitHub remote mapping before using pull requests." };
    }
    if (!repo.github.authenticated) {
      return { ok: false, message: "Log in to GitHub before using pull requests." };
    }
    if (!currentBranchName(repo.git)) {
      return { ok: false, message: "Check out a local branch before using pull requests." };
    }
    if (repo.pullRequest && repo.pullRequest.status === "running") {
      return { ok: false, message: "Pull request action is running." };
    }
    if (action === "load") {
      if (typeof state.githubClient.listPullRequests !== "function") {
        return { ok: false, message: "GitHub pull request lookup is not available in this runtime." };
      }
      return { ok: true, message: "Ready to refresh pull request status." };
    }
    if (action === "create") {
      if (typeof state.githubClient.createPullRequest !== "function") {
        return { ok: false, message: "GitHub pull request creation is not available in this runtime." };
      }
      if (repo.pullRequest && repo.pullRequest.existing) {
        return { ok: false, message: "An open pull request already exists for this branch." };
      }
      if (!clean(values.base)) {
        return { ok: false, message: "Enter the base branch before creating a pull request." };
      }
      if (!clean(values.title)) {
        return { ok: false, message: "Enter a pull request title before creating it." };
      }
      return { ok: true, message: `Ready to create ${currentBranchName(repo.git)} into ${clean(values.base)}.` };
    }

    return { ok: false, message: "Unknown pull request action." };
  }

  function branchActionTarget(action, values) {
    if (action === "checkout-remote") return clean(values.localName) || clean(values.remoteBranch) || null;
    return clean(values.name) || null;
  }

  function defaultMergeTarget(repo) {
    const upstream = upstreamParts(repo && repo.git);
    const current = currentBranchName(repo && repo.git);
    if (upstream && upstream.branch && upstream.branch !== current) return upstream.branch;
    return "";
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

  function historyStatusLabel(history) {
    if (!history) return "Empty";
    if (history.error) return "Error";
    if (history.status === "ready") return "Ready";
    return "Empty";
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

  function normalizeGitHubAuthStatus(auth) {
    const source = auth || {};
    return {
      authenticated: Boolean(source.authenticated),
      user: clean(source.user || source.login) || null,
      login: clean(source.login || source.user) || null,
      scopes: Array.isArray(source.scopes) ? source.scopes.map(clean).filter(Boolean) : [],
      tokenSource: clean(source.tokenSource) || null,
      lastValidatedAt: source.lastValidatedAt || null,
      status: source.status || "idle",
      error: source.error || null
    };
  }

  function noGitHubAuthStatus(error = null) {
    return {
      authenticated: false,
      user: null,
      login: null,
      scopes: [],
      tokenSource: null,
      lastValidatedAt: null,
      status: "idle",
      error
    };
  }

  function emptyPullRequestState() {
    return {
      status: "idle",
      message: "Pull request actions are ready.",
      contextKey: "",
      loadedKey: "",
      branch: "",
      repository: null,
      base: "main",
      title: "",
      description: "",
      pullRequests: [],
      existing: null,
      created: null,
      checkStatus: normalizePullRequestCheckState(),
      reviewContext: normalizePullRequestReviewContextState(),
      error: null,
      completedAt: null
    };
  }

  function normalizePullRequestCheckState(source = {}) {
    const statuses = Array.isArray(source.statuses) ? source.statuses : [];
    const checks = Array.isArray(source.checks) ? source.checks : [];
    const state = clean(source.state) || aggregatePullRequestCheckState(statuses, checks);
    return {
      status: source.status || "idle",
      state,
      message: clean(source.message || source.summary) || "No checks reported.",
      summary: clean(source.summary || source.message) || "No checks reported.",
      statuses,
      checks,
      error: source.error || null,
      completedAt: source.completedAt || null
    };
  }

  function aggregatePullRequestCheckState(statuses, checks) {
    const items = [...(statuses || []), ...(checks || [])];
    if (items.length === 0) return "unknown";
    if (items.some((item) => item.state === "failure")) return "failure";
    if (items.some((item) => item.state === "running")) return "running";
    if (items.every((item) => item.state === "success" || item.state === "neutral")) return "success";
    return "unknown";
  }

  function pullRequestCheckLabel(state) {
    if (state === "success") return "Checks passing";
    if (state === "failure") return "Checks failing";
    if (state === "running") return "Checks running";
    return "Checks unknown";
  }

  function pullRequestCheckClass(state) {
    if (state === "success") return "success";
    if (state === "failure") return "error";
    if (state === "running") return "warning";
    return "unknown";
  }

  function normalizePullRequestReviewContextState(source = {}) {
    return {
      status: source.status || "idle",
      summary: clean(source.summary) || "No review comments or issue links loaded.",
      reviewComments: Array.isArray(source.reviewComments) ? source.reviewComments : [],
      issueLinks: Array.isArray(source.issueLinks) ? source.issueLinks : [],
      error: source.error || null,
      completedAt: source.completedAt || null
    };
  }

  function commitMessagesForIssueDetection(git) {
    const history = normalizeHistoryState(git && git.history);
    return history.commits
      .slice(0, 20)
      .map((commit) => commit.subject || commit.message)
      .filter(Boolean);
  }

  function pullRequestContextKey(repo) {
    const github = repo && repo.github && repo.github.status === "ready" ? repo.github : null;
    const branch = currentBranchName(repo && repo.git);
    if (!github || !branch) return "";
    return `${github.owner || ""}/${github.name || github.repository || ""}:${branch}`;
  }

  function defaultPullRequestBase(git) {
    const upstream = upstreamParts(git);
    if (upstream && upstream.branch) return upstream.branch;
    return "main";
  }

  function defaultPullRequestTitle(branch) {
    return clean(branch).replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function pullRequestRemoteLabel(github) {
    if (!github) return "No GitHub remote";
    if (github.status === "ambiguous-github-remotes") return "Ambiguous GitHub remotes";
    if (github.status === "not-github-remote") return "No GitHub remote";
    const repo = github.fullName || (github.owner && github.name ? `${github.owner}/${github.name}` : "GitHub remote");
    const remote = github.remoteName || github.remote || "remote";
    return `${repo} via ${remote}`;
  }

  function pullRequestListMessage(result) {
    if (!result || !result.ok) {
      return result && result.error && result.error.message ? result.error.message : "Pull requests could not be loaded.";
    }
    const count = Array.isArray(result.pullRequests) ? result.pullRequests.length : 0;
    if (count === 0) return "No open pull request found for this branch.";
    const first = result.pullRequests[0];
    return `Open pull request ${first.number ? `#${first.number}` : ""} loaded.`;
  }

  function pullRequestCreateMessage(result) {
    if (!result || !result.ok) {
      return result && result.error && result.error.message ? result.error.message : "Pull request could not be created.";
    }
    const pr = result.pullRequest || {};
    return `Created pull request ${pr.number ? `#${pr.number}` : ""}.`;
  }

  function pullRequestFailureResult(action, message, error) {
    return {
      ok: false,
      action,
      command: { display: action === "github-pr-create" ? "GitHub PR create" : "GitHub PR lookup" },
      stdout: "",
      stderr: "",
      exitCode: null,
      message,
      error
    };
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
      stashes: Array.isArray(source.stashes) ? source.stashes : [],
      history: normalizeHistoryState(source.history)
    };
  }

  function normalizeHistoryState(history) {
    const source = history || {};
    return {
      status: source.status || "empty",
      message: source.message || "No commits are available yet.",
      commits: Array.isArray(source.commits) ? source.commits : [],
      head: source.head || null,
      selectedCommit: source.selectedCommit || null,
      selectedDiff: clean(source.selectedDiff),
      error: source.error || null
    };
  }

  function emptyHistoryState() {
    return normalizeHistoryState(null);
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

  function samePath(first, second) {
    return clean(first).toLowerCase() === clean(second).toLowerCase();
  }

  function resolveInitialUiMode() {
    if (typeof window !== "undefined" && window.SourceCompanionInitialMode === "floating") {
      return "floating";
    }
    return "full";
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
