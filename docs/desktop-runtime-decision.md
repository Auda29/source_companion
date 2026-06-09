# Source Companion Desktop Runtime Decision

As of 2026-06-09, Source Companion uses Tauri as the desktop shell for the local app.

## Decision

The existing web/HTML UI remains the reusable frontend. Tauri wraps that UI and exposes a narrow native bridge for local Git, repository state, native folder dialogs, watchers, GitHub auth, and secure token storage.

Renderer code must not receive a free Node, shell, filesystem, token, or generic GitHub API surface.

Electron remains a fallback option only if a later technical review finds that Tauri cannot meet a hard product requirement. For the current product goal, Tauri is the preferred runtime.

## Evaluation

| Criterion | Tauri | Electron | Decision |
| --- | --- | --- | --- |
| Local Git CLI | Git can run behind explicit native/worker bridge commands, then through the JS Git wrapper and queue. | Git can run through Node child processes, but renderer isolation needs extra care. | Tauri keeps the default bridge narrower. |
| Watchers | Repository watchers can be owned by the backend worker and tied to concrete repository contexts. | Node watchers are easy, but the app also carries more ambient Node capability. | Tauri keeps watcher access clearly backend-owned. |
| Native dialogs | Folder selection can be exposed as named open/clone/publish actions. | Also possible. | Tie. |
| GitHub auth | Device flow and token exchange stay behind the desktop bridge. | Also possible with Electron-specific keychain dependencies. | Tauri keeps auth in the same narrow bridge boundary as Git and filesystem access. |
| Secure token storage | Tokens are abstracted behind OS credential stores. | Also possible, with Node/Electron dependencies. | Tauri remains preferred. |
| Packaging footprint | Small desktop shell matches the focused product. | Larger runtime footprint. | Tauri. |
| UI reuse | The same web UI can be packaged as the renderer. | Also possible. | Tie. |

## Architecture Rules

- Renderer code does not run shell commands.
- Git runs only through whitelisted wrapper actions and the Git Operation Queue.
- Native dialogs are exposed only for open, clone, and publish flows.
- GitHub tokens remain backend-internal and never enter renderer state, Git remotes, Git URLs, or Git arguments.
- Floating Window and Full UI share repository state, queue, watchers, and Git Output.
- The desktop shell adds no new product domain.

## Consequences

The desktop implementation must keep bridge methods explicit and testable. Any new desktop capability needs a named product reason, a documented bridge contract, tests, and a check against `docs/scope-gates.md`.
