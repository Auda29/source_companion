# Source Companion Product Plan

As of 2026-06-09, this document is the product source of truth for Source Companion. It defines what the product is, what it deliberately excludes, and how the web prototype and Tauri desktop target fit together.

## 1. Product Definition

Source Companion is a dedicated Git/GitHub source-control UI. It shows repository state, makes changes reviewable, and runs explicit Git/GitHub version-control actions.

It replaces Cursor only for Git. It is not an editor, terminal, agent, dashboard, project tree, task runner, or general developer cockpit.

Every feature must pass this test:

> Does this directly help a user view, review, or execute a Git/GitHub version-control step?

If the answer is no, the feature does not belong in Source Companion.

## 2. Target Users

Source Companion is for developers who edit code in Codex, Zed, Cursor, Pi, or another tool, but want a small, predictable, dedicated Git/GitHub surface.

Typical workflow:

1. Code changes happen outside Source Companion.
2. Source Companion shows repository, branch, remote, change, diff, and PR state.
3. The user stages, commits, syncs, publishes, opens PRs, or reviews checks without opening an editor-integrated source-control panel or a terminal.

## 3. First Product Goal

The first complete product goal is a practical Git/GitHub daily-work UI:

- open multiple repositories in tabs
- show local Git state, branch, upstream, remote, ahead/behind, conflicts, and errors
- review changed, staged, untracked, and conflicted files
- show readable unified diffs and replacement states for binary, deleted, new, renamed, and conflicted files
- stage, unstage, discard, and stage/unstage individual hunks
- commit, commit staged changes, commit and push, and amend with visible validation and warnings
- create, switch, delete, fetch, pull, push, sync, publish branches, merge the current branch with a selected target branch, and use basic stash actions
- clone by URL, clone from GitHub, initialize local folders, and publish local repositories to GitHub
- authenticate with GitHub, create/look up PRs, show checks, open check links, show review comments, and link issue numbers from branch or commit context
- keep Git Output and structured errors available for every operation that can fail

The product goal is reached when a user no longer needs Cursor, VS Code, or a terminal for normal source-control work. It does not include editing code, running tests/builds, project management, or agent work.

## 4. Runtime Strategy

The UI starts as a reusable web/HTML prototype. The same UI is packaged as the Tauri desktop Full UI.

The desktop target exists because the product needs local repository access, Git CLI execution, repository watchers, native folder selection, secure GitHub auth, and safe token storage. A pure web app cannot provide those capabilities cleanly.

Tauri is the chosen desktop shell. It exposes only named bridge commands for source-control actions. Renderer code must not receive a free Node, shell, filesystem, token, or GitHub API surface.

Desktop modes:

- Full UI: the complete web-style source-control surface with repository tabs, project selection, lists, diffs, commit, branch, sync, stash, history, Git Output, GitHub clone/publish, PRs, checks, and review comments.
- Floating Window: a compact mode for the active repository with repository, branch, upstream/divergence, change counters, commit message, commit, commit and push, push, pull/sync, refresh, status/error, and a return path to the Full UI.

Both modes share the same repository state, Git Operation Queue, watchers, Git Output, desktop bridge, and error model.

## 5. Core Workflows

### Open Repository

Users can open one or more local repositories. Each tab is exactly one repository context with its own path, display name, Git state, GitHub link, running operations, errors, and refresh state.

The app shows recent repositories and entry points for Open Repository, Clone Repo, Clone from GitHub, and Publish to GitHub.

Folders without Git are not dead ends. They can show Initialize Repository, Clone Repo, or Publish to GitHub actions. Initialization must be explicit and must not create an automatic initial commit.

### Clone

URL clone supports HTTPS Git URLs, SSH Git URLs, and GitHub URLs. The target folder is selected explicitly, progress and Git Output are visible, failures are readable, and a successful clone opens as a repository tab.

Clone from GitHub requires GitHub auth in the desktop app. It lists/searches repositories, shows owner/name, description, visibility, stars, clone URL, and private/public indicators before clone, then uses the same clone runner as URL clone. Tokens must never be embedded in Git URLs or Git arguments.

### Publish To GitHub

Publish creates or connects a local folder/repository to GitHub. The UI must show repository name, optional description, private/public choice, local Git initialization requirements, remote checks, and public publish confirmation before execution.

If no Git repository exists, initialization requires explicit confirmation. If no commits exist, the commit flow is offered. Existing remotes are not overwritten silently. Success and failures are visible in the UI and Git Output.

### Review Changes

The source-control lists are only for Git-relevant changed files:

- Changed
- Staged
- Untracked
- Conflicts

Each item shows path, status, and change type. Selection opens a read-only diff or conflict/replacement state. Source Companion does not provide a project tree or file editor.

### Stage, Discard, And Hunks

File stage, unstage, and discard actions must respect the selected bucket. For mixed states such as `MM` and `AM`, discard from Changed must discard only worktree changes and preserve staged index content.

Discard requires confirmation because it can lose local work. Hunk stage/unstage applies a checked patch, reports stale or whitespace errors clearly, and refreshes repository state after success.

### Commit

The commit box includes a message field, normal commit, commit staged changes, commit and push, and amend. Commit actions are disabled or blocked when the message is missing, staged changes are missing, or a Git error prevents the operation.

Amend is visibly marked as history-changing and requires confirmation. The optional AI commit message feature is documented separately in `docs/ai-commit-message-concept.md` and is not part of the first product goal.

### Branch, Sync, Merge, And Stash

Allowed branch and sync actions:

- show current branch, upstream, ahead/behind, remote, and sync state
- create, switch, delete, and check out remote branches
- fetch, pull, push, sync, and publish branch
- merge the current branch with one selected target branch
- stash changes, list stashes, apply/pop/drop a stash, and create a stash with a short message

Force push, rebase, interactive rebase, history-rewrite wizards, complex cherry-pick UI, and complex stash management are outside the first product goal.

### History

The graph/history area is allowed because it makes Git state visible. It should be collapsible and show commit history, branch/remote labels, commit metadata, commit diffs, and local/remote divergence. It must not become an activity feed, analytics area, or dashboard.

### GitHub PRs, Checks, And Review Context

GitHub features stay limited to version-control context:

- detect GitHub remotes
- create and open PRs
- show current branch PR state
- show checks and open check result links
- show review comments
- link issue numbers found in branch names or commit messages

Not allowed: issue boards, Kanban, notifications, Discussions, Wiki, workflow control, CI log browsing, or a GitHub dashboard.

## 6. Architecture Boundaries

The backend surface is intentionally small:

- Git CLI Wrapper
- Git Operation Queue
- Repository status watcher
- local state store for non-sensitive UI/repository metadata
- GitHub API client
- GitHub auth and secure token storage
- Tauri desktop bridge and native dialogs

Git commands must run through whitelisted structured wrappers. Free shell commands, arbitrary Git subcommands, and direct renderer filesystem access are not part of the product.

Tokens must stay backend-internal. They are never stored in `localStorage`, `sessionStorage`, IndexedDB, repository contexts, recent repositories, Git remotes, Git URLs, Git arguments, or Git Output.

## 7. Safety And UX Rules

Risky actions require visible warning or confirmation:

- discard
- amend
- branch delete
- merge when local changes or conflicts are present
- remote overwrite
- public publish

No hidden automation:

- no automatic commit
- no automatic push unless the user explicitly chooses a combined commit-and-push flow
- no automatic publish
- no silent delete or overwrite
- no silent force push

Git Output must remain available, but raw output cannot be the only user-facing explanation for failures.

## 8. Explicit Non-Goals

Do not build:

- code editor or file editing
- markdown preview
- terminal or free command runner
- AI chat, agent runner, or autonomous Codex/Zed/Pi handoff as a core feature
- project tree
- workspaces
- plugin system
- task runner, test runner, or build runner
- GitLab, Bitbucket, or generic forge abstraction
- custom SSH-key management
- force push
- rebase, interactive rebase, or other history-rewrite workflows
- broad GitHub issue/project/notification/wiki/discussion/dashboard features

## 9. Setup, Tests, And Known Limits

Setup and run commands are documented in `README.md`.

Automated tests currently use Node's built-in test runner:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --test tests/*.test.js
```

Desktop smoke steps are documented in `docs/desktop-full-ui-parity.md`.

Known limits:

- Rust format/build and live Tauri smoke checks require a local environment with `cargo`.
- The web prototype cannot provide persistent GitHub auth, secure token storage, native folder dialogs, or full local Git behavior without the desktop bridge.
- Historical planning and task notes may remain in German; user-facing documentation should remain English.
