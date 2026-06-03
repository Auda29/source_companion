# Source Companion - Scope-Gates

Dieses Dokument fasst die verbindlichen Produktgrenzen aus `docs/plan.md` zusammen. `docs/plan.md` bleibt die Produktquelle; diese Gates sind die kurze Pruefung fuer neue Features, Tasks und Architekturentscheidungen.

## 1. Produktquellen-Gate

Jede Produktentscheidung muss auf `docs/plan.md` zurueckfuehrbar sein. Wenn ein Feature dort nicht direkt vorgesehen ist, braucht es vor der Umsetzung eine Plananpassung statt einer stillen Implementierung.

Relevant sind besonders:

- Abschnitt 2: Produktprinzip
- Abschnitt 3: Harte Produktgrenzen
- Abschnitt 8: Backend-Architektur
- Abschnitt 9: Sicherheits- und UX-Regeln
- Abschnitt 12: Ausdruecklich nicht bauen

## 2. Git/GitHub-Versionskontroll-Gate

Jedes neue Feature muss diese Frage bestehen:

Hilft es direkt beim Anzeigen, Pruefen oder Ausfuehren eines Git/GitHub-Versionskontrollschritts?

Wenn die Antwort nein ist, gehoert das Feature nicht in Source Companion. Das Produkt bleibt eine dedizierte Git/GitHub-Oberflaeche und kein allgemeines Entwickler-Cockpit.

## 3. Nicht-Ziele

Diese Funktionen sind fuer das erste Produktziel ausgeschlossen:

- Code-Editor oder Datei-Bearbeitung
- Terminal oder freie Shell-Kommandos
- Agent, Agent Runner oder AI Chat
- Workspaces
- Projektbaum
- Plugin-System oder App-Framework
- Task Runner, Test Runner oder Build Runner
- Projektmanagement, Issue Board, Kanban oder Notifications-Zentrale
- Wiki, Discussions oder Actions-Dashboard Deluxe
- GitLab, Bitbucket oder generische Forge-Abstraktion
- eigenes SSH-Key-Management
- Force Push
- interaktives Rebase, History-Rewrite-Wizard oder komplexes Cherry-Pick-UI

## 4. Backend-Scope-Gate

Backend-Komponenten bleiben auf Source-Control-Funktionen begrenzt:

- Git CLI Wrapper
- GitHub API Client
- Dateiwatcher
- lokaler State Store
- Auth/Token-Verwaltung

Keine UI darf freie Shell-Kommandos ausloesen. Git-Kommandos laufen ueber whitelisted, strukturierte Wrapper mit getrenntem stdout, stderr, Exit-Code und lesbaren Fehlern.

## 5. Sicherheits-Gate

Gefaehrliche Aktionen brauchen eine erkennbare Warnung oder Bestaetigung, insbesondere:

- Discard
- Amend
- Branch loeschen
- Remote ueberschreiben
- Public Publish

Source Companion fuehrt keine versteckten Automatismen aus: kein Auto-Commit, kein Auto-Push, kein Auto-Publish und kein stilles Loeschen oder Ueberschreiben.
