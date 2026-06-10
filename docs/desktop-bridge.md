# Desktop Bridge Contract

The Desktop Bridge is the only renderer facade for local repository actions in the Tauri runtime. It is limited to version-control workflows and does not expose a free shell, command runner, token surface, or generic filesystem API.

## Renderer Facade

`src/desktop-bridge.js` exports `SourceCompanionDesktopBridge`. `src/main.js` prefers this facade for desktop repository state, diffs, file actions, hunk actions, commit, clone, publish, branch, sync, merge, stash, Git Output, native folder dialogs, watchers, GitHub auth, repositories, PRs, checks, and review context.

Tauri calls wrap renderer requests as `{ request: ... }` so native handlers do not receive arbitrary argument shapes.

Allowed repository methods:

- `openRepository`
- `pickRepositoryFolder`
- `pickCloneTargetFolder`
- `pickPublishFolder`
- `setWindowMode`
- `loadRepositoryState`
- `loadFileDiff`
- `runFileAction`
- `runHunkAction`
- `runCommitAction`
- `runCloneAction`
- `preparePublishPreflight`
- `runPublishAction`
- `runBranchAction`
- `runSyncAction`
- `runMergeAction`
- `runStashAction`
- `getGitOutput`
- `startRepositoryWatch`
- `getRepositoryWatch`
- `stopRepositoryWatch`

Tauri command names:

- `repository_open`
- `repository_pick_folder`
- `repository_pick_clone_target_folder`
- `repository_pick_publish_folder`
- `desktop_set_window_mode`
- `repository_load_state`
- `repository_load_file_diff`
- `repository_run_file_action`
- `repository_run_hunk_action`
- `repository_run_commit_action`
- `repository_run_clone_action`
- `repository_prepare_publish_preflight`
- `repository_run_publish_action`
- `repository_run_branch_action`
- `repository_run_sync_action`
- `repository_run_merge_action`
- `repository_run_stash_action`
- `repository_get_git_output`
- `repository_watch_start`
- `repository_watch_get`
- `repository_watch_stop`

## Backend Rules

The bridge backend delegates Git execution through `GitOperationQueue`, which calls the existing `git-cli-wrapper`. This preserves the command whitelist, structured arguments, force-push rejection, stdout/stderr/exit-code capture, and normalized errors.

`src-tauri/src/lib.rs` registers one `#[tauri::command]` handler per allowed command and a matching `invoke_handler`. Those handlers start a persistent `src/desktop-bridge-worker.js` process with `--preserve-symlinks` and `--preserve-symlinks-main`, then send JSON-RPC-like method calls to `createDesktopBridgeBackend()`.

The persistent worker keeps the queue and watcher state alive for the desktop runtime. It does not provide arbitrary command execution.

## Packaging Decision

The packaged desktop app keeps the existing JavaScript bridge worker and starts it from Tauri-managed resources with an explicitly resolved Node runtime. This is the selected path over a generic Node sidecar command or a native Rust rewrite, because it preserves the reviewed bridge whitelist, the existing `GitOperationQueue`, watcher ownership, GitHub auth backend, and the Git CLI wrapper without reopening the product surface.

The current bundle does not include a Node binary in `tauri.conf.json`. Installed builds therefore need `SOURCE_COMPANION_NODE_BINARY` to point at a usable runtime or `node` to be available through the app process environment. If the runtime is unavailable, the app shell remains open and repository or GitHub bridge commands return `desktop-bridge-runtime-missing`.

Runtime paths are separated as follows:

- Development: `SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER` and `SOURCE_COMPANION_NODE_BINARY` may point at the source-tree worker and a local Node binary. If unset, development may continue to use `src/desktop-bridge-worker.js` and `node` from `PATH`.
- CI: Node tests and Rust checks may use the source-tree worker and CI-provided Node. Bundle-oriented checks must also verify the resource manifest so the worker is included in Tauri builds and the missing-runtime path remains structured.
- Installed bundle: Tauri resolves the worker from packaged resources and resolves the Node runtime through `SOURCE_COMPANION_NODE_BINARY` or the default `node` lookup. The installed app must not depend on `CARGO_MANIFEST_DIR` or the local project source tree. If the runtime is unavailable, repository and GitHub bridge commands return `desktop-bridge-runtime-missing` while the app shell remains open.

Bridge startup errors follow the same structured-error approach as backend requests:

- missing worker resource: `desktop-bridge-worker-missing`
- missing Node runtime: `desktop-bridge-runtime-missing`
- worker spawn or handshake failure: `desktop-bridge-start-failed`
- worker exits after startup: `desktop-bridge-worker-stopped`

These errors must be surfaced as desktop bridge failures, not as a new shell, filesystem, token, or GitHub API capability. The bridge remains limited to named source-control and GitHub-auth commands.

Current bundle smoke coverage verifies the packaged worker resource, the preserved bridge whitelist, and the missing-runtime/missing-worker error path. A full installed-app start smoke without a system Node dependency remains a separate follow-up if a Node binary is later added to the bundle.

## Native Dialogs

Folder dialog commands are allowed only for:

- opening a repository folder
- choosing a URL-clone target folder
- choosing a publish folder

They return `{ ok, canceled, path, error }`. They do not read or write files and do not expose a generic filesystem API.

## Window Mode

`desktop_set_window_mode` accepts only `floating` or `full`. It adjusts size, minimum size, and always-on-top state for the existing main window. It does not create a second UI instance, duplicate repository state, or run Git operations.

## Watchers

Watcher commands run in the persistent bridge worker:

- `startRepositoryWatch` creates a `RepositoryStatusWatcher` for a concrete repository context.
- `getRepositoryWatch` returns watcher snapshot, last loaded repository state, and last error.
- `stopRepositoryWatch` closes the watcher when the tab closes.

Refreshes continue to use debounce, busy deferral, and the same `loadRepositoryState` path as the Full UI.

## Publish

Desktop Publish to GitHub uses `preparePublishPreflight` and `runPublishAction`. Both methods reuse the existing publish modules, run local Git steps through `GitOperationQueue` and the Git CLI wrapper, and use only the backend-internal GitHub client for auth status and repository creation.

The renderer passes repository path, name, description, visibility, and explicit init/public confirmations. It never passes a token, `githubClient`, or arbitrary GitHub API request to Tauri. Repository responses are normalized to token-free metadata such as owner, name, visibility, and clone URLs.

## GitHub Auth And API

The bridge exposes token-free GitHub methods:

- `getGitHubAuthStatus`
- `startGitHubDeviceLogin`
- `getGitHubDeviceLoginStatus`
- `pollGitHubDeviceLogin`
- `cancelGitHubDeviceLogin`
- `loginGitHub`
- `logoutGitHub`
- `listGitHubUserRepositories`
- `searchGitHubUserRepositories`
- `listGitHubPullRequests`
- `createGitHubPullRequest`
- `loadGitHubPullRequestChecks`
- `loadGitHubPullRequestReviewContext`

Tauri command names:

- `github_get_auth_status`
- `github_device_login_start`
- `github_device_login_status`
- `github_device_login_poll`
- `github_device_login_cancel`
- `github_login`
- `github_logout`
- `github_list_user_repositories`
- `github_search_user_repositories`
- `github_list_pull_requests`
- `github_create_pull_request`
- `github_load_pull_request_checks`
- `github_load_pull_request_review_context`

`createDesktopBridgeBackend()` creates a `GitHubAuthBridgeBackend` with backend-only `GitHubDeviceFlow` and `DesktopSecureTokenStore` by default. Tests may inject these pieces, but renderer code never receives them.

The Device Flow talks to GitHub OAuth endpoints from the worker, optionally opens only the verification URL in the system browser, and polls for access tokens backend-internally. Repository list/search, PR lookup/creation, checks, review comments, and issue links use the backend-internal GitHub client.

Responses return only normalized metadata. Device codes and access tokens are not returned to the renderer. Real desktop login requires `SOURCE_COMPANION_GITHUB_CLIENT_ID` or `GITHUB_OAUTH_CLIENT_ID`.

## Secure Token Storage

`DesktopSecureTokenStore` stores access tokens in the operating system credential store and keeps only non-sensitive metadata in a local JSON metadata file:

- Windows Credential Manager
- macOS Keychain
- Linux Secret Service/libsecret

Renderer responses contain auth status, user code, verification URL, expiration, polling interval, and structured errors only.

## Excluded Surface

The bridge must not add:

- `runGitCommand`, `runShellCommand`, `exec`, `spawn`, or equivalent free command methods
- generic file read/write/list APIs
- token values in renderer state or repository contexts
- free GitHub API, issue, notification, workflow, or dashboard commands
