# Source Companion

Source Companion is a focused Git/GitHub source-control UI. It is designed to replace the Git surface of Cursor or VS Code, not the editor, terminal, agent, dashboard, or project tree around it.

The product source of truth is [docs/plan.md](docs/plan.md). New features should pass the scope gates in [docs/scope-gates.md](docs/scope-gates.md) before they are planned or implemented.

## Current Shape

The repository contains a reusable web UI prototype and a Tauri desktop target.

- Web prototype: `index.html`, `src/main.js`, and `src/styles.css` provide the Full UI surface for tabs, repository selection, source-control lists, diffs, commits, branches, sync, stash, GitHub clone/publish, PRs, checks, and review comments.
- Desktop target: Tauri packages the same Full UI assets and exposes only whitelisted bridge commands for local Git, repository state, native folder dialogs, repository watchers, GitHub auth, GitHub metadata, publish, clone, PR, checks, and review context.
- Floating Window: the compact desktop mode shows the active repository, branch, change counters, status/errors, and short actions for commit, commit and push, push, pull/sync, refresh, and returning to the Full UI.

## Product Scope

In scope:

- opening multiple local repositories in tabs
- Git status, changed/staged/untracked/conflicted buckets, unified diffs, file actions, and hunk actions
- commit, commit staged changes, commit and push, and amend with visible warnings
- branch create/switch/delete, fetch, pull, push, sync, merge, and basic stash actions
- URL clone, Clone from GitHub, Publish to GitHub, and GitHub repository metadata
- GitHub auth, PR creation/lookup, checks, review comments, and issue links where they support source-control workflows
- Git Output and structured errors for Git/GitHub operations

Out of scope:

- code editing, file tree navigation, terminal access, free shell commands, task/test/build runners, workspaces, dashboards, agent/chat flows, GitLab/Bitbucket, custom SSH-key management, force push, rebase, and broad GitHub project management.

## Setup

Prerequisites:

- Node.js
- Git
- Rust/Cargo and the Tauri prerequisites for desktop development

The current desktop bridge starts the JavaScript worker with Node.js. If a desktop bundle starts without a usable Node runtime, the app shell remains open and source-control bridge commands return a `desktop-bridge-runtime-missing` error instead of aborting startup.

Install dependencies:

```powershell
npm install
```

Prepare desktop assets:

```powershell
npm run desktop:assets
```

Run the desktop shell:

```powershell
npm run desktop:dev
```

Build the desktop bundle:

```powershell
npm run desktop:build
```

The static web prototype can also be opened directly from `index.html`, but local Git execution, native folder dialogs, persistent GitHub auth, and desktop watchers require the Tauri runtime.

## Testing

The current automated coverage uses Node's built-in test runner:

```powershell
npm test
```

For desktop asset smoke coverage, run:

```powershell
npm run desktop:assets
```

GitHub Actions runs Node tests, the desktop asset smoke check, Rust formatting, and `cargo check` for the Tauri crate on pushes and pull requests. The workflow installs the Linux system dependencies required by Tauri before the Rust check. Live desktop smoke coverage still requires a local environment with `cargo`; see [docs/desktop-full-ui-parity.md](docs/desktop-full-ui-parity.md).

## Documentation

- Product plan: [docs/plan.md](docs/plan.md)
- Scope gates: [docs/scope-gates.md](docs/scope-gates.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Repository context model: [docs/repository-context-model.md](docs/repository-context-model.md)
- Desktop shell: [docs/desktop-shell.md](docs/desktop-shell.md)
- Desktop bridge: [docs/desktop-bridge.md](docs/desktop-bridge.md)
- Floating Window: [docs/floating-window-concept.md](docs/floating-window-concept.md)
- Desktop parity checklist: [docs/desktop-full-ui-parity.md](docs/desktop-full-ui-parity.md)
- Core flow review checklist: [docs/core-flow-review-checklist.md](docs/core-flow-review-checklist.md)
- Task backlog: [docs/Tasks.md](docs/Tasks.md)

Historical planning notes may remain in German. User-facing and architectural documentation should be kept in English going forward.

## License

MIT License. See [LICENSE](LICENSE).
