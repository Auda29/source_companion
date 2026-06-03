# Tasks

Arbeitsliste fuer die naechsten Schritte im Repo. Statuswerte: `todo`, `review`, `done`, `blocked`.

Prioritaeten: `P1` = hoch / blockierend, `P2` = normal, `P3` = niedrig.

## Status-Workflow

Wenn ein Task von einem Agenten oder manuell bearbeitet wird, gilt eine strikte Status-Reihenfolge:

`todo` -> `review` -> `todo` oder `done`

- `todo`: Task ist offen oder nach Review wieder zurueckgestellt.
- `review`: Umsetzung ist fertig und wartet auf Pruefung.
- `done`: Task ist geprueft und abgeschlossen.
- `blocked`: Task ist bei Erstellung bereits blockiert und darf nur dann als Startstatus gesetzt werden.

## Aufgaben

### T1 - Produkt- und Architekturgrundlage finalisieren

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: Repo enthaelt eine klare technische Startstruktur fuer Source Companion; `docs/plan.md` ist als Produktquelle referenziert; Nicht-Ziele wie Editor, Terminal, Agent, Workspaces, GitLab/Bitbucket und Force Push sind technisch sichtbar abgegrenzt.
- Implementierungsnotiz: Projektstruktur, README und Architektur-Startdokument anlegen oder aktualisieren. Architektur muss Git CLI Wrapper, GitHub API Client, Dateiwatcher, lokalen State Store und UI-Schichten benennen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T2 - App-Shell mit Repo-Tabs und Projektauswahl bauen

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: App zeigt eine produktive Startoberflaeche mit zuletzt geoeffneten Repositories, Repo oeffnen, Clone Repo, Clone from GitHub und Publish to GitHub; mehrere Repositories koennen parallel in Tabs geoeffnet werden.
- Implementierungsnotiz: Jeder Tab ist ein isolierter Repository-Kontext mit eigenem Pfad, Git-Status, Branch, Remote-State, laufenden Operationen und Fehlerzustand. Keine Workspaces bauen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T3 - Git CLI Wrapper und Operation Queue implementieren

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: Git-Kommandos laufen ausschliesslich ueber einen whitelisted Wrapper; stdout, stderr, Exit-Code und strukturierte Fehler werden getrennt erfasst; konkurrierende Git-Operationen pro Repository werden kontrolliert serialisiert.
- Implementierungsnotiz: Wrapper fuer `status`, `diff`, `add`, `restore`, `commit`, `branch`, `switch`, `fetch`, `pull`, `push`, `remote`, `clone`, `init`, `log` und `stash` vorbereiten. Keine freien Shell-Kommandos in der UI erlauben.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T4 - Repository-Erkennung, Status und Dateiwatcher umsetzen

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: Source Companion erkennt Ordner ohne Git, normale Git-Repos, Remotes, Upstream, aktuellen Branch, ahead/behind, staged/unstaged/untracked/conflicted Dateien und aktualisiert den Zustand nach Datei- oder Git-Index-Aenderungen automatisch.
- Implementierungsnotiz: Dateiwatcher entprellen; Git-Status nicht bei jedem Event blind neu laden; explizite State-Zustaende fuer kein Ordner, kein Git-Repo, Git-Repo, GitHub-authentifiziert, Operation laeuft, Konflikt und Fehler modellieren.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T5 - Source-Control-UI fuer Changes, Diffs und Hunk-Staging bauen

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: UI zeigt Changed, Staged, Untracked und Conflicts; Datei-Diffs sind sichtbar; Datei stage/unstage und Hunk stage/unstage funktionieren; Discard ist nur mit Warnung moeglich.
- Implementierungsnotiz: Diff-Ansicht ohne Datei-Editor bauen. Hunk-Staging ueber robuste Patch-Anwendung umsetzen und Fehlerfaelle bei Whitespace, verschobenen Hunks und veraltetem Diff sichtbar machen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T6 - Commit-, Amend-, Branch-, Sync- und Stash-Flows implementieren

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: Commit Message, Commit, Amend Commit, Branch anzeigen/erstellen/loeschen/wechseln, Fetch, Pull, Push, Sync, Publish Branch und Stash-Basisfunktionen sind ueber die UI bedienbar.
- Implementierungsnotiz: Commit-Button nur aktivieren, wenn Commit moeglich ist. Amend, Branch loeschen, Discard und Public Publish klar warnen. Force Push nicht anbieten. Stash nur als Basisfunktion: stashen, Liste anzeigen, anwenden, loeschen, Message setzen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T7 - GitHub Auth, Clone from GitHub und Publish to GitHub bauen

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: GitHub Login funktioniert; Repositories des eingeloggten Users koennen angezeigt und durchsucht werden; Clone per URL und Clone from GitHub funktionieren mit frei waehlbarem Zielordner; lokales Repo kann als private oder public GitHub-Repo gepublished werden.
- Implementierungsnotiz: GitHub + HTTPS priorisieren. Kein eigenes SSH-Key-Management bauen. SSH-URLs nur nutzen, wenn lokales Git/SSH bereits funktioniert. Publish setzt `origin` und fuehrt initial push aus, ohne vorhandene Remotes still zu ueberschreiben.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T8 - Einklappbaren Graph/History-Bereich umsetzen

- Status: `todo`
- Prioritaet: `P2`
- Definition of Done: UI enthaelt einen einklappbaren Graph/History-Bereich mit Commit-History, aktuellem Branch, Remote-Branch, HEAD, Commit-Metadaten, Commit-Diff und sichtbarer lokaler/remote Divergenz.
- Implementierungsnotiz: Graph bleibt Git-Zustandsanzeige und darf kein allgemeines Dashboard werden. Keine Projektmanagement-, Activity-Feed- oder Analytics-Funktionen einbauen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T9 - GitHub PRs, Checks und Review-Kommentare integrieren

- Status: `todo`
- Prioritaet: `P2`
- Definition of Done: GitHub Remote wird erkannt; PRs koennen erstellt und geoeffnet werden; PR Status, Checks, Check-Ergebnisse, Review-Kommentare und erkannte Issue-Nummern aus Branch/Commit werden angezeigt oder verlinkt.
- Implementierungsnotiz: GitHub-Integration strikt auf Versionskontrolle begrenzen. Kein Issue Board, kein Kanban, keine Notifications-Zentrale, kein Actions-Dashboard Deluxe, keine Wiki- oder Discussions-Funktionen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T10 - Fehler-, Output-, Sicherheits- und Review-Abdeckung fertigstellen

- Status: `todo`
- Prioritaet: `P1`
- Definition of Done: Git Output ist jederzeit erreichbar; GitHub- und Git-Fehler sind lesbar; gefaehrliche Aktionen haben bestaetigte Warnungen; Kernflows sind automatisiert oder manuell reproduzierbar getestet; Produktgrenzen sind in Tests oder Architekturentscheidungen abgesichert.
- Implementierungsnotiz: Testfaelle fuer Repo ohne Git, Git init, Clone, Publish, Status, Diff, Hunk-Staging, Commit, Amend, Branch-Wechsel, Pull/Push-Fehler, Stash, GitHub Auth-Fehler und PR/Checks definieren. Keine Tests fuer ausgeschlossene Features wie Editor, Terminal, Force Push oder Workspaces bauen.
- Review-Ergebnis: -
- Offene Review-Punkte: -
