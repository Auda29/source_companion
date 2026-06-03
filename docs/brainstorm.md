Dann ist die Produktdefinition eigentlich glasklar:

Kein Editor.
Kein Agent.
Kein Terminal.
Kein Dashboard.
Kein Projektbaum.
Nur Git/GitHub-UI.

Also eher:

Cursor Source-Control Panel als eigenständige App

Nicht:

kleiner VS-Code-Klon mit Midlife-Crisis
Harte Produktgrenzen

Das Tool darf dauerhaft nur diese Domänen haben:

Bereich	Erlaubt
Lokales Git	ja
Branches	ja
Diffs	ja
Staging	ja
Commit	ja
Pull/Push/Fetch	ja
Repo initialisieren	ja
Repo klonen	ja
Repo nach GitHub publishen	ja
Merge/Rebase-Basisfunktionen	ja, vorsichtig
GitHub PRs	ja
GitHub Checks	ja
GitHub Issues nur als Verknüpfung	maximal ja
Editor	nein
Terminal	nein
AI Chat	nein
Projektbaum	nein
Plugin-System	nein
Task-Runner	nein
Besserer Name für das Konzept

Nicht „Git-Client“, weil das schnell zu breit wird.

Eher:

Git Panel
Source Control Panel
Repo Control
Git Cockpit
Codex Git Panel

Mein Favorit für den Scope:

Source Panel

Klingt langweilig. Gut so. Langweilige Tools werden fertig.

Kernprinzip

Das Tool zeigt nur Git-Zustand und erlaubt nur Git-Aktionen.

Alles andere bleibt außerhalb:

Code bearbeiten        → Codex / Zed
Scripte ausführen      → Zed/Pi
TwinCAT analysieren    → Pi
Git bedienen           → dein Git Panel
Funktionsumfang final gedacht
Muss dauerhaft rein
- Repo öffnen
- Ordner ohne Git erkennen
- Neues lokales Git-Repository initialisieren
- Repository per URL klonen
- Git-Status anzeigen
- Changed / Staged / Untracked / Conflicts
- Diff anzeigen
- Datei stage/unstage
- Hunk stage/unstage
- Discard mit Warnung
- Commit Message
- Commit
- Amend Commit
- Branch anzeigen
- Branch wechseln
- Branch erstellen/löschen
- Pull / Push / Fetch / Sync
- Remote anzeigen
- Git Output / Fehler anzeigen
GitHub darf rein
- GitHub Login
- Remote zu GitHub-Repo erkennen
- GitHub-Repositories des eingeloggten Users anzeigen
- GitHub-Repositories durchsuchen/filtern
- Direkt von GitHub klonen
- Lokalen Ordner als neues GitHub-Repository veröffentlichen
- Publish nach GitHub mit Auswahl private/public
- Nach Publish Remote automatisch setzen
- PR erstellen
- PR öffnen
- PR Status / Checks anzeigen
- Review-Kommentare anzeigen
- Issue-Nummer aus Branch/Commit erkennen

Repo-Einstieg muss sehr gut sein

Wenn kein Git-Repo offen ist:
- Klar anzeigen: Der Ordner ist noch kein Git-Repository.
- Aktion anbieten: Initialize Repository.
- Aktion anbieten: Publish to GitHub.

Wenn ein Repo geöffnet werden soll:
- Clone Repo als primäre Aktion.
- Eingabe für Repository-URL.
- Alternative Quelle: Clone from GitHub.
- Nach GitHub-Auth vorhandene Repositories des Users anzeigen.
- Repository-Liste mit Name, Owner, Beschreibung, Stars und Clone-URL.
- Suchfeld: Repository name (type to search).
- Auswahl klont direkt lokal.

Wenn ein lokaler Ordner zu GitHub soll:
- Publish to GitHub anbieten.
- Repository-Name vorschlagen.
- Sichtbarkeit wählen: private oder public.
- GitHub-Repo erstellen.
- origin setzen.
- Initial Push ausführen.
- Danach normaler Source-Control-Zustand.

UI-Referenz aus Cursor/VS Code

Der Look darf sich klar am Source-Control-Panel orientieren:
- Changes-Bereich
- Commit-Message-Feld
- Commit-Button mit Dropdown für Varianten
- kleine Toolbar für View/Refresh/More
- Branch/Sync-Anzeige
- Graph-/History-Bereich
- Fehler-/Output-Bereich

Wichtig:
- Graph/History ist erlaubt, weil es Git-Zustand sichtbar macht.
- Agent Review aus Cursor ist höchstens Referenz für einen separaten, einklappbaren Statusbereich.
- Kein eigener Agent-Workflow im Produkt.
GitHub sollte nicht ausarten

Nicht:

- Issue Board
- Projektmanagement
- Kanban
- Notifications-Zentrale
- Actions-Dashboard Deluxe
- Wiki
- Discussions

Sonst wieder: „Wir wollten einen Schraubendreher und haben Jira gebaut.“

Architektur dadurch viel einfacher

Du brauchst keine App-Plattform für alles. Nur:

UI:
- Source-Control-ähnliche Sidebar
- Diff-Fläche
- Commit-Bereich
- Branch/Sync-Leiste

Backend:
- Git CLI Wrapper
- GitHub API
- Dateiwatcher

Mehr nicht.

Sehr gute Regel für später

Jedes neue Feature muss diese Frage bestehen:

Hilft es direkt beim Anzeigen, Prüfen oder Ausführen eines Git/GitHub-Versionskontrollschritts?

Wenn nein: raus.

Beispiele:

Feature	Entscheidung
PR erstellen	ja
Commit-History anzeigen	ja
Datei bearbeiten	nein
Terminal öffnen	nein
Test ausführen	nein
GitHub Check-Ergebnis öffnen	ja
Issue-Kanban	nein
Markdown Preview	nein
AI Commit Message	kritisch, optional über externen Codex-Aufruf
Codex-Run starten	eher nein, höchstens Link/Übergabe

Finale Definition

Das Tool ist kein Editor und kein Agent.

Es ist:

Eine eigenständige, minimalistische Git/GitHub-Oberfläche im Stil des Cursor/VS-Code Source-Control-Panels.

Und sein einziger Zweck:

Cursor nur für Git ersetzen.
