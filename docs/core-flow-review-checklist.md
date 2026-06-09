# Source Companion Core Flow Review Checklist

This checklist is the review baseline for the first product goal. It connects automated tests with manual repro steps for flows that need local Git, GitHub, or desktop state.

## Automated Baseline

Run before manual review:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --test tests/*.test.js
```

Expected result:

- all tests pass
- no unexpected Git commands bypass the whitelisted Git CLI wrapper
- error objects include readable `message` and `kind` fields, plus stdout, stderr, and exit code where Git is involved

## Test Coverage

| Area | Automated coverage |
| --- | --- |
| Git CLI whitelist, argument building, and error contract | `tests/git-cli-wrapper.test.js` |
| Repository state, branch, remote, ahead/behind, changes, and conflicts | `tests/repository-state.test.js` |
| Repository watcher and debounced refresh | `tests/repository-status-watcher.test.js` |
| Diff loading and replacement/error states | `tests/repository-diff.test.js` |
| File stage, unstage, and discard | `tests/repository-file-actions.test.js` |
| Hunk stage and unstage | `tests/repository-hunk-actions.test.js` |
| Commit, commit staged changes, and amend | `tests/repository-commit-actions.test.js` |
| Branch show/switch/create/delete | `tests/repository-branch-actions.test.js` |
| Fetch, pull, push, and sync errors | `tests/repository-sync-actions.test.js` |
| Merge validation and conflict/error handling | `tests/repository-merge-actions.test.js` |
| Stash create/apply/pop/drop | `tests/repository-stash-actions.test.js` |
| URL clone and Clone from GitHub UI routing | `tests/repository-clone-actions.test.js`, `tests/main-clone-flow.test.js` |
| Publish preflight, remote protection, and initial push | `tests/repository-publish-actions.test.js` |
| GitHub auth/API, PRs, checks, review comments, and issue links | `tests/github-api-client.test.js` |
| History/graph data | `tests/repository-history.test.js` |
| Per-repository operation queue | `tests/git-operation-queue.test.js` |
| Desktop shell and bridge parity | `tests/desktop-shell.test.js`, `tests/desktop-bridge.test.js` |

## Manual Core Flow Review

### Folder Without Git And Git Init

1. Open a temporary folder without `.git`.
2. Confirm the app shows a non-Git state and actions for Initialize Repository, Clone Repo, and Publish to GitHub.
3. Run Initialize Repository.
4. Confirm the context switches to normal Git status, Git Output shows init output, and no automatic commit is created.

### Clone

1. Start Clone Repo with an HTTPS or SSH Git URL and an explicitly selected target folder.
2. Start Clone from GitHub with GitHub login or a simulated repository entry.
3. Confirm the chosen target path is the final clone folder, success opens the repository, and failures remain readable in the dialog and Git Output.

### Publish

1. Select a local folder without a remote.
2. Run Publish to GitHub with private visibility.
3. Repeat with an existing `origin`.
4. Confirm preconditions are visible, public publish requires confirmation, existing remotes are not overwritten silently, and initial push plus failures appear in Git Output.

### Status, Diff, File Actions, And Hunks

1. In a test repository, create one unstaged, staged, untracked, deleted, and conflicted file.
2. Open each bucket and select a file.
3. Stage, unstage, and discard appropriate files; discard only after confirmation.
4. Create a file with two separate hunks and stage/unstage one hunk.
5. Confirm buckets stay separate, staged/unstaged diffs are distinct, `MM` discard from Changed preserves staged content, and stale hunk patches report readable errors.

### Commit And Amend

1. Try committing with empty staging.
2. Try committing with an empty message.
3. Run normal commit, commit staged changes, commit and push, and amend.
4. Confirm button states and errors appear near the commit area, and amend is visibly history-changing and confirmed.

### Branch, Pull, Push, Sync, Merge, And Stash

1. Switch branches, create a branch, and delete a branch.
2. Pull/push/sync against a remote with an expected failure such as missing upstream or auth failure.
3. Merge the current branch with a selected target branch.
4. Stash local changes, apply/pop a stash, and drop a stash.
5. Confirm all actions update the repository context, conflicts and Git errors stay visible, and risky actions require warnings.

### GitHub Auth, PRs, Checks, And Review Comments

1. Call GitHub features without a token.
2. Open a GitHub remote repository with valid auth.
3. Load an existing PR for the current branch or create one with base, title, and description.
4. Check PR checks, review comments, and issue links from branch names or commit messages.
5. Confirm missing auth, missing scopes, rate limits, network failures, and API errors are understandable.

### Desktop Full UI And Floating Window

1. Run `npm run desktop:assets` and `npm run desktop:dev` in an environment with `cargo`.
2. Open, clone, publish, commit, sync, branch, stash, PR, check, and review-comment flows through the desktop app.
3. Switch between Floating Window and Full UI while a repository has local state and while a queue operation is visible.
4. Confirm no duplicate Git operation starts and repository context, active tab, errors, and commit message state remain consistent.

## Scope Checks

Review must preserve these exclusions:

- no editor and no file editing in diff or conflict views
- no terminal, free command runner, or free shell commands
- no force push
- no workspaces or global mixing of repository tabs
- no GitLab/Bitbucket or generic forge abstraction
- no issue board, Kanban, wiki, discussions, notification, workflow, or dashboard module
- no auto-commit, auto-push, auto-publish, or silent remote overwrite

Reference documents: `docs/plan.md`, `docs/scope-gates.md`, and `docs/architecture.md`.
