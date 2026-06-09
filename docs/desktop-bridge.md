# Desktop Bridge Contract

Die Desktop-Bridge ist die einzige Renderer-Fassade fuer lokale Repository-Aktionen in der Tauri-Laufzeit. Sie bleibt auf Versionskontrolle beschraenkt und bietet keine freie Shell-, Command-Runner-, Token- oder generische Dateisystem-API.

## Renderer-Fassade

`src/desktop-bridge.js` stellt `SourceCompanionDesktopBridge` bereit. `src/main.js` bevorzugt diese Fassade fuer Repository-State, Diff sowie Datei-, Hunk-, Commit-, Clone-, Branch-, Sync-, Merge- und Stash-Aktionen und nutzt die bisherigen Web-/CommonJS-Fallbacks nur, wenn keine Desktop-Bridge vorhanden ist. Tauri-Aufrufe uebergeben Renderer-Anfragen gekapselt als `{ request: ... }`, damit native Handler keine freie Argument- oder Shell-Flaeche erhalten. Native Ordnerdialoge bleiben auf die erlaubten Open-/Clone-/Publish-Flows begrenzt; Watcher-Befehle starten, lesen und stoppen nur Repository-Status-Watcher fuer konkrete Repository-Kontexte.

Erlaubte Methoden:

- `openRepository`
- `pickRepositoryFolder`
- `pickCloneTargetFolder`
- `pickPublishFolder`
- `loadRepositoryState`
- `loadFileDiff`
- `runFileAction`
- `runHunkAction`
- `runCommitAction`
- `runCloneAction`
- `runBranchAction`
- `runSyncAction`
- `runMergeAction`
- `runStashAction`
- `getGitOutput`
- `startRepositoryWatch`
- `getRepositoryWatch`
- `stopRepositoryWatch`

Zugehoerige Tauri-Command-Namen:

- `repository_open`
- `repository_pick_folder`
- `repository_pick_clone_target_folder`
- `repository_pick_publish_folder`
- `repository_load_state`
- `repository_load_file_diff`
- `repository_run_file_action`
- `repository_run_hunk_action`
- `repository_run_commit_action`
- `repository_run_clone_action`
- `repository_run_branch_action`
- `repository_run_sync_action`
- `repository_run_merge_action`
- `repository_run_stash_action`
- `repository_get_git_output`
- `repository_watch_start`
- `repository_watch_get`
- `repository_watch_stop`

## Backend-Regeln

Die Bridge-Backend-Implementierung delegiert Git-Ausfuehrungen ueber `GitOperationQueue`. Die Queue ruft weiterhin nur den bestehenden `git-cli-wrapper` auf. Dadurch bleiben Whitelist, strukturierte Argumente, Force-Push-Ablehnung, stdout, stderr, Exit-Code und strukturierte Fehler der bestehenden Git-Schicht erhalten.

`src-tauri/src/lib.rs` registriert fuer jeden erlaubten Tauri-Command einen `#[tauri::command]`-Handler und einen `invoke_handler`. Diese Handler starten einen persistenten `src/desktop-bridge-worker.js`-Prozess mit `--preserve-symlinks` und `--preserve-symlinks-main` und senden JSON-RPC-artige Methoden an `createDesktopBridgeBackend()`. Dadurch bleibt die Queue pro Desktop-Laufzeit erhalten, und Git-Ausfuehrungen laufen weiterhin durch die bestehende JS-Git-Schicht statt durch freie native Commands.

Die drei Ordnerdialog-Commands laufen nativ ueber `tauri-plugin-dialog` und liefern nur `{ ok, canceled, path, error }` zurueck. Sie lesen oder schreiben keine Dateien und geben keine generische Dateisystem-Schnittstelle frei. Der Renderer schreibt den ausgewaehlten Pfad in das jeweilige Open-, Clone- oder Publish-Feld und laesst die bestehenden Validierungen fuer ungueltige oder fehlende Pfade aktiv.

Die Watcher-Commands laufen im persistenten Bridge-Worker. `startRepositoryWatch` erstellt einen `RepositoryStatusWatcher` fuer den Repository-Kontext, `getRepositoryWatch` liefert Snapshot, letzten geladenen Repository-State und letzten Fehler, und `stopRepositoryWatch` schliesst den Handle beim Tab-Schliessen. Refreshes nutzen weiter Debounce, Busy-Deferral und denselben `loadRepositoryState`-Pfad wie die Full UI.

`getGitOutput` liefert den Queue-Snapshot fuer den Repository-Kontext. Die UI darf daraus laufende, queued und abgeschlossene Operationen anzeigen, aber keine neuen Git-Argumente ableiten.

## GitHub Auth Bridge

Die Desktop-Bridge stellt GitHub Auth als explizite, tokenfreie Methoden bereit:

- `getGitHubAuthStatus`
- `startGitHubDeviceLogin`
- `getGitHubDeviceLoginStatus`
- `pollGitHubDeviceLogin`
- `cancelGitHubDeviceLogin`
- `loginGitHub`
- `logoutGitHub`
- `listGitHubUserRepositories`
- `searchGitHubUserRepositories`

Zugehoerige Tauri-Command-Namen:

- `github_get_auth_status`
- `github_device_login_start`
- `github_device_login_status`
- `github_device_login_poll`
- `github_device_login_cancel`
- `github_login`
- `github_logout`
- `github_list_user_repositories`
- `github_search_user_repositories`

Diese Commands laufen ebenfalls ueber den persistenten Bridge-Worker. Der Default-Pfad von `createDesktopBridgeBackend()` erstellt dafuer ein `GitHubAuthBridgeBackend` mit backend-only `GitHubDeviceFlow` und `DesktopSecureTokenStore`; Tests duerfen diese Bausteine injizieren, der Renderer bekommt aber nie direkten Zugriff darauf. Der Device Flow spricht die GitHub-OAuth-Endpunkte im Worker an, oeffnet optional nur die Verification URL im Systembrowser und pollt Access Tokens backend-intern. Repository-Liste und Repository-Suche laufen ueber denselben backend-internen GitHub-Client, liefern nur normalisierte Metadaten wie Owner/Name, Beschreibung, Sichtbarkeit, Stars und Clone-URLs und geben keine Token-Werte an den Renderer zurueck. Fuer echte Desktop-Logins muss ein OAuth Client ueber `SOURCE_COMPANION_GITHUB_CLIENT_ID` oder `GITHUB_OAUTH_CLIENT_ID` konfiguriert sein.

`DesktopSecureTokenStore` speichert das Access Token im Betriebssystem-Credential-Store und haelt nur nicht-sensitive Metadaten wie Login, Scopes, Token-Quelle und letzte Validierung in einer lokalen JSON-Metadatendatei. Windows nutzt Windows Credential Manager, macOS Keychain und Linux Secret Service/libsecret ueber die jeweilige Plattform-Schnittstelle. Renderer-Antworten enthalten nur Auth-Status, User Code, Verification URL, Ablaufzeit, Polling-Intervall und strukturierte Fehler. Device Code und Access Token werden nicht normalisiert und nicht an den Renderer zurueckgegeben.

## Ausgeschlossen

- keine Methode wie `runGitCommand`, `runShellCommand`, `exec` oder `spawn`
- keine generische Datei-Lese-/Schreib-API
- keine Token-Werte im Renderer oder Repository-Kontext
- keine freien GitHub-API-, Issue-, Notification-, Workflow- oder Dashboard-Commands
