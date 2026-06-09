# Source Companion Architecture

`docs/plan.md` is the product source of truth. This document describes the current technical structure and the boundaries that keep Source Companion focused on Git/GitHub source control.

## Architecture Principles

- Each open tab represents exactly one repository context.
- UI code can start Git and GitHub actions only through whitelisted backend or desktop bridge interfaces.
- There is no free command runner, terminal, editor, project tree, workspace model, or plugin platform.
- Errors are returned as structured objects and may include raw Git/GitHub output for Git Output diagnostics.
- Floating Window and Full UI share repository state, Git Operation Queue, watchers, and Git Output.

## Runtime Shape

The reusable frontend is the web/HTML Full UI. The desktop target packages that UI in Tauri and adds a controlled native bridge for local capabilities.

Tauri exposes only named commands for repository open/state/diff/actions, native folder dialogs, repository watchers, GitHub auth, repository listing/search, clone, publish, PRs, checks, and review context. Renderer code receives no free Node, shell, filesystem, token, or generic GitHub API access.

## UI Layers

### App Shell And Repository Selection

Responsibilities:

- show recent repositories
- offer Open Repository, Clone Repo, Clone from GitHub, and Publish to GitHub entry points
- open and close repository contexts as tabs
- show empty and error states

Allowed inputs:

- locally selected folder paths
- clone URLs
- GitHub repository metadata from the GitHub client/bridge
- user actions for open, clone, publish, and tab switching

Excluded:

- workspaces
- project tree
- dashboard or project-management views

### Source-Control Layer

Responsibilities:

- render current repository state
- separate Changed, Staged, Untracked, and Conflicts
- trigger file, hunk, commit, branch, sync, merge, and stash actions
- keep busy, warning, and error states near the affected UI

Allowed inputs:

- active repository context
- structured Git status data
- user actions for allowed source-control commands
- confirmed safety prompts for risky actions

Excluded:

- file editing
- free terminal output as the only error explanation
- force push or hidden history rewrites

### Diff And History Layer

Responsibilities:

- show readable unified diffs for selected files
- distinguish staged and unstaged diffs
- show replacement/error states for binary, untracked, deleted, renamed, empty, and conflicted files
- show collapsible history/graph data and local/remote divergence

Excluded:

- required side-by-side diff for the first product goal
- inline editor
- activity feed or analytics dashboard

### Desktop Floating Window

Responsibilities:

- show active repository, branch, upstream/divergence, change counters, status/error, and compact commit message
- expose only refresh, commit, commit and push, push, pull/sync, and Open Full UI
- forward detailed or risky flows to the Full UI

Excluded:

- duplicate repository state
- independent Git execution
- detailed diff, file list, branch management, stash, PRs, checks, or Git Output

## Backend Components

### Repository Context Model

The repository context holds path, display name, kind, health, Git state, GitHub link, running/queued operations, current error, and refresh state for one tab. Multiple contexts must not share implicit active state.

See `docs/repository-context-model.md`.

### Git CLI Wrapper

Responsibilities:

- run allowed Git commands with structured arguments
- capture stdout, stderr, exit code, and normalized errors separately
- reject free shell commands and unsupported Git subcommands
- prepare long operations for cancellation

Covered action families include status, diff, add, restore, commit, branch, switch, fetch, pull, push, remote, clone, init, log, merge, and stash.

### Git Operation Queue

Responsibilities:

- serialize Git operations per repository
- allow operations in different repositories to run independently
- expose queued, running, succeeded, failed, and aborted states
- keep status refreshes from starving behind user actions

### Repository Status Watcher

Responsibilities:

- watch worktree, index, and relevant `.git` metadata changes
- debounce refreshes
- defer or coordinate refreshes while repository operations are running
- stop cleanly when the tab closes

### GitHub API Client

Responsibilities:

- use backend-internal GitHub auth
- list/search user repositories
- create repositories for publish
- look up and create PRs
- load checks, review comments, and issue links in source-control context
- normalize missing auth, missing scopes, rate limits, network failures, permission failures, and API errors

Excluded:

- GitLab, Bitbucket, or generic forge abstraction
- issue boards, notifications, workflow control, discussions, wiki, or dashboard features
- renderer token access

### Local State Store

Responsibilities:

- persist recent repositories
- persist non-sensitive UI preferences, such as active tab, collapsed history, view mode, and last folder hints
- avoid storing running operations, transient errors, tokens, secrets, or GitHub access credentials

### Auth And Token Management

Desktop GitHub auth uses an OAuth Device Authorization Flow coordinated in the backend. Tokens are stored through an OS credential-store abstraction:

- Windows Credential Manager
- macOS Keychain
- Linux Secret Service/libsecret

Renderer responses contain only token-free auth status, user code, verification URL, expiration, polling interval, metadata, and structured errors. The web prototype must not add persistent GitHub auth.

See `docs/github-auth-decision.md`.

### Desktop Bridge

The bridge is the only renderer facade for local desktop actions. It delegates Git execution to `GitOperationQueue` and the Git CLI wrapper, uses native dialogs only for the allowed open/clone/publish flows, hosts persistent repository watchers, and routes GitHub auth/API calls through backend-only clients.

See `docs/desktop-bridge.md`.

## Error Contract

Backend responses that can fail return at least:

```js
{
  kind: "git-error",
  message: "Readable user-facing message.",
  raw: null,
  operationId: null,
  repositoryId: null
}
```

Git operations should also preserve stdout, stderr, and exit code where relevant. GitHub operations may include status code, scope details, rate-limit metadata, and retry hints. The UI should show short actionable errors near the affected action and keep redacted raw details available in Git Output.
