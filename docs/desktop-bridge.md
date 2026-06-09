# Desktop Bridge Contract

Die Desktop-Bridge ist die einzige Renderer-Fassade fuer lokale Repository-Aktionen in der Tauri-Laufzeit. Sie bleibt auf Versionskontrolle beschraenkt und bietet keine freie Shell-, Command-Runner-, Token- oder generische Dateisystem-API.

## Renderer-Fassade

`src/desktop-bridge.js` stellt `SourceCompanionDesktopBridge` bereit. `src/main.js` bevorzugt diese Fassade fuer Repository-State, Diff sowie Datei-, Hunk-, Commit-, Branch-, Sync- und Stash-Aktionen und nutzt die bisherigen Web-/CommonJS-Fallbacks nur, wenn keine Desktop-Bridge vorhanden ist.

Erlaubte Methoden:

- `openRepository`
- `loadRepositoryState`
- `loadFileDiff`
- `runFileAction`
- `runHunkAction`
- `runCommitAction`
- `runBranchAction`
- `runSyncAction`
- `runStashAction`
- `getGitOutput`

Zugehoerige Tauri-Command-Namen:

- `repository_open`
- `repository_load_state`
- `repository_load_file_diff`
- `repository_run_file_action`
- `repository_run_hunk_action`
- `repository_run_commit_action`
- `repository_run_branch_action`
- `repository_run_sync_action`
- `repository_run_stash_action`
- `repository_get_git_output`

## Backend-Regeln

Die Bridge-Backend-Implementierung delegiert Git-Ausfuehrungen ueber `GitOperationQueue`. Die Queue ruft weiterhin nur den bestehenden `git-cli-wrapper` auf. Dadurch bleiben Whitelist, strukturierte Argumente, Force-Push-Ablehnung, stdout, stderr, Exit-Code und strukturierte Fehler der bestehenden Git-Schicht erhalten.

`getGitOutput` liefert den Queue-Snapshot fuer den Repository-Kontext. Die UI darf daraus laufende, queued und abgeschlossene Operationen anzeigen, aber keine neuen Git-Argumente ableiten.

## Ausgeschlossen

- keine Methode wie `runGitCommand`, `runShellCommand`, `exec` oder `spawn`
- keine generische Datei-Lese-/Schreib-API
- keine Token-Werte im Renderer oder Repository-Kontext
- keine GitHub-Auth-Bridge in diesem Vertrag; sie bleibt fuer `T51`
