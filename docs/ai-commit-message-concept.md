# AI Commit Message Concept

This document records the product decision for AI-assisted commit message generation. `docs/plan.md` remains the product source; this concept narrows the optional AI commit message feature so it stays inside the Git/GitHub source-control scope.

## Decision

AI commit message generation is allowed as a later optional commit-box feature, not as part of the current first product goal.

The empty commit-message field must not silently start generation. If the user tries to commit with an empty message, the UI may offer a clear "Generate message" path, but generation requires an explicit confirmation before any diff content is sent to an AI provider. A separate compact "Generate message" button in the commit box is also allowed.

The generated text is only a draft. The user must review or edit it, then explicitly run Commit, Commit staged changes, Commit and Push, or Amend. Source Companion must never auto-commit, auto-push, auto-amend, or run an agent loop after generation.

## Data Basis

Allowed input:

- staged unified diff
- staged file paths and Git status codes
- current branch name
- repository display name
- optional recent commit subjects only when shown in the confirmation UI

Excluded input:

- unstaged diff by default
- untracked file contents unless the file is staged
- full repository tree
- secrets from local storage, tokens, remotes with credentials, environment variables, or OS credential stores
- GitHub issue, PR, review, or check data unless a later task explicitly extends the concept and repeats the privacy review

The first implementation should generate from staged changes only. If nothing is staged, the generator is disabled and the existing commit validation remains the source of truth.

## Privacy

Before generation, the UI must state that staged diff content may be sent to the configured AI provider. The confirmation should expose the selected data scope in plain language and link or open a preview of the prompt payload when practical.

No generated prompt, provider token, model token, or AI response may be stored in `localStorage`, RepositoryContext, Git remotes, Git arguments, or Git Output unless explicitly redacted. Normal UI state may hold the draft commit message text because it is user-visible commit content.

Desktop implementations must route generation through a whitelisted backend or desktop bridge command. Renderer code must not receive provider credentials.

## Cost And Limits

Generation is a user-triggered network operation with visible busy state, success state, and failure state.

The UI must handle:

- provider unavailable
- missing configuration or missing auth
- rate limit
- quota or cost limit reached
- network failure
- request timeout
- response rejected or empty
- staged diff too large

Large staged diffs should be blocked or summarized only after a separate implementation decision. The first implementation should prefer a clear "diff too large" error over hidden truncation.

## UI Boundaries

Allowed UI:

- compact commit-box action to generate a message
- explicit confirmation when generation is started from an empty message
- loading state near the commit box
- generated draft inserted into the commit-message field
- short error near the commit box plus optional raw provider detail in Git Output if redacted

Not allowed:

- AI chat panel
- multi-turn prompt editor
- autonomous agent flow
- automatic staging
- automatic commit, amend, push, publish, or PR creation
- broad code review or refactoring suggestions

The generated draft should not replace non-empty user text without confirmation. If the field already contains text, generation may either be disabled or require confirmation that the draft will replace the current text.

## Error Contract

AI commit generation responses should follow the existing structured error style:

- `kind`
- `message`
- optional redacted `raw`
- `repositoryId`
- operation or request id if available

User-facing errors stay close to the commit box. Redacted diagnostics may appear in Git Output only when they do not reveal provider credentials, tokens, or unapproved prompt payload.

## Acceptance For A Later Implementation

A later implementation task should be considered complete only when:

- empty message generation requires explicit confirmation
- staged diff is the default and only data basis
- the generated draft is editable before commit
- commit execution still uses the existing commit actions and validation
- provider credentials stay backend-internal
- cost, privacy, rate-limit, timeout, empty-response, and large-diff failures are visible
- tests cover prompt scoping, empty-message confirmation, draft insertion, and no auto-commit behavior
