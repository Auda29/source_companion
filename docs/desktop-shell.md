# Source Companion Desktop Shell

As of 2026-06-09, the desktop shell packages the existing Full UI in a local Tauri window and exposes only controlled source-control bridge commands.

## Goal

The desktop app gives the reusable web UI the local capabilities it needs:

- local repository access
- Git CLI execution through the existing wrapper and operation queue
- native folder dialogs for open, clone, and publish flows
- repository status watchers
- backend-only GitHub auth and secure token storage
- Full UI and Floating Window modes backed by the same repository state

The shell does not add a terminal, editor, project tree, task runner, dashboard, or free command surface.

## Entry Points

Install dependencies:

```powershell
npm install
```

Copy the web assets into the desktop asset directory:

```powershell
npm run desktop:assets
```

Run the Tauri development app:

```powershell
npm run desktop:dev
```

Build the desktop bundle:

```powershell
npm run desktop:build
```

`desktop:dev` and `desktop:build` require Rust/Cargo and the Tauri platform prerequisites.

## Asset Boundary

`src-tauri/tauri.conf.json` points at `../desktop-dist`. The asset copy step includes the current Full UI entry point and `src/` assets. Documentation, tests, Git data, and Tauri source files are not shipped as frontend assets.

## Security Configuration

The renderer runs as a Tauri webview without Node access. The current capability is restricted to the main window and does not grant shell, filesystem, or arbitrary command plugins. Network policy is limited to the app's own assets and the GitHub HTTP targets already needed by the product.

## UI States

The desktop shell uses the same `index.html` and `src/` files as the web prototype, so the empty, invalid path, non-Git folder, repository, busy, conflict, and error states stay consistent.

Desktop-specific execution is routed through the bridge documented in `docs/desktop-bridge.md`.
