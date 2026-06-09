# Source Companion Scope Gates

`docs/plan.md` is the product source of truth. These gates are the quick test for new features, tasks, and architecture decisions.

## 1. Product Source Gate

Every product decision must trace back to `docs/plan.md`. If a feature is not directly supported there, update the plan before implementing it.

The most important sections are:

- product definition and feature test
- first product goal
- runtime strategy
- architecture boundaries
- safety and UX rules
- explicit non-goals

## 2. Git/GitHub Source-Control Gate

Every new feature must answer yes to this question:

> Does it directly help a user view, review, or execute a Git/GitHub version-control step?

If not, it does not belong in Source Companion.

## 3. Non-Goals

Excluded from the first product goal:

- code editor or file editing
- terminal or free shell commands
- agent, agent runner, or AI chat
- workspaces
- project tree
- plugin system or app framework
- task runner, test runner, or build runner
- project management, issue board, Kanban, or notification center
- wiki, discussions, workflow control, or Actions dashboard
- GitLab, Bitbucket, or generic forge abstraction
- custom SSH-key management
- force push
- rebase, interactive rebase, history-rewrite wizard, or complex cherry-pick UI

## 4. Backend Scope Gate

Backend components stay limited to source-control capabilities:

- Git CLI Wrapper
- Git Operation Queue
- repository status watcher
- local state store for non-sensitive data
- GitHub API client
- auth and token management
- Tauri desktop bridge/native dialogs

No UI may trigger free shell commands. Git commands must run through whitelisted structured wrappers with separated stdout, stderr, exit code, and readable errors.

## 5. Safety Gate

Risky actions require visible warning or confirmation:

- discard
- amend
- branch delete
- merge when local changes or conflicts are present
- remote overwrite
- public publish

Source Companion does not perform hidden automation: no auto-commit, auto-push, auto-publish, silent delete, silent overwrite, or silent force push.

## 6. Merge/Rebase Gate

Merge is allowed only as a controlled basic action: merge the current branch with a selected target branch, show progress, success, Git errors, conflict state, and Git Output.

Rebase and other history rewrites are outside the first product goal. They must not appear indirectly through Sync, Pull, Push, or More menu actions.
