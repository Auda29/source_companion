# Source Companion - Core Flow Review Checklist

Diese Checkliste ist die Review-Grundlage fuer die erste Kernflow-Abnahme. Sie verbindet vorhandene automatisierte Tests mit manuellen Repro-Schritten fuer die Flows, die lokale Git-, GitHub- oder Desktop-Zustaende brauchen.

## Automatisierte Basispruefung

Vor dem manuellen Review ausfuehren:

```powershell
$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'
node --test tests/*.test.js
```

Erwartung:
- alle Tests bestehen
- keine unerwarteten Git-Kommandos ausserhalb des whitelisted Git CLI Wrappers
- Fehlerobjekte enthalten lesbare `message`-/`kind`-Felder sowie stdout, stderr und Exit-Code, wo Git beteiligt ist

## Testabdeckung

| Bereich | Automatisierte Abdeckung |
| --- | --- |
| Git CLI Whitelist, Argumentbau und Fehlervertrag | `tests/git-cli-wrapper.test.js` |
| Repository-Zustand, Branch, Remote, ahead/behind, Changes und Konflikte | `tests/repository-state.test.js` |
| Dateiwatcher und entprellter Refresh | `tests/repository-status-watcher.test.js` |
| Diff-Laden und Ersatz-/Fehlerzustaende | `tests/repository-diff.test.js` |
| Datei-Stage, -Unstage und -Discard | `tests/repository-file-actions.test.js` |
| Hunk-Stage und -Unstage | `tests/repository-hunk-actions.test.js` |
| Commit, Commit staged changes und Amend | `tests/repository-commit-actions.test.js` |
| Branch anzeigen, wechseln, erstellen und loeschen | `tests/repository-branch-actions.test.js` |
| Fetch, Pull, Push und Sync-Fehler | `tests/repository-sync-actions.test.js` |
| Stash erstellen, anwenden, poppen und droppen | `tests/repository-stash-actions.test.js` |
| Clone per URL und Clone from GitHub UI-Routing | `tests/repository-clone-actions.test.js`, `tests/main-clone-flow.test.js` |
| Publish-Vorbedingungen, Remote-Schutz und Initial Push | `tests/repository-publish-actions.test.js` |
| GitHub Auth/API, PRs, Checks, Review-Kommentare und Issue-Links | `tests/github-api-client.test.js` |
| History/Graph-Daten | `tests/repository-history.test.js` |
| Operation Queue pro Repository | `tests/git-operation-queue.test.js` |

## Manuelle Kernflow-Pruefung

### Repo ohne Git und Git init

1. Einen temporaren Ordner ohne `.git` in Source Companion oeffnen.
2. Sichtbar pruefen: Zustand "kein Git-Repository", Aktionen fuer Initialize, Clone und Publish.
3. Initialize Repository ausfuehren.
4. Erwartung: Repository-Kontext wechselt in normalen Git-Status, Git Output zeigt das Init-Ergebnis, keine Dateien werden automatisch committet.

### Clone

1. Clone Repo mit einer HTTPS- oder SSH-Git-URL und einem frei gewaehlten Zielordner starten.
2. Clone from GitHub mit GitHub-Login oder simuliertem Repo-Eintrag starten.
3. Erwartung: Zielpfad wird als finaler Clone-Zielordner verwendet, Erfolg oeffnet das Repository, Fehler bleiben lesbar im Dialog und Git Output.

### Publish

1. Lokalen Ordner ohne Remote auswaehlen.
2. Publish to GitHub mit privater Sichtbarkeit pruefen.
3. Danach denselben Flow mit bestehendem `origin` pruefen.
4. Erwartung: Vorbedingungen werden angezeigt, Public Publish braucht eine Warnung, bestehende Remotes werden nicht automatisch ueberschrieben, Initial Push und Fehler erscheinen im Git Output.

### Status, Diff, Datei- und Hunk-Staging

1. In einem Testrepo je eine unstaged, staged, untracked, geloeschte und conflicted Datei erzeugen.
2. Jede Bucket-Liste oeffnen und eine Datei auswaehlen.
3. Stage, Unstage und Discard fuer passende Dateien ausfuehren; Discard nur nach Bestaetigung.
4. Eine Datei mit zwei getrennten Hunks erzeugen und jeweils einen Hunk stagen bzw. unstagen.
5. Erwartung: Buckets bleiben getrennt, staged/unstaged Diffs sind unterscheidbar, `MM`-Zustaende verlieren beim Discard aus Changed keinen staged Inhalt, stale Hunk-Patches liefern lesbare Fehler.

### Commit und Amend

1. Mit leerem Staging einen Commit versuchen.
2. Mit leerer Message einen Commit versuchen.
3. Normales Commit, Commit staged changes und Amend Commit ausfuehren.
4. Erwartung: Button-Zustaende und Fehler erscheinen nahe am Commit-Bereich, Amend ist als history-aendernde Aktion markiert und braucht Bestaetigung.

### Branch, Pull, Push, Sync und Stash

1. Branch wechseln, neuen Branch erstellen und einen Branch loeschen.
2. Pull/Push/Sync gegen einen Remote mit erwartbarem Fehler ausfuehren, zum Beispiel fehlender Upstream oder Auth-Fehler.
3. Lokale Aenderungen stashen, Stash anwenden, poppen und droppen.
4. Erwartung: Branch-/Sync-/Stash-Aktionen aktualisieren den Repository-Kontext, Konflikte und Git-Fehler bleiben sichtbar, riskante Aktionen brauchen Warnungen.

### GitHub Auth, PRs, Checks und Review-Kommentare

1. GitHub-Funktionen ohne Token aufrufen.
2. Mit gueltigem Token ein GitHub-Remote-Repo oeffnen.
3. Vorhandene PR fuer den aktuellen Branch laden oder eine PR mit Base, Titel und Beschreibung erstellen.
4. PR-Checks, Review-Kommentare und Issue-Links aus Branch-Namen oder Commit-Messages pruefen.
5. Erwartung: fehlende Auth, fehlende Scopes, Rate-Limits, Netzwerkfehler und API-Fehler sind verstaendlich; PR, Checks, Review-Kommentare und Issue-Links werden angezeigt oder zur GitHub-Ansicht verlinkt.

## Scope-Absicherung

Diese Ausschluesse muessen bei Review und Tests erhalten bleiben:

- kein Editor und keine Datei-Bearbeitung in Diff- oder Konfliktansichten
- kein Terminal, kein freier Command Runner und keine freien Shell-Kommandos
- kein Force Push
- keine Workspaces oder globale Vermischung mehrerer Repository-Tabs
- kein GitLab/Bitbucket oder generische Forge-Abstraktion
- kein Issue Board, Kanban, Wiki, Discussions- oder Notifications-Modul
- kein Auto-Commit, Auto-Push, Auto-Publish oder stilles Remote-Ueberschreiben

Referenzdokumente: `docs/plan.md`, `docs/scope-gates.md`, `docs/architecture.md`.
