# Floating Window Concept

As of 2026-06-09, the Floating Window is the compact desktop mode for the active repository context.

## Decision

The Floating Window shows only the most important source-control state and starts only short, explicit Git actions. It is not a second app, a second repository store, or an independent Git executor.

For diff review, file/hunk staging, discard, amend, branch management, stash, publish, GitHub login/logout, PRs, checks, review comments, history, and detailed Git Output, it sends the user to the Full UI with the same active repository context.

Floating Window and Full UI share:

- repository context
- tab state
- Git Operation Queue
- repository watchers
- Git Output
- desktop bridge
- structured errors

## Layout

The window is compact and single-column:

- header with repository name, branch, upstream, and sync state
- change row with counts for Changed, Staged, Untracked, and Conflicts
- compact commit-message field
- action row for Commit, Commit and Push, Push, Pull/Sync, and Refresh
- status row for running operation, last success, or readable error
- Open Full UI action

It does not show a sidebar, file list, diff, graph, project tree, terminal, dashboard, or task runner.

## Visible Fields

Required:

- repository display name
- current branch
- upstream or a no-upstream state
- ahead/behind counters when known
- sync state: clean, local changes, ahead, behind, diverged, conflict, or unknown
- staged, unstaged, untracked, and conflicted file counts
- commit message
- current operation or last error

Optional:

- shortened repository path as secondary text or tooltip
- GitHub remote indicator when the active context has a GitHub link
- last successful commit/push timestamp from the local operation snapshot

Never visible:

- token values
- raw Git arguments
- full list of changed file paths
- GitHub dashboard data outside the source-control surface

## Direct Actions

Allowed directly in the Floating Window:

- Refresh: reloads state through the existing watcher/refresh path.
- Commit: runs the normal commit action for staged changes and the entered message.
- Commit and Push: runs commit and then push only after explicit user selection; both steps remain visible through queue/Git Output state.
- Push: pushes the current branch without force push.
- Pull/Sync: starts the existing pull/sync flow for the active branch.
- Open Full UI: opens or focuses the Full UI for the same repository context.

Allowed only through the Full UI:

- file and hunk staging
- discard
- amend
- branch create/switch/delete
- stash actions
- publish
- GitHub login/logout
- PR creation, checks, and review comments
- diff and history views
- detailed Git Output

Excluded:

- terminal or free command runner
- project tree or file editing
- dashboard, task runner, or notification center
- force push
- automatic commit, push, publish, or destructive action without explicit user choice

## Busy And Error States

The Floating Window shows one primary status:

- `idle`: no running operation; actions follow current repository state.
- `refreshing`: status is loading; write actions remain available only when no repository queue operation is running.
- `running`: a Git operation is running; additional write actions for that repository are disabled.
- `blocked`: conflicts, missing upstream, missing commit message, empty staging, or invalid path prevents the requested action.
- `error`: the last action failed; the short error appears in the Floating Window and details remain in Full UI Git Output.

Expected messages:

- missing commit message: `Enter a commit message.`
- empty staging: `Stage changes before committing.`
- missing upstream: `Set an upstream branch in the Full UI.`
- conflict state: `Resolve conflicts in the Full UI.`
- missing path: `Repository path is no longer available.`

## Warning Forwarding

Risky actions that require confirmation do not run directly in the Floating Window. This includes discard, amend, branch delete, remote overwrite, and public publish.

If the compact mode reaches a state where one of those actions is relevant, it shows a short hint and an Open Full UI action. The confirmation and execution stay in the Full UI.

## Focus Behavior

On launch, the Floating Window shows the last active repository context when it is still valid. If there is no active context, it shows an empty state with Open Full UI.

Focus rules:

- Focus the commit-message field when staged changes exist and no operation is running.
- After a successful commit, keep focus in the commit field so another small commit can be prepared.
- After commit and push, push, or pull/sync, move focus to the status row so success or failure is noticed.
- On error, make the status row focusable and let Enter on Open Full UI open the affected context with Git Output visible.
- Switching to Full UI preserves active tab, repository context, queue snapshot, commit message, and error state.
