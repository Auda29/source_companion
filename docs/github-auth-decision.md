# Source Companion GitHub Auth Decision

As of 2026-06-09, Source Companion uses a GitHub OAuth Device Authorization Flow for the desktop target, coordinated by the Tauri/backend layer.

## Decision

The renderer starts login only through an allowed bridge command. The backend requests a device code from GitHub, returns only user-facing login metadata to the UI, and polls for the access token backend-internally.

Tokens are not stored in the renderer, `localStorage`, `sessionStorage`, IndexedDB, the local state store, repository contexts, Git remotes, Git URLs, Git command arguments, or Git Output.

## Rationale

- Device Flow fits a local desktop app without an embedded redirect server.
- Token exchange stays inside the desktop bridge boundary.
- Users can authenticate in the system browser.
- The reusable web UI can show auth status without receiving secrets.
- HTTPS remains the preferred GitHub clone/publish path; SSH URLs are allowed only when the local Git/SSH setup already works.

## Required Scopes

The first product goal requests:

- `repo`: read/create private and public repositories, support clone/publish, and access PR/check/review context for repository workflows.
- `read:user`: show login identity and associate auth status with a user.

Not requested:

- `workflow`
- admin, org, or enterprise scopes
- scopes for issues, discussions, wiki, notifications, or project management as product domains

If GitHub later offers a stable narrower scope set for the needed source-control actions, `repo` can be replaced after a documented review.

## Login Flow

1. UI calls the desktop bridge to start device login.
2. Backend requests device code, user code, verification URL, expiration, and polling interval.
3. UI shows user code, URL, expiration, and login status.
4. Backend may open the system browser to the verification URL.
5. Backend polls at GitHub's interval.
6. `authorization_pending` remains a visible waiting state.
7. `slow_down` increases the interval and is not treated as a final error.
8. Expiration, denied access, network errors, and API errors end login with structured errors.
9. On success, backend validates token, user, and scopes.
10. Only after validation does backend store the token in secure storage.

Canceling login stops polling and stores no token.

## Secure Token Storage

Tokens are stored through a backend `SecureTokenStore` abstraction over OS credential storage:

- Windows Credential Manager
- macOS Keychain
- Linux Secret Service/libsecret

Stored secret:

- service: `Source Companion`
- account key: `github.com:<login>`
- secret: GitHub access token

Non-sensitive metadata may be stored separately:

- GitHub login
- token source `device-flow`
- detected scopes
- last validation time

If secure storage is unavailable, the app reports `secure-storage-unavailable` and does not allow persistent login. A development-only in-memory token may exist for the current runtime, but it must be visibly non-persistent.

## HTTPS Git Behavior

GitHub API calls use the token only in the backend.

For HTTPS clone, push, and publish:

- prefer the user's local Git Credential Manager setup
- never write a token into remote URLs
- never pass a token as a Git CLI argument
- if a backend-only credential/askpass flow is later needed, keep it short-lived and remove it after the Git operation

SSH URLs remain accepted, but Source Companion does not manage SSH keys. SSH failures should point to the local Git/SSH setup.

## Logout And Revocation

Logout:

- deletes the token from the OS credential store
- clears in-memory token and auth state
- updates repository contexts to unauthenticated GitHub state
- returns GitHub actions to the no-token state

Logout does not change Git repositories and does not remove remotes.

Token revocation is a separate explicit action if supported by the OAuth app and GitHub API. If revocation fails, local logout still completes and the UI shows the revocation error as an additional note.

Externally revoked tokens are detected on the next GitHub API validation, after which local auth state is cleared and login is offered again.

## No-Token State

Without a valid token, auth status is:

```js
{
  authenticated: false,
  user: null,
  scopes: [],
  tokenSource: null,
  error: null
}
```

GitHub actions remain visible but not silently executable. URL clone remains available without GitHub login. Clone from GitHub, Publish to GitHub, PR creation/status, checks, and review comments show a login prompt with `github-auth-missing`.

## Error Contract

GitHub auth/API errors follow the general backend error contract and may add GitHub-specific fields:

```js
{
  kind: "github-auth-missing",
  message: "GitHub login is required for this action.",
  status: null,
  scopesRequired: [],
  scopesGranted: [],
  rateLimit: null,
  retryAfterSeconds: null,
  raw: null
}
```

Error kinds:

| Kind | Meaning | UI behavior |
| --- | --- | --- |
| `github-auth-missing` | No token is available. | Show login action; do not run the GitHub action. |
| `github-token-invalid` | Token was revoked, invalid, or rejected by GitHub. | Clear local auth state and offer login. |
| `github-scope-missing` | Token lacks required scopes. | Show required/granted scopes and offer login. |
| `github-rate-limit` | Primary rate limit reached. | Show reset time and defer retry. |
| `github-secondary-rate-limit` | Secondary abuse/burst limit reached. | Pause action and show retry guidance when available. |
| `github-network-error` | DNS, TLS, offline, or timeout. | Show network error without clearing token. |
| `github-api-error` | Other GitHub API error. | Show GitHub message and status code. |
| `github-login-expired` | Device code expired. | Let the user restart login. |
| `github-login-cancelled` | User/backend canceled login. | Show neutral canceled state. |
| `secure-storage-unavailable` | OS credential store is unavailable. | Block persistent login. |

Rate-limit responses should include `limit`, `remaining`, `resetAt`, and `retryAfterSeconds` when available. Network errors must not be confused with missing auth.

## Web Prototype Boundary

The web prototype may simulate GitHub auth or hold a non-persistent development state. It must not store tokens in browser storage, URLs, static config, repository contexts, recent repositories, Git remotes, or Git arguments.

Persistent GitHub login is a desktop feature only.
