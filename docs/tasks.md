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

## Planungsnotiz

Stand 2026-06-03: Die vorherigen Sammelaufgaben `T1` bis `T10` wurden in kleinere, umsetzbare Aufgaben aufgeteilt. Der Inhalt der Sammelaufgaben ist in den folgenden Tasks erhalten; die Sammelaufgaben wurden entfernt, damit Implementierung und Review nicht gegen zu grosse Akzeptanzkriterien laufen.

Stand 2026-06-03: Die zu breiten Aufgaben `T22` und `T27` wurden durch kleinere Todo-Aufgaben ersetzt. GitHub PR/Checks/Kommentare sind jetzt in `T28` bis `T30` getrennt; Merge/Rebase ist in Scope-Entscheidung `T31` und optionale Umsetzung `T32` getrennt.

## Aufgaben

### T1 - Produktquelle und Scope-Gates festziehen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: -
- Definition of Done: README oder ein Architektur-Startdokument verweist klar auf `docs/plan.md` als Produktquelle; Nicht-Ziele wie Editor, Terminal, Agent, Workspaces, GitLab/Bitbucket und Force Push sind in einem Scope-Gate dokumentiert; neue Features muessen am Git/GitHub-Versionskontroll-Gate gemessen werden.
- Implementierungsnotiz: Keine Produktentscheidungen neu erfinden. Die Regeln aus `docs/plan.md` Abschnitt 2, 3, 8, 9 und 12 uebernehmen.
- Notiz: README verweist jetzt auf `docs/plan.md` als verbindliche Produktquelle; `docs/scope-gates.md` dokumentiert Git/GitHub-Versionskontroll-Gate, Nicht-Ziele, Backend-Scope und Sicherheitsregeln.
- Review-Ergebnis: Bestanden am 2026-06-03. README verweist klar auf `docs/plan.md`; `docs/scope-gates.md` dokumentiert Git/GitHub-Gate, Nicht-Ziele, Backend-Scope und Sicherheitsregeln gemaess Produktplan.
- Offene Review-Punkte: -

### T2 - Architektur-Startdokument fuer Kernkomponenten anlegen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T1`
- Definition of Done: Ein technisches Startdokument benennt UI-Schichten, Git CLI Wrapper, GitHub API Client, Dateiwatcher, lokalen State Store und Auth/Token-Verwaltung; es beschreibt pro Komponente Verantwortung, erlaubte Eingaben, Fehlerausgaben und ausgeschlossene Funktionen.
- Implementierungsnotiz: Architektur bleibt eng auf Source-Control-Funktionen. Keine Plugin-Plattform, kein Terminal, kein freier Command Runner.
- Notiz: `docs/architecture.md` beschreibt UI-Schichten, Repository-Kontext, Git Wrapper, Operation Queue, GitHub Client, Dateiwatcher, lokalen State Store sowie Auth/Token-Verwaltung mit Eingaben, Fehlern und ausgeschlossenen Funktionen.
- Review-Ergebnis: Bestanden am 2026-06-03. `docs/architecture.md` benennt die geforderten UI- und Backend-Komponenten und beschreibt jeweils Verantwortung, erlaubte Eingaben, Fehlerausgaben und ausgeschlossene Funktionen.
- Offene Review-Punkte: -

### T3 - Repository-Kontextmodell definieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`
- Definition of Done: Ein Repository-Kontextmodell ist dokumentiert oder typisiert und enthaelt Pfad, Anzeigenamen, Git-Status, Branch, Remote, Upstream, ahead/behind, laufende Operationen, Fehlerzustand und GitHub-Verknuepfung; mehrere Kontexte koennen ohne globale Vermischung existieren.
- Implementierungsnotiz: Jeder Tab repraesentiert genau einen Repository-Kontext. Keine Workspaces modellieren.
- Notiz: `docs/repository-context-model.md` dokumentiert ein typisiertes RepositoryContext-Modell mit Pfad, Anzeigenamen, Git-Zustand, Branch, Remote, Upstream, ahead/behind, laufenden Operationen, Fehlern, GitHub-Verknuepfung und Isolationsregeln pro Tab.
- Review-Ergebnis: Bestanden am 2026-06-03. `docs/repository-context-model.md` enthaelt das geforderte RepositoryContext-Modell mit Pfad, Anzeigenamen, Git-Zustand, Branch, Remote, Upstream, ahead/behind, Operationen, Fehlern, GitHub-Verknuepfung und expliziten Regeln gegen globale Vermischung mehrerer Tabs.
- Offene Review-Punkte: -

### T4 - App-Shell und Projektauswahl bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T3`
- Definition of Done: Startoberflaeche zeigt dauerhaft gespeicherte zuletzt geoeffnete Repositories sowie Aktionen fuer Repo oeffnen, Clone Repo, Clone from GitHub und Publish to GitHub; ausgewaehlte Repositories werden in Tabs geoeffnet; leere und fehlerhafte Startzustaende sind sichtbar.
- Implementierungsnotiz: Projektauswahl klein halten. Sie ist Einstieg in Git-Kontexte, kein Dashboard und keine Projektverwaltung. Zuletzt geoeffnete Repositories im lokalen State Store speichern und ungueltige Pfade verstaendlich behandeln.
- Notiz: Statische App-Shell in `index.html`, `src/styles.css` und `src/main.js` angelegt: Recent Repositories werden in localStorage persistiert, Open/Clone/GitHub-Clone/Publish-Einstiege validieren Eingaben, ausgewaehlte Repositories oeffnen als Tabs, leere und fehlerhafte Startzustaende sind sichtbar.
- Review-Ergebnis: Bestanden am 2026-06-03. App-Shell, Recent-Repositories-Persistenz, Open/Clone/GitHub-Clone/Publish-Einstiege, Tab-Oeffnung sowie leere und fehlerhafte Startzustaende sind im statischen UI umgesetzt.
- Offene Review-Punkte: -

### T5 - Repo-Tabs mit isolierten Kontexten umsetzen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T3`, `T4`
- Definition of Done: Mehrere Repositories koennen parallel in Tabs geoeffnet werden; Tab-Wechsel zeigt den richtigen Repository-Zustand; laufende Operationen und Fehler bleiben je Repository isoliert; Schliessen eines Tabs entfernt nur dessen Kontext.
- Implementierungsnotiz: Keine globalen Singletons fuer aktives Repo verwenden, wenn sie Tab-Isolation verhindern.
- Notiz: `src/main.js` nutzt jetzt pro Tab ein explizites RepositoryContext-Objekt mit eigener Git-, GitHub-, Operation-, Fehler- und Refresh-Struktur; Tab-Wechsel, erneutes Oeffnen und Schliessen arbeiten auf dieser Kontext-ID, und die Workspace-Ansicht rendert den aktiven Kontext inklusive isolierter Operation-/Fehlerfelder.
- Review-Ergebnis: Bestanden am 2026-06-03. Mehrere Tabs werden ueber eigene RepositoryContext-Objekte verwaltet; aktiver Zustand, laufende/queued Operationen, Fehlerfelder und Schliessen bleiben auf die jeweilige Kontext-ID begrenzt.
- Offene Review-Punkte: -

### T6 - Git CLI Wrapper Basisschicht implementieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`
- Definition of Done: Git-Kommandos laufen ueber einen whitelisted Wrapper; stdout, stderr, Exit-Code und strukturierte Fehler werden getrennt erfasst; Argumente werden strukturiert uebergeben; freie Shell-Kommandos sind fuer die UI nicht verfuegbar.
- Implementierungsnotiz: Wrapper mindestens fuer `status`, `diff`, `add`, `restore`, `commit`, `branch`, `switch`, `fetch`, `pull`, `push`, `remote`, `clone`, `init`, `log` und `stash` vorbereiten.
- Notiz: `src/git-cli-wrapper.js` kapselt Git-Ausfuehrung ueber eine Whitelist und strukturierte Options-Builder fuer die geforderten Basisaktionen; stdout, stderr, Exit-Code und normalisierte Fehler werden getrennt geliefert, Force Push wird am Wrapper abgewiesen, und `tests/git-cli-wrapper.test.js` prueft Whitelist, Argumentbau, Ablehnungen und einen Git-Init/Status-Lauf.
- Review-Ergebnis: Bestanden am 2026-06-03. Whitelist, strukturierte Argumentbildung, getrennte Ergebnisfelder, normalisierte Fehler, Force-Push-Ablehnung und Git-Init/Status-Lauf sind per Code-Review und fokussiertem Node-Check abgedeckt.
- Offene Review-Punkte: -

### T7 - Git Operation Queue pro Repository implementieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T3`, `T6`
- Definition of Done: Git-Operationen werden pro Repository kontrolliert serialisiert; parallele Operationen in verschiedenen Repositories bleiben moeglich; laufende, erfolgreiche, fehlgeschlagene und abgebrochene Operationen sind im State unterscheidbar.
- Implementierungsnotiz: Lange Operationen sollen abbrechbar vorbereitet werden. Queue darf Status-Refreshes nicht dauerhaft verhungern lassen.
- Notiz: `src/git-operation-queue.js` fuehrt eine per-Repository serialisierte Queue mit paralleler Ausfuehrung verschiedener Repositories, AbortController-Unterstuetzung, Snapshots fuer queued/running/completed/lastCompleted und Refresh-Priorisierung ein; `src/main.js` nutzt kompatible Operation-Statusfelder fuer vorbereitete Clone/Init-Einstiege.
- Review-Ergebnis: Bestanden am 2026-06-03. `src/git-operation-queue.js` serialisiert Operationen pro Repository, erlaubt parallele Ausfuehrung verschiedener Repositories, unterscheidet queued/running/succeeded/failed/aborted im Snapshot und priorisiert Refresh-Operationen; die Queue-Tests bestanden im fokussierten Node-Check.
- Offene Review-Punkte: -

### T8 - Repository-Erkennung und Git-Zustandsmodell umsetzen

- Status: `review`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T7`
- Definition of Done: App erkennt kein Ordner offen, Ordner ohne Git, normales Git-Repo, Repo mit Remote, GitHub-Remote, GitHub-authentifiziert, Operation laeuft, Konflikt und Fehler; Branch, Upstream, ahead/behind, staged, unstaged, untracked und conflicted Dateien werden geladen.
- Implementierungsnotiz: Zustaende explizit modellieren, nicht aus verstreuten UI-Flags ableiten.
- Notiz: Review-Punkt adressiert: `src/main.js` loest `loadRepositoryState` defensiv ueber Runtime-Bridge/CommonJS auf, laedt beim Oeffnen und erneuten Oeffnen eines Repository-Tabs echten Git-/GitHub-Zustand und rendert Branch, Upstream, ahead/behind, Remote, GitHub-Link, Change-Buckets, Fehler und Refresh-Status aus dem Repository-Kontext.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T9 - Dateiwatcher und entprellten Status-Refresh bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T7`, `T8`
- Definition of Done: Datei- und Git-Index-Aenderungen aktualisieren den Repository-Zustand automatisch; Events werden entprellt; Status wird nicht bei jedem Event blind neu geladen; Refresh-Konflikte mit laufenden Git-Operationen sind geregelt.
- Implementierungsnotiz: Watcher soll Branch-Wechsel, Index-Aenderungen und normale Dateiaenderungen abdecken.
- Notiz: `src/repository-status-watcher.js` ergaenzt einen pro Repository startbaren Dateiwatcher mit Worktree- und `.git`-Metadaten-Zielen, Event-Klassifizierung, entprelltem Refresh via `loadRepositoryState`, Ignorieren irrelevanter Events und Verschieben von Refreshes waehrend laufender Git-Operationen; `tests/repository-status-watcher.test.js` prueft Debounce, Branch-/Index-Events, Busy-Deferral und verlinkte Gitdir-Pfade.
- Review-Ergebnis: Zurueckgestellt am 2026-06-03. Der Watcher ist als Modul mit Debounce-, Git-Metadaten- und Busy-Deferral-Tests vorhanden; die fokussierten Node-Tests bestehen mit Preserve-Symlink-Flags. Blocking bleibt, dass der Watcher in der App nicht gestartet wird.
- Offene Review-Punkte: `RepositoryStatusWatcher` wird ausserhalb der Tests nicht instanziiert und `src/main.js` verdrahtet keine `onState`-Aktualisierung pro Repository-Tab. Datei- oder Git-Index-Aenderungen koennen den sichtbaren Repository-Zustand der App deshalb noch nicht automatisch aktualisieren.

### T10 - Source-Control-Listen fuer Changes bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T8`
- Definition of Done: UI zeigt Changed, Staged, Untracked und Conflicts getrennt; jede Datei zeigt Pfad, Statussymbol und Aenderungstyp; Auswahl einer Datei oeffnet den passenden Diff- oder Konfliktzustand.
- Implementierungsnotiz: Keine Projektbaum-Navigation bauen. Nur geaenderte Dateien und Git-Kontext anzeigen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T11 - Datei-Diff-Ansicht implementieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T10`
- Definition of Done: Ausgewaehlte Dateien zeigen einen lesbaren unified Diff; staged und unstaged Diffs sind unterscheidbar; Binary-, geloeschte, neue und umbenannte Dateien haben klare Ersatz- oder Fehlerzustaende; die Ansicht bietet keine Datei-Bearbeitung.
- Implementierungsnotiz: Side-by-side Diff ist optional spaeter. Fuer das erste Review reicht ein robuster unified Diff.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T12 - Datei-Staging, Unstaging und Discard umsetzen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T10`, `T11`
- Definition of Done: Datei stage, unstage und discard funktionieren fuer passende Git-Zustaende; Discard zeigt eine bestaetigte Warnung; Fehler aus Git werden lesbar im UI und im Git Output angezeigt.
- Implementierungsnotiz: Discard muss klar machen, dass lokale Aenderungen verloren gehen koennen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T13 - Hunk-Staging und Hunk-Unstaging implementieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T11`, `T12`
- Definition of Done: Einzelne Hunks koennen staged und unstaged werden; veraltete Diffs, Whitespace-Probleme und nicht anwendbare Patches werden erkannt und verstaendlich angezeigt; nach erfolgreicher Aktion wird der Status konsistent aktualisiert.
- Implementierungsnotiz: Patch-Anwendung robust kapseln. Keine stillen Teil-Erfolge ohne sichtbaren Status.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T14 - Commit- und Amend-Flow bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T10`, `T12`
- Definition of Done: Commit Message, normaler Commit, Commit staged changes und Amend Commit sind bedienbar; Commit-Button ist nur aktiv, wenn Commit moeglich ist; Commit-Varianten sind ueber ein Dropdown erreichbar; fehlende Message, leeres Staging und Git-Fehler werden nahe am Commit-Bereich angezeigt; Amend ist sichtbar als history-aendernde Aktion markiert; UI laesst spaeteren Generierungsflow fuer leere Commit Message zu.
- Implementierungsnotiz: Codex-Commit-UI als Referenz nehmen: Commit-Message-Feld prominent, klare Primaeraktion und Dropdown fuer Varianten. Optionaler Hinweis "leer lassen zum Generieren" erst wenn AI Commit Message entschieden ist. Keine AI Commit Message in diesem Task.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T15 - Branch-Anzeige und Branch-Aktionen bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`
- Definition of Done: Aktueller Branch, Upstream und ahead/behind sind sichtbar; Branch erstellen, wechseln und loeschen funktionieren; Remote-Branch auschecken ist abgedeckt; Branch loeschen warnt, wenn Git Risiko oder Fehler meldet.
- Implementierungsnotiz: Bei uncommitted changes keine eigene Git-Magie bauen. Git-Fehler lesbar anzeigen oder auf Stash-Flow verweisen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T16 - Fetch, Pull, Push, Sync und Publish Branch bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`, `T15`
- Definition of Done: Fetch, Pull, Push, Sync, Commit and Push und Publish Branch sind ueber UI-Aktionen oder Commit-Dropdown-Varianten ausfuehrbar; Fortschritt, Erfolg und Fehler sind sichtbar; Pull-Konflikte fuehren in den Konfliktzustand; Force Push wird nicht angeboten.
- Implementierungsnotiz: Codex-UI fuer Committen/Pushen ist eine gute Referenz. Sync und Commit and Push muessen transparent machen, welche Git-Schritte ausgefuehrt werden.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T17 - Stash-Basisfunktionen umsetzen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`, `T15`
- Definition of Done: Aenderungen stashen, Stash-Liste anzeigen, Stash anwenden, Stash loeschen und Stash mit kurzer Message anlegen funktionieren; Fehler und Konflikte beim Anwenden sind sichtbar; Stash bleibt Basisfunktion und wird nicht zum Backup-Manager.
- Implementierungsnotiz: Kein teilweise anwenden, kein komplexer Stash-Browser, kein Stash-Konflikt-Assistent.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T18 - GitHub Auth und API Client implementieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`
- Definition of Done: GitHub Login funktioniert; Token werden sicher gespeichert; Logout ist moeglich; User-Repositories koennen geladen und durchsucht werden; fehlende Berechtigungen und API-Fehler werden lesbar angezeigt.
- Implementierungsnotiz: GitHub + HTTPS priorisieren. Kein eigenes SSH-Key-Management bauen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T19 - Clone per URL und Clone from GitHub bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T18`, `T4`
- Definition of Done: Clone Repo per URL funktioniert mit frei waehlbarem Zielordner; Clone from GitHub zeigt durchsuchbare Repositories des eingeloggten Users mit Owner/Name, Beschreibung, Sichtbarkeit, Stars, Clone-URL und private/public Indikator, soweit GitHub diese Daten liefert; Clone-Fortschritt und Fehler sind sichtbar; erfolgreich geklonte Repositories werden automatisch als Tab geoeffnet.
- Implementierungsnotiz: HTTPS-, SSH- und GitHub-URLs akzeptieren. SSH nur nutzen, wenn lokales Git/SSH bereits funktioniert. Liste soll nach Repository-Name filterbar sein und die gewaehlte Clone-URL transparent machen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T20 - Publish to GitHub fuer lokale Ordner bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`, `T14`, `T18`
- Definition of Done: Lokaler Ordner oder lokales Git-Repo kann nach GitHub gepublished werden; Repository-Name wird vorgeschlagen; Beschreibung ist optional; private/public Auswahl ist vorhanden; origin wird gesetzt und initial push ausgefuehrt; vorhandene Remotes werden nicht still ueberschrieben.
- Implementierungsnotiz: Wenn noch kein Git-Repo existiert, `git init` explizit bestaetigen. Wenn keine Commits existieren, zum Commit-Flow fuehren.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T21 - Einklappbaren Graph/History-Bereich bauen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T6`, `T8`, `T11`
- Definition of Done: Einklappbarer Graph/History-Bereich zeigt Commit-History, aktuellen Branch, Remote-Branch, HEAD, Commit-Metadaten, Commit-Diff und lokale/remote Divergenz; Bereich bleibt optional sichtbar und verdraengt die Kern-Source-Control-UI nicht dauerhaft.
- Implementierungsnotiz: Kein Activity Feed, keine Analytics, kein Projektmanagement-Dashboard.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T23 - Git Output, Fehlertexte und Sicherheitswarnungen fertigstellen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T7`, `T12`, `T14`, `T15`, `T16`, `T20`
- Definition of Done: Git Output ist jederzeit erreichbar; GitHub- und Git-Fehler sind lesbar; gefaehrliche Aktionen haben bestaetigte Warnungen fuer Discard, Amend, Branch loeschen, Remote ueberschreiben und Public Publish; rohe Ausgaben bleiben einsehbar, sind aber nicht die einzige Nutzererklaerung.
- Implementierungsnotiz: Keine versteckten Automatismen wie Auto-Commit, Auto-Push oder Auto-Publish.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T24 - Kernflows testen und Review-Checkliste dokumentieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T8`, `T12`, `T13`, `T14`, `T16`, `T17`, `T18`, `T19`, `T20`, `T23`, `T28`, `T29`, `T30`
- Definition of Done: Automatisierte oder manuelle Repro-Schritte decken Repo ohne Git, Git init, Clone, Publish, Status, Diff, Datei- und Hunk-Staging, Commit, Amend, Branch-Wechsel, Pull/Push-Fehler, Stash, GitHub Auth-Fehler und PR/Checks ab; ausgeschlossene Features wie Editor, Terminal, Force Push und Workspaces sind in Tests oder Architekturentscheidungen abgesichert.
- Implementierungsnotiz: Testabdeckung nach Risiko waehlen. Falls ein Flow nur manuell pruefbar ist, klare Schritte und erwartetes Ergebnis dokumentieren.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T25 - AI Commit Message Konzept ausarbeiten

- Status: `todo`
- Prioritaet: `P3`
- Abhaengigkeiten: `T14`
- Definition of Done: Produktentscheidung fuer AI Commit Message ist dokumentiert; entschieden ist, ob ein leeres Commit-Message-Feld direkt eine Message generiert oder zuerst bestaetigt; Datenbasis, Datenschutz, Kosten, Fehlerfaelle und UI-Grenzen sind beschrieben.
- Implementierungsnotiz: Codex-Verhalten als Referenz: Wenn Commit Message leer bleibt, kann eine Message generiert werden. Feature darf kein AI Chat, kein Agent-Loop und kein autonomer Commit werden; Nutzer muss Vorschlag pruefen und Commit selbst ausloesen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T26 - Source-Control-Toolbar und View Modes bauen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T9`, `T10`, `T11`, `T16`
- Definition of Done: Source-Control-Bereich hat kompakte Toolbar-Aktionen fuer Refresh, View Mode, Commit/Checkmark, Source-Control-Aktionen und More Menu; View Mode beeinflusst die Changes-/Diff-Darstellung nachvollziehbar; Refresh nutzt den entprellten Status-Refresh; More Menu enthaelt nur erlaubte Git/GitHub-Aktionen.
- Implementierungsnotiz: Toolbar an Cursor/VS-Code-Source-Control orientieren, aber keine Projektbaum-, Terminal-, Task-Runner- oder Dashboard-Aktionen aufnehmen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T28 - GitHub Remote-Erkennung und PR-Erstellung bauen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T16`, `T18`
- Definition of Done: GitHub-Remote wird aus den Git-Remotes des aktiven Repository-Kontexts erkannt; vorhandene PR fuer den aktuellen Branch wird angezeigt oder verlinkt; neue PR kann mit Base-Branch, Titel und Beschreibung erstellt werden; PR im Browser oder GitHub-UI kann geoeffnet werden; fehlende Auth, fehlende Remote-Zuordnung und API-Fehler werden lesbar angezeigt.
- Implementierungsnotiz: GitHub-Funktionen bleiben auf Versionskontrolle begrenzt. Kein Issue Board, kein Kanban, keine Notifications-Zentrale und kein allgemeines GitHub-Dashboard.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T29 - GitHub PR-Status und Checks anzeigen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T28`
- Definition of Done: Fuer erkannte oder erstellte PRs werden PR-Status, Checks, Check-Ergebnisse und Links zu den Detailseiten angezeigt; laufende, erfolgreiche, fehlgeschlagene und unbekannte Check-Zustaende sind unterscheidbar; Rate-Limit-, Berechtigungs- und Netzwerkfehler werden lesbar angezeigt.
- Implementierungsnotiz: Checks nur anzeigen und oeffnen. Kein Actions-Dashboard Deluxe, keine Workflow-Steuerung und keine CI-Logs als eigenes Produktmodul.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T30 - GitHub Review-Kommentare und Issue-Links anzeigen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T28`
- Definition of Done: Review-Kommentare der erkannten PR werden angezeigt oder zur GitHub-Ansicht verlinkt; Issue-Nummern aus Branch-Namen und Commit-Messages werden erkannt und als GitHub-Links angeboten; nicht gefundene Issues, fehlende Berechtigungen und API-Fehler werden verstaendlich behandelt.
- Implementierungsnotiz: Nur Verknuepfung und Anzeige fuer Versionskontrolle. Keine Issue-Verwaltung, keine Discussions, keine Wiki-Funktionen und keine Notifications-Zentrale.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T31 - Merge/Rebase-Basisumfang entscheiden

- Status: `todo`
- Prioritaet: `P3`
- Abhaengigkeiten: `T1`
- Definition of Done: Produktentscheidung ist dokumentiert, ob Merge und/oder Rebase Teil des ersten Produktziels bleiben oder explizit in spaeteren Scope verschoben werden; Entscheidung benennt erlaubte Aktionen, ausgeschlossene History-Rewrite-Faelle, erforderliche Warnungen, Konfliktverhalten und Git-Output-Anforderungen; `docs/plan.md` und `docs/scope-gates.md` sind bei Scope-Aenderung konsistent.
- Implementierungsnotiz: Erst entscheiden, dann bauen. Kein interaktives Rebase, kein History-Rewrite-Wizard und kein komplexes Cherry-Pick-UI.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T32 - Merge-Basisfunktion umsetzen

- Status: `todo`
- Prioritaet: `P3`
- Abhaengigkeiten: `T6`, `T8`, `T15`, `T16`, `T23`, `T31`
- Definition of Done: Falls `T31` Merge fuer den ersten Produktumfang freigibt, kann der aktuelle Branch mit einem ausgewaehlten Branch gemerged werden; Fortschritt, Erfolg, Git-Fehler, Konfliktzustand und Git Output sind sichtbar; bei uncommitted changes oder Git-Konflikten wird kein Terminal vorausgesetzt; falls `T31` Merge verschiebt, wird dieser Task entsprechend als nicht mehr im ersten Umfang markiert.
- Implementierungsnotiz: Rebase nur in einem separaten spaeteren Task planen, wenn `T31` es ausdruecklich freigibt und Fehler-, Warn- und Abbruchfaelle sauber bedienbar sind.
- Review-Ergebnis: -
- Offene Review-Punkte: -
