# Source Companion

Source Companion ist eine eigenstaendige, minimalistische Git/GitHub-Oberflaeche im Stil des Cursor- bzw. VS-Code-Source-Control-Panels.

Das Ziel ist bewusst eng:

- kein Editor
- kein Terminal
- kein Agent
- kein Dashboard
- kein Projektbaum
- nur Git/GitHub-UI

Source Companion soll Cursor nur fuer Git ersetzen.

## Produktquelle

`docs/plan.md` ist die verbindliche Produktquelle fuer Source Companion. Neue Features muessen am Scope-Gate in `docs/scope-gates.md` gemessen werden, bevor sie in Planung oder Implementierung aufgenommen werden.

## Produktziel

Die erste vollstaendige Produktversion soll mehrere Repositories parallel in Tabs oeffnen, Git-Zustand anzeigen, Aenderungen pruefbar machen und normale Git/GitHub-Versionskontrollschritte ausfuehren.

Geplante Kernbereiche:

- lokaler Git-Status
- Changes, Staged, Untracked und Conflicts
- Datei- und Hunk-Staging
- Diffs
- Commit und Amend
- Branches
- Fetch, Pull, Push und Sync
- Stash-Basisfunktionen
- einklappbarer Graph/History-Bereich
- GitHub Login
- Clone from GitHub
- Publish to GitHub
- PRs, Checks und Review-Kommentare

## Produktgrenzen

Nicht Teil des Produktziels:

- Code-Editor
- Terminal
- AI Chat oder Agent-Runner
- Task-Runner
- Issue Board oder Kanban
- Workspaces
- GitLab/Bitbucket
- eigenes SSH-Key-Management
- Force Push

## Planung

- Produktplan: [docs/plan.md](docs/plan.md)
- Scope-Gates: [docs/scope-gates.md](docs/scope-gates.md)
- Desktop-Shell: [docs/desktop-shell.md](docs/desktop-shell.md)
- Aufgabenliste: [docs/tasks.md](docs/tasks.md)
- Brainstorming: [docs/brainstorm.md](docs/brainstorm.md)

## Status

Source Companion befindet sich in der Planungs- und Aufbauphase.

## License

MIT License. Siehe [LICENSE](LICENSE).
