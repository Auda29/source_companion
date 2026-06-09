# Desktop Full-UI Parity Smoke Checklist

Stand 2026-06-09: Die Desktop Full UI nutzt die bestehende Web-Oberflaeche und routet Desktop-spezifische Ausfuehrung ueber die whitelisted Tauri-/Backend-Bridge. Diese Checkliste deckt die Paritaetsflows aus `T56` ab und bleibt auf Source-Control-Funktionen beschraenkt.

## Scope

- Full UI: `index.html`, `src/main.js`, `src/styles.css`
- Desktop facade: `src/desktop-bridge.js`
- Native commands: `src-tauri/src/lib.rs`
- Bridge contract: `docs/desktop-bridge.md`

## Automated Coverage

- `tests/desktop-shell.test.js`: Tauri shell packages the current Full UI assets and keeps capabilities restricted to the main window.
- `tests/desktop-bridge.test.js`: whitelisted bridge methods, repository open/state/diff/file/hunk/commit/clone/publish/branch/sync/merge/stash execution, watcher handoff, GitHub auth, repository search, PR, checks and review context.
- `tests/main-clone-flow.test.js`: renderer flows for URL clone, GitHub clone, native folder picker, publish preflight/output formatting, source-control rendering, refresh, PR lookup, checks, review comments and PR creation.
- Repository action tests: `tests/repository-file-actions.test.js`, `tests/repository-hunk-actions.test.js`, `tests/repository-commit-actions.test.js`, `tests/repository-branch-actions.test.js`, `tests/repository-sync-actions.test.js`, `tests/repository-stash-actions.test.js`, `tests/repository-diff.test.js` and `tests/repository-state.test.js`.

## Manual Smoke Steps

Run these after `npm run desktop:assets` and `npm run desktop:dev` in an environment with `cargo`, Node and Git available:

1. Open a valid repository with the native folder dialog. Confirm branch, upstream, ahead/behind, GitHub remote, status buckets, history and Git Output render.
2. Open an invalid or deleted path. Confirm the error stays near the repository workspace and no tab receives unrelated state.
3. Clone by URL into a native target folder. Confirm progress, Git Output, success tab opening and an auth/network failure message.
4. Clone from GitHub after device login. Confirm owner/name, description, visibility, stars, clone URL and private/public indicator remain visible before clone.
5. Publish a local folder. Confirm preflight, private/public choice, init confirmation, remote conflict handling, success output and GitHub/API/Git failures are visible without token values.
6. Select changed, staged, untracked and conflicted files. Confirm unified diffs, replacement states and bucket-specific file actions.
7. Stage and unstage one hunk. Confirm stale or non-applicable patches report a readable error and refresh the repository state after success.
8. Commit, commit staged changes and amend. Confirm missing message, empty staging, amend warning and Git failures stay near the commit area and in Git Output.
9. Create/switch/delete branches, pull/sync, push and stash/apply/drop. Confirm all operations serialize through the same repository queue and do not start duplicate Git operations.
10. Load PR context for a GitHub branch. Confirm existing PR, base/head, create PR, checks, check links, review comments and linked issues are visible; missing auth/scope/rate-limit/network/API errors are structured.

## Remaining Gaps

- No product parity gap is currently identified in the code review scope.
- Rust format/build and live Tauri smoke execution still require a local environment with `cargo`; the Node coverage above is the automated fallback in this workspace.
