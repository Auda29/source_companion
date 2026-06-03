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

Stand 2026-06-03: Review-Fehler in `T12` als konkrete Akzeptanz ergaenzt: Discard muss bei gemischten Datei-Zustaenden wie `MM` den ausgewaehlten Bucket respektieren, damit Worktree-Discard nicht versehentlich staged Inhalt verliert. `T13` bleibt im Review, sollte aber erst nach dem `T12`-Fix final abgenommen werden.

Stand 2026-06-03: Die zu breite GitHub-Grundlagenaufgabe `T18` wurde durch `T37` und `T38` ersetzt, damit Auth-/Token-Speicherentscheidung und API-Implementierung getrennt reviewbar sind. Die gemischte Clone-Aufgabe `T19` wurde durch `T39` und `T40` ersetzt, damit URL-Clone nicht unnoetig von GitHub Auth blockiert wird.

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

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T7`
- Definition of Done: App erkennt kein Ordner offen, Ordner ohne Git, normales Git-Repo, Repo mit Remote, GitHub-Remote, GitHub-authentifiziert, Operation laeuft, Konflikt und Fehler; Branch, Upstream, ahead/behind, staged, unstaged, untracked und conflicted Dateien werden geladen.
- Implementierungsnotiz: Zustaende explizit modellieren, nicht aus verstreuten UI-Flags ableiten.
- Notiz: Review-Punkt adressiert: `src/main.js` loest `loadRepositoryState` defensiv ueber Runtime-Bridge/CommonJS auf, laedt beim Oeffnen und erneuten Oeffnen eines Repository-Tabs echten Git-/GitHub-Zustand und rendert Branch, Upstream, ahead/behind, Remote, GitHub-Link, Change-Buckets, Fehler und Refresh-Status aus dem Repository-Kontext.
- Review-Ergebnis: Bestanden am 2026-06-03. `loadRepositoryState` modelliert die geforderten Repository-Zustaende inklusive Branch, Upstream, ahead/behind, Remote/GitHub-Zuordnung, Operation-laeuft, Konflikt und Change-Buckets; `src/main.js` laedt diese Daten pro Tab ueber Runtime-Bridge/CommonJS und rendert die Metadaten aus dem Repository-Kontext. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T9 - Dateiwatcher und entprellten Status-Refresh bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T7`, `T8`
- Definition of Done: Datei- und Git-Index-Aenderungen aktualisieren den Repository-Zustand automatisch; Events werden entprellt; Status wird nicht bei jedem Event blind neu geladen; Refresh-Konflikte mit laufenden Git-Operationen sind geregelt.
- Implementierungsnotiz: Watcher soll Branch-Wechsel, Index-Aenderungen und normale Dateiaenderungen abdecken.
- Notiz: Review-Punkt adressiert: `src/main.js` instanziiert `RepositoryStatusWatcher` jetzt defensiv per Runtime-Bridge/CommonJS, startet pro Repository-Tab einen Watch-Handle, verdrahtet `onState` auf den isolierten Tab-Kontext und schliesst den Watcher beim Tab-Schliessen; bestehende Watcher- und State-Tests bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-03. `RepositoryStatusWatcher` ist jetzt in `src/main.js` pro Repository-Tab instanziiert, aktualisiert den isolierten Tab-Kontext ueber `onState`, wird beim Tab-Schliessen beendet und deckt Worktree-, Branch- und Index-Events mit Debounce sowie Busy-Deferral ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; die Browser-Gegenprobe war durch lokale Browser-Policy blockiert.
- Offene Review-Punkte: -

### T10 - Source-Control-Listen fuer Changes bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T8`
- Definition of Done: UI zeigt Changed, Staged, Untracked und Conflicts getrennt; jede Datei zeigt Pfad, Statussymbol und Aenderungstyp; Auswahl einer Datei oeffnet den passenden Diff- oder Konfliktzustand.
- Implementierungsnotiz: Keine Projektbaum-Navigation bauen. Nur geaenderte Dateien und Git-Kontext anzeigen.
- Notiz: `src/main.js` rendert jetzt pro Repository-Kontext getrennte Source-Control-Listen fuer Changed, Staged, Untracked und Conflicts; Eintraege zeigen Pfad, Statussymbol und Aenderungstyp, und die Auswahl oeffnet pro Tab einen Diff- oder Konfliktzustand. `src/styles.css` ergaenzt die kompakte Listen-/Detailansicht ohne Projektbaum.
- Review-Ergebnis: Bestanden am 2026-06-03. `src/main.js` rendert Changed, Staged, Untracked und Conflicts getrennt aus dem Repository-Kontext; Dateieintraege zeigen Pfad, Statussymbol und Aenderungstyp, und die Auswahl fuehrt je nach Bucket in Diff- oder Konfliktzustand. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T11 - Datei-Diff-Ansicht implementieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T10`
- Definition of Done: Ausgewaehlte Dateien zeigen einen lesbaren unified Diff; staged und unstaged Diffs sind unterscheidbar; Binary-, geloeschte, neue und umbenannte Dateien haben klare Ersatz- oder Fehlerzustaende; die Ansicht bietet keine Datei-Bearbeitung.
- Implementierungsnotiz: Side-by-side Diff ist optional spaeter. Fuer das erste Review reicht ein robuster unified Diff.
- Notiz: `src/repository-diff.js` laedt staged und unstaged Unified-Diffs ueber den Git Wrapper; `src/main.js` rendert die ausgewaehlte Datei mit Loading-, Fehler-, Binary-, Untracked- und Conflict-Ersatzstaenden sowie farbiger read-only Unified-Diff-Ansicht. `tests/repository-diff.test.js` deckt Routing, Ersatzstaende und einen echten Git-Diff-Lauf ab.
- Review-Ergebnis: Bestanden am 2026-06-03. `src/repository-diff.js` laedt staged und unstaged Unified-Diffs unterscheidbar ueber den Git Wrapper und liefert klare Ersatz-/Fehlerzustaende fuer untracked, conflict, binary und leere Diff-Faelle; `src/main.js` rendert die read-only Diff-Ansicht mit Loading- und Fehlerzustaenden. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; der Browser-Smoke-Check war durch die lokale Browser-URL-Policy fuer `file://` blockiert.
- Offene Review-Punkte: -

### T12 - Datei-Staging, Unstaging und Discard umsetzen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T10`, `T11`
- Definition of Done: Datei stage, unstage und discard funktionieren fuer passende Git-Zustaende; Discard zeigt eine bestaetigte Warnung; Fehler aus Git werden lesbar im UI und im Git Output angezeigt; gemischte staged/unstaged Zustaende wie `MM` und `AM` sind abgedeckt, wobei Discard aus `Changed` nur Worktree-Aenderungen verwirft und den staged Index-Inhalt erhaelt.
- Implementierungsnotiz: Discard muss klar machen, dass lokale Aenderungen verloren gehen koennen. Die Aktion muss am ausgewaehlten Bucket haengen, nicht nur an `file.staged`/`file.unstaged`; fuer `Changed` bevorzugt Worktree-Discard, fuer `Staged` explizit Staged-Discard.
- Notiz: Review-Punkt adressiert: Discard aus dem `Changed`/unstaged Bucket priorisiert jetzt den ausgewaehlten Bucket und fuehrt fuer gemischte Zustaende wie `MM` ein Worktree-only `git restore --worktree -- <path>` aus, sodass staged Index-Inhalt erhalten bleibt. `tests/repository-file-actions.test.js` enthaelt eine Regression mit echter `MM`-Datei; fokussierter Node-Test bestand mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-03. Datei-Stage, -Unstage und -Discard sind ueber den whitelisted Git Wrapper gekapselt, Fehler und Git Output werden in der UI sichtbar, Discard wird bestaetigt, und die Regression fuer gemischte `MM`-Zustaende bewahrt beim Discard aus `Changed` den staged Index-Inhalt. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; der Browser-Smoke-Check war durch lokale `file://`-Policy blockiert.
- Offene Review-Punkte: -

### T13 - Hunk-Staging und Hunk-Unstaging implementieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T11`, `T12`
- Definition of Done: Einzelne Hunks koennen staged und unstaged werden; veraltete Diffs, Whitespace-Probleme und nicht anwendbare Patches werden erkannt und verstaendlich angezeigt; nach erfolgreicher Aktion wird der Status konsistent aktualisiert.
- Implementierungsnotiz: Patch-Anwendung robust kapseln. Keine stillen Teil-Erfolge ohne sichtbaren Status.
- Notiz: `src/repository-hunk-actions.js` kapselt einzelnes Hunk-Staging/-Unstaging ueber `git apply --cached` mit vorgeschaltetem `--check` und Whitespace-Fehlererkennung; `src/main.js` zeigt Stage/Unstage-Hunk-Aktionen fuer ready staged/unstaged Diffs, schreibt Ergebnisse in Git Output und aktualisiert den Repository-Status nach Erfolg. `tests/repository-hunk-actions.test.js` deckt Hunk-Patch-Bau, stale/ungueltige Hunks und einen echten Stage/Unstage-Hunk-Lauf ab.
- Review-Abhaengigkeit: Finales Review erst nach `T12`-Fix abschliessen; danach Hunk Stage/Unstage mit einer Datei pruefen, die gleichzeitig staged und unstaged Aenderungen hat.
- Review-Ergebnis: Bestanden am 2026-06-03. Einzelne Hunks werden fuer unstaged und staged Diffs ueber `git apply --cached` mit vorgeschaltetem `--check` verarbeitet; stale, ungueltige und Whitespace-fehlerhafte Patches liefern lesbare Fehler, erfolgreiche Aktionen aktualisieren den Repository-Status, und der reale Hunk-Test deckt eine Datei mit gleichzeitig staged und unstaged Aenderungen ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; der Browser-Smoke-Check war durch lokale `file://`-Policy blockiert.
- Offene Review-Punkte: -

### T14 - Commit- und Amend-Flow bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T10`, `T12`
- Definition of Done: Commit Message, normaler Commit, Commit staged changes und Amend Commit sind bedienbar; Commit-Button ist nur aktiv, wenn Commit moeglich ist; Commit-Varianten sind ueber ein Dropdown erreichbar; fehlende Message, leeres Staging und Git-Fehler werden nahe am Commit-Bereich angezeigt; Amend ist sichtbar als history-aendernde Aktion markiert; UI laesst spaeteren Generierungsflow fuer leere Commit Message zu.
- Implementierungsnotiz: Codex-Commit-UI als Referenz nehmen: Commit-Message-Feld prominent, klare Primaeraktion und Dropdown fuer Varianten. Optionaler Hinweis "leer lassen zum Generieren" erst wenn AI Commit Message entschieden ist. Keine AI Commit Message in diesem Task.
- Notiz: `src/repository-commit-actions.js` kapselt Commit, Commit staged changes und Amend Commit ueber den Git Wrapper mit Message-/Staging-Validierung und lesbaren Git-Fehlern; `src/main.js` rendert pro Repository-Tab einen Commit-Bereich mit Message-Feld, deaktivierter Primaeraktion bis Commit moeglich ist, Varianten-Dropdown, Amend-Warnung, Inline-Status, Git Output und Refresh nach Erfolg. `tests/repository-commit-actions.test.js` deckt Validierung, strukturierten Command-Bau sowie echten Commit- und Amend-Lauf ab.
- Review-Ergebnis: Bestanden am 2026-06-03. Commit Message, normaler Commit, Commit staged changes und Amend sind im UI bedienbar; Primaeraktion und Varianten validieren Message, Staging und Konfliktzustand, Amend ist als history-aendernde Aktion bestaetigungspflichtig markiert, Git-Fehler/Git Output werden sichtbar, und die echten Commit-/Amend-Tests bestanden.
- Offene Review-Punkte: -

### T15 - Branch-Anzeige und Branch-Aktionen bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`
- Definition of Done: Aktueller Branch, Upstream und ahead/behind sind sichtbar; Branch erstellen, wechseln und loeschen funktionieren; Remote-Branch auschecken ist abgedeckt; Branch loeschen warnt, wenn Git Risiko oder Fehler meldet.
- Implementierungsnotiz: Bei uncommitted changes keine eigene Git-Magie bauen. Git-Fehler lesbar anzeigen oder auf Stash-Flow verweisen.
- Notiz: `src/repository-branch-actions.js` kapselt Branch erstellen, wechseln, sicher loeschen und Remote-Branch-Checkout ueber den Git Wrapper; `src/main.js` zeigt einen Branch-Bereich mit aktuellem Branch, Upstream, ahead/behind und den Branch-Aktionen inklusive Delete-Warnung, lesbarem Status, Git Output und Refresh nach Erfolg. `tests/repository-branch-actions.test.js` deckt strukturierte Commands, Validierung und echte Git-Laeufe inklusive Remote-Checkout ab.
- Review-Ergebnis: Bestanden am 2026-06-03. Branch, Upstream und ahead/behind werden angezeigt; Branch erstellen, wechseln, sicher loeschen und Remote-Branch-Checkout laufen ueber den whitelisted Git Wrapper mit Warnung und lesbaren Fehlern. Fokussierte Branch-/Wrapper-Tests und die vollstaendige Node-Test-Suite bestanden.
- Offene Review-Punkte: -

### T16 - Fetch, Pull, Push, Sync und Publish Branch bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`, `T15`
- Definition of Done: Fetch, Pull, Push, Sync, Commit and Push und Publish Branch sind ueber UI-Aktionen oder Commit-Dropdown-Varianten ausfuehrbar; Fortschritt, Erfolg und Fehler sind sichtbar; Pull-Konflikte fuehren in den Konfliktzustand; Force Push wird nicht angeboten.
- Implementierungsnotiz: Codex-UI fuer Committen/Pushen ist eine gute Referenz. Sync und Commit and Push muessen transparent machen, welche Git-Schritte ausgefuehrt werden.
- Notiz: `src/repository-sync-actions.js` kapselt Fetch, Pull, Push, Sync, Commit and Push und Publish Branch ueber den whitelisted Git Wrapper; `src/main.js` zeigt Remote-Sync-Aktionen plus Commit-and-Push im Commit-Dropdown mit Status, Git Output und Refresh nach Ausfuehrung. Force Push wird nicht angeboten; `tests/repository-sync-actions.test.js` deckt strukturierte Commands und echte lokale Remote-Laeufe ab.
- Review-Ergebnis: Bestanden am 2026-06-03. Fetch, Pull, Push, Sync, Commit and Push und Publish Branch laufen ueber den whitelisted Git Wrapper, sind in `src/main.js` sichtbar verdrahtet, zeigen laufenden Status, Erfolg, Fehler und Git Output, melden Pull-/Sync-Konflikte lesbar und bieten keinen Force Push an. Fokussierte Sync-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T17 - Stash-Basisfunktionen umsetzen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`, `T15`
- Definition of Done: Aenderungen stashen, Stash-Liste anzeigen, Stash anwenden, Stash loeschen und Stash mit kurzer Message anlegen funktionieren; Fehler und Konflikte beim Anwenden sind sichtbar; Stash bleibt Basisfunktion und wird nicht zum Backup-Manager.
- Implementierungsnotiz: Kein teilweise anwenden, kein komplexer Stash-Browser, kein Stash-Konflikt-Assistent.
- Notiz: `src/repository-stash-actions.js` kapselt Stash-Liste, Stash Push mit optionaler Message/Untracked, Apply und Drop ueber den Git Wrapper; `src/repository-state.js` laedt Stash-Eintraege, und `src/main.js` zeigt einen kompakten Stash-Bereich mit Status, Apply/Delete und Git Output. `tests/repository-stash-actions.test.js` deckt strukturierte Commands, Validierung, echte Push/List/Apply/Drop-Laeufe und einen echten Apply-Konflikt ab.
- Review-Ergebnis: Bestanden am 2026-06-03. Stash Push mit optionaler Message/Untracked, Stash-Liste, Apply und Drop laufen ueber den whitelisted Git Wrapper; `src/repository-state.js` laedt Stash-Eintraege, `src/main.js` zeigt Status, Fehler, Git Output und eine bestaetigte Drop-Warnung, und Apply-Konflikte werden lesbar gemeldet. Fokussierte Stash-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T37 - GitHub Auth-Flow und Token-Speicherung entscheiden

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`, `T33`
- Definition of Done: Die GitHub-Auth-Variante fuer die gewaehlte Desktop-Shell ist dokumentiert; sichere Token-Speicherung ist konkret benannt; Logout-/Token-Revocation-Verhalten, no-token Zustand, fehlende Scopes, Rate-Limit- und Netzwerkfehler sind als Fehlervertrag beschrieben; Web-Prototyp darf keine unsichere Token-Persistenz als finale Loesung einfuehren.
- Implementierungsnotiz: GitHub + HTTPS priorisieren. Kein eigenes SSH-Key-Management bauen. Falls Device Flow, OAuth-App oder Credential Manager genutzt wird, erforderliche Scopes und Redirect-/Polling-Verhalten explizit festhalten.
- Notiz: `docs/github-auth-decision.md` legt GitHub OAuth Device Flow ueber die Tauri-Backend-Bridge, OS-Credential-Store-Speicherung via `SecureTokenStore`, no-token Zustand, Logout/Revocation, Scope-Anforderungen, Rate-Limit-/Netzwerk-/API-Fehlervertrag und Web-Prototyp-Grenzen ohne unsichere Token-Persistenz fest; `docs/architecture.md` verweist auf diese Entscheidung.
- Review-Ergebnis: Bestanden am 2026-06-03. `docs/github-auth-decision.md` dokumentiert GitHub OAuth Device Flow ueber die Tauri-Backend-Bridge, sichere Token-Speicherung via OS-Credential-Store/`SecureTokenStore`, Logout/Revocation, no-token Zustand, fehlende Scopes, Rate-Limit-, Netzwerk- und API-Fehler sowie die Grenze gegen unsichere Token-Persistenz im Web-Prototyp; `docs/architecture.md` verweist auf diese Auth-Entscheidung.
- Offene Review-Punkte: -

### T38 - GitHub Auth und Basis-API-Client implementieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T37`
- Definition of Done: GitHub Login und Logout funktionieren gemaess `T37`; Token werden ueber den entschiedenen sicheren Speicher gelesen und geschrieben; Auth-Status ist fuer Repository-Kontexte und GitHub-Aktionen abrufbar; User-Repositories koennen geladen und durchsucht werden; fehlende Auth, fehlende Scopes, Rate-Limits, Netzwerkfehler und API-Fehler werden strukturiert und lesbar angezeigt.
- Implementierungsnotiz: API-Client klein halten: Login-Status, User-Repos und gemeinsame Fehlernormalisierung zuerst. PR-, Checks- und Publish-spezifische API-Methoden in den abhaengigen Tasks ergaenzen, nicht als versteckten Rundumschlag.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T39 - Clone per URL bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T4`, `T6`, `T7`
- Definition of Done: Clone Repo per URL funktioniert mit frei waehlbarem Zielordner; HTTPS-, SSH- und GitHub-URLs werden an den Git Wrapper uebergeben; Clone-Fortschritt, Erfolg und Fehler sind sichtbar; SSH-Fehler verweisen auf das vorhandene lokale Git/SSH-Setup statt eigenes SSH-Key-Management anzubieten; erfolgreich geklonte Repositories werden automatisch als Tab geoeffnet.
- Implementierungsnotiz: URL-Clone darf ohne GitHub Login funktionieren. Zielordner-Auswahl und Clone-Operation muessen ueber die kontrollierte Runtime-/Bridge-Schicht laufen und duerfen keine freie Shell exposed.
- Notiz: `src/repository-clone-actions.js` fuehrt URL-Clone ueber den whitelisted Git Wrapper aus, normalisiert Clone-Fehler inklusive SSH-Hinweis auf lokales Git/SSH-Setup und wird von `src/main.js` direkt aus dem Clone-Dialog mit sichtbarem Clone-Status, Git Output, automatischem Tab und Refresh nach Erfolg verdrahtet. `tests/repository-clone-actions.test.js` prueft Request-Bau, Validierung und einen echten Clone-Lauf ueber den Wrapper.
- Review-Ergebnis: Re-Review nicht bestanden am 2026-06-03. Die Clone-Basisschicht und fokussierten Tests laufen, aber die UI erfuellt den Zielordner-Teil der Definition of Done nicht.
- Offene Review-Punkte: `src/main.js` verwendet den im Clone-Dialog eingegebenen Zielordner als Parent und haengt immer `repoNameFromUrl(url)` an (`targetPath: joinPath(target, repoName)`). Dadurch kann der Nutzer den finalen Clone-Zielordner nicht frei waehlen; bei Eingabe von `C:\code\custom-name` wuerde nach `C:\code\custom-name\<repo>` geklont. T39 muss entweder den eingegebenen absoluten Zielordner unveraendert an `runCloneAction`/Git Wrapper uebergeben oder UI/Task explizit auf "Parent folder + abgeleiteter Repo-Name" aendern und entsprechend testen.

### T40 - Clone from GitHub bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T4`, `T38`, `T39`
- Definition of Done: Clone from GitHub zeigt durchsuchbare Repositories des eingeloggten Users mit Owner/Name, Beschreibung, Sichtbarkeit, Stars, Clone-URL und private/public Indikator, soweit GitHub diese Daten liefert; die gewaehlte Clone-URL ist vor Ausfuehrung sichtbar; Zielordner ist frei waehlbar; Clone-Fortschritt und Fehler sind sichtbar; erfolgreich geklonte Repositories werden automatisch als Tab geoeffnet.
- Implementierungsnotiz: Reuse des URL-Clone-Flows aus `T39`; GitHub-Auswahl liefert nur Repository-Metadaten und Clone-URL. Keine GitHub-Dashboard-, Issue- oder Notification-Funktionen aufnehmen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T20 - Publish to GitHub fuer lokale Ordner bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T8`, `T14`, `T38`
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
- Abhaengigkeiten: `T8`, `T12`, `T13`, `T14`, `T16`, `T17`, `T20`, `T23`, `T28`, `T29`, `T30`, `T38`, `T39`, `T40`
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
- Abhaengigkeiten: `T16`, `T38`
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

### T33 - Desktop-App-Laufzeitentscheidung treffen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`, `T4`, `T6`, `T8`
- Definition of Done: Entscheidung fuer die Desktop-Shell ist dokumentiert; Tauri und Electron wurden gegen lokale Git-CLI-Ausfuehrung, Dateiwatcher, Datei-/Ordnerauswahl, GitHub Auth, Packaging, Update-Strategie und UI-Wiederverwendung bewertet; `docs/plan.md` und Architekturdocs beschreiben Web-Prototyp plus Desktop-Ziel klar.
- Implementierungsnotiz: Praeferenz ist eine schlanke lokale Desktop-App. Web-UI bleibt als Frontend-Schicht erhalten; Desktop-Shell darf keine neue Produktdomaene einfuehren.
- Notiz: `docs/desktop-runtime-decision.md` waehlt Tauri als Desktop-Shell und bewertet Tauri/Electron gegen Git CLI, Dateiwatcher, Datei-/Ordnerauswahl, GitHub Auth, sichere Token-Speicherung, Packaging, Updates und UI-Wiederverwendung; `docs/plan.md` und `docs/architecture.md` verweisen jetzt auf Web-Prototyp plus Tauri-Desktop-Ziel mit kontrollierter Bridge.
- Review-Ergebnis: Bestanden am 2026-06-03. `docs/desktop-runtime-decision.md` waehlt Tauri als Desktop-Shell und bewertet Tauri/Electron gegen Git CLI, Dateiwatcher, Datei-/Ordnerauswahl, GitHub Auth, sichere Token-Speicherung, Packaging, Updates und UI-Wiederverwendung; `docs/plan.md` und `docs/architecture.md` beschreiben Web-Prototyp plus Tauri-Desktop-Ziel mit kontrollierter Bridge konsistent.
- Offene Review-Punkte: -

### T34 - Desktop-Shell fuer Full UI vorbereiten

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T33`, `T4`, `T6`, `T8`, `T38`
- Definition of Done: Die bestehende Web-UI laeuft innerhalb einer lokalen Desktop-Shell; Git CLI, Dateiwatcher, lokale Ordnerauswahl und GitHub Auth sind ueber eine kontrollierte Bridge erreichbar; Full UI entspricht funktional der Web-Version.
- Implementierungsnotiz: Keine direkte Node- oder Shell-Freiheit im Renderer exponieren. Bridge nur fuer whitelisted Git/GitHub/Filesystem-Aktionen. Bestehende UI-Komponenten wiederverwenden.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T35 - Floating Window Modus konzipieren und bauen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T33`, `T34`, `T14`, `T16`, `T23`
- Definition of Done: Desktop-App bietet ein kleines Floating Window fuer den aktiven Repository-Kontext; es zeigt Repository, Branch, Change-Zaehler, Status/Fehler und kompakte Aktionen fuer Commit, Commit and Push, Push und Pull/Sync; es bleibt fokussiert auf Git und wird nicht zum Dashboard.
- Implementierungsnotiz: Floating Window ist der kompakte Desktop-Modus. Es soll schnell erreichbar sein und wenig Flaeche einnehmen, aber keine wichtigen Git-Fehler verstecken.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T36 - Umschalten zwischen Floating Window und Full UI umsetzen

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T34`, `T35`
- Definition of Done: Nutzer kann aus dem Floating Window in die Full UI wechseln und zurueck; Repository-Kontext, laufende Operationen, Fehler, Tabs und lokale UI-Zustaende bleiben konsistent; Umschalten fuehrt nicht zu doppelten Git-Operationen oder verlorenen Statusupdates.
- Implementierungsnotiz: Full UI ist die Web-Version in Desktop-Shell. Floating Window und Full UI muessen denselben Repository-State nutzen, nicht zwei voneinander abweichende Modelle.
- Review-Ergebnis: -
- Offene Review-Punkte: -
