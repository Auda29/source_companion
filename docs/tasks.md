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

Stand 2026-06-03: Die zu breiten Aufgaben `T22` und `T27` wurden durch kleinere Todo-Aufgaben ersetzt. GitHub PR/Checks/Kommentare wurden zunaechst in `T28` bis `T30` getrennt; Merge/Rebase ist in Scope-Entscheidung `T31` und optionale Umsetzung `T32` getrennt.

Stand 2026-06-03: Review-Fehler in `T12` als konkrete Akzeptanz ergaenzt: Discard muss bei gemischten Datei-Zustaenden wie `MM` den ausgewaehlten Bucket respektieren, damit Worktree-Discard nicht versehentlich staged Inhalt verliert. `T13` bleibt im Review, sollte aber erst nach dem `T12`-Fix final abgenommen werden.

Stand 2026-06-03: Die zu breite GitHub-Grundlagenaufgabe `T18` wurde durch `T37` und `T38` ersetzt, damit Auth-/Token-Speicherentscheidung und API-Implementierung getrennt reviewbar sind. Die gemischte Clone-Aufgabe `T19` wurde durch `T39` und `T40` ersetzt, damit URL-Clone nicht unnoetig von GitHub Auth blockiert wird.

Stand 2026-06-09: Die zu breite Publish-Aufgabe `T20` wurde durch `T41` bis `T43` ersetzt, damit GitHub-Repo-Erstellung, Publish-Vorbedingungen und Remote/Push-Ausfuehrung getrennt reviewbar sind. Die kombinierte Konzept-/Umsetzungsaufgabe `T35` wurde durch `T44` und `T45` ersetzt.

Stand 2026-06-09: Die GitHub-PR-Aufgabe `T28` wurde durch `T46` und `T47` ersetzt, damit GitHub-Remote-/PR-API-Grundlage und PR-UI-Flow getrennt reviewbar sind.

Stand 2026-06-09: Die zu breite Desktop-Shell-Aufgabe `T34` wurde durch `T48` bis `T51` ersetzt, damit Tauri-Shell, Bridge-Vertrag, native Dialoge/Watcher und GitHub-Auth-/Full-UI-Paritaet getrennt umsetzbar und reviewbar sind.

Stand 2026-06-09: Die zu breite Desktop-GitHub-/Paritaetsaufgabe `T51` wurde durch `T52` bis `T56` ersetzt, damit Auth/Secure Storage, GitHub-Clone, Publish, PR-/Checks-/Review-Bridge und abschliessende Full-UI-Paritaet getrennt reviewbar bleiben.

Stand 2026-06-09: Der optionale Review-Follow-up aus `T54` zum lesbareren Publish-Git-Output wurde als eigener `P3`-Task `T58` konkretisiert, damit `T54` abgeschlossen bleibt und der kosmetische Nachlauf separat priorisiert werden kann.

Stand 2026-06-10: Drei Review-Findings aus dem Projekt-Review wurden als `T61` bis `T63` erfasst: bundletaugliche Desktop-Bridge, korrekter Publish-Preflight fuer Ordner ohne Git und macOS-Keychain-Speicherung ohne Token-Prozessargumente.

Stand 2026-06-10: Die zu breite Packaging-Aufgabe `T61` wurde nach Recherche in `docs/desktop-bridge.md`, `docs/desktop-runtime-decision.md`, `src-tauri/src/lib.rs` und `src-tauri/tauri.conf.json` durch `T64` bis `T66` ersetzt. Die Arbeit ist getrennt in Paketierungsentscheidung, Worker-/Resource-Aufloesung und Node-/Bundle-Smoke-Absicherung.

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

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T37`
- Definition of Done: GitHub Login und Logout funktionieren gemaess `T37`; Token werden ueber den entschiedenen sicheren Speicher gelesen und geschrieben; Auth-Status ist fuer Repository-Kontexte und GitHub-Aktionen abrufbar; User-Repositories koennen geladen und durchsucht werden; fehlende Auth, fehlende Scopes, Rate-Limits, Netzwerkfehler und API-Fehler werden strukturiert und lesbar angezeigt.
- Implementierungsnotiz: API-Client klein halten: Login-Status, User-Repos und gemeinsame Fehlernormalisierung zuerst. PR-, Checks- und Publish-spezifische API-Methoden in den abhaengigen Tasks ergaenzen, nicht als versteckten Rundumschlag.
- Notiz: Review-Punkt adressiert: `src/github-api-client.js` trennt jetzt einen tokenfreien Renderer-Bridge-Client von der backend-/testseitigen Token-API, nutzt ohne explizit injizierten SecureTokenStore keinen Memory-Fallback mehr und exportiert im Browser nur die Bridge-Fassade. `src/main.js` erstellt GitHub-Clients ueber eine backend-only Bridge bzw. Tauri-Commands statt ueber DeviceFlow/Tokenzugriff im Renderer; neue Tests sichern tokenfreie Bridge-Ergebnisse und fehlenden Store-Fallback ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. `src/github-api-client.js` trennt den tokenfreien Renderer-Bridge-Client von der backend-/testseitigen Token-API, verlangt fuer den direkten API-Client einen explizit injizierten sicheren TokenStore, normalisiert Auth-/Scope-/RateLimit-/Netzwerk-/API-Fehler und liefert tokenfreie Auth-/Repository-Ergebnisse; `src/main.js` nutzt fuer den Renderer eine backend-only Bridge bzw. Tauri-Commands. Fokussierte GitHub-Client-Tests und die vollstaendige Node-Test-Suite bestanden.
- Offene Review-Punkte: -

### T39 - Clone per URL bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T4`, `T6`, `T7`
- Definition of Done: Clone Repo per URL funktioniert mit frei waehlbarem Zielordner; HTTPS-, SSH- und GitHub-URLs werden an den Git Wrapper uebergeben; Clone-Fortschritt, Erfolg und Fehler sind sichtbar; SSH-Fehler verweisen auf das vorhandene lokale Git/SSH-Setup statt eigenes SSH-Key-Management anzubieten; erfolgreich geklonte Repositories werden automatisch als Tab geoeffnet.
- Implementierungsnotiz: URL-Clone darf ohne GitHub Login funktionieren. Zielordner-Auswahl und Clone-Operation muessen ueber die kontrollierte Runtime-/Bridge-Schicht laufen und duerfen keine freie Shell exposed.
- Notiz: Review-Punkt adressiert: Der URL-Clone-Dialog uebergibt den eingegebenen absoluten Zielordner jetzt unveraendert als finalen `targetPath` an `runCloneAction`; der Tab-Name wird aus diesem Zielpfad abgeleitet und der Platzhalter zeigt einen finalen Ordnernamen. `tests/main-clone-flow.test.js` prueft die UI-Uebergabe, `tests/repository-clone-actions.test.js` prueft weiterhin Request-Bau, Validierung und echten Clone-Lauf.
- Review-Ergebnis: Bestanden am 2026-06-09. Der Clone-Dialog uebergibt den eingegebenen absoluten Zielordner als finalen Clone-Pfad an `runCloneAction`; HTTPS-, SSH- und GitHub-URL-Validierung bleiben ueber den kontrollierten Clone/Git-Wrapper gekapselt, Clone-Status und Fehler sind sichtbar, SSH-Fehler verweisen auf das lokale Git/SSH-Setup und erfolgreiche Clone-Laeufe oeffnen bzw. aktualisieren den Repository-Tab. Fokussierte Clone-Tests und die vollstaendige Node-Test-Suite bestanden.
- Offene Review-Punkte: -

### T40 - Clone from GitHub bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T4`, `T38`, `T39`
- Definition of Done: Clone from GitHub zeigt durchsuchbare Repositories des eingeloggten Users mit Owner/Name, Beschreibung, Sichtbarkeit, Stars, Clone-URL und private/public Indikator, soweit GitHub diese Daten liefert; die gewaehlte Clone-URL ist vor Ausfuehrung sichtbar; Zielordner ist frei waehlbar; Clone-Fortschritt und Fehler sind sichtbar; erfolgreich geklonte Repositories werden automatisch als Tab geoeffnet.
- Implementierungsnotiz: Reuse des URL-Clone-Flows aus `T39`; GitHub-Auswahl liefert nur Repository-Metadaten und Clone-URL. Keine GitHub-Dashboard-, Issue- oder Notification-Funktionen aufnehmen.
- Notiz: GitHub-Clone nutzt jetzt die ausgewaehlte Repository-Clone-URL und startet denselben Clone-Runner wie der URL-Clone-Flow mit frei waehlbarem finalem Zielordner; die Repository-Liste zeigt Beschreibung, Sichtbarkeit/private-public, Stars und Clone-URL, und ein Regressionstest prueft die Uebergabe der GitHub-Clone-URL an den Clone-Runner.
- Review-Ergebnis: Bestanden am 2026-06-09. Clone from GitHub zeigt durchsuchbare User-Repositories mit Owner/Name, Beschreibung, Sichtbarkeit/private-public, Stars und Clone-URL; die ausgewaehlte Clone-URL ist vor Ausfuehrung sichtbar, der frei waehlbare Zielordner wird an denselben Clone-Runner wie der URL-Clone-Flow uebergeben, und Clone-Fortschritt, Fehler sowie erfolgreiche Tab-Oeffnung sind verdrahtet. Fokussierter Clone-Flow-Test bestand.
- Offene Review-Punkte: -

### T41 - GitHub Repository-Erstellung fuer Publish implementieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T38`
- Definition of Done: Der GitHub API Client kann fuer den eingeloggten User ein Repository mit Name, optionaler Beschreibung und private/public Sichtbarkeit erstellen; fehlende Auth, fehlende Scopes, Rate-Limits, Netzwerkfehler, belegte Repository-Namen und sonstige API-Fehler werden strukturiert und lesbar zurueckgegeben; Tokens bleiben backend-intern und werden nicht in Renderer-State, Remote-URLs oder Git-Argumente geschrieben.
- Implementierungsnotiz: Nur die Publish-spezifische GitHub-Repo-Erstellung ergaenzen. Keine GitHub-Dashboard-, Org-Admin- oder Issue-Funktionen aufnehmen.
- Notiz: Review-Punkt adressiert: `GitHubApiClient.createRepository()` prueft jetzt vor `POST /user/repos` denselben Auth-/Scope-Vertrag wie `listUserRepositories()` und gibt bei fehlendem `repo`-Scope strukturiert `github-scope-missing` zurueck, ohne die API aufzurufen. Regressionstest fuer fehlende Scopes bei Repository-Erstellung ergaenzt; fokussierter GitHub-Client-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. `GitHubApiClient.createRepository()` erstellt User-Repositories ueber `POST /user/repos` mit Name, optionaler Beschreibung und private/public Sichtbarkeit, normalisiert fehlende Auth, fehlende Scopes, Rate-Limits, Netzwerkfehler, belegte Repository-Namen und API-Fehler, und schuetzt Tokens durch backend-/testseitige SecureTokenStore-Nutzung sowie tokenfreie Renderer-Bridge-Ergebnisse. Fokussierter GitHub-Client-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T42 - Publish-Vorbedingungen und UI-Flow bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T4`, `T8`, `T14`, `T38`, `T41`
- Definition of Done: Publish to GitHub zeigt den ausgewaehlten lokalen Ordner oder Repository-Kontext, schlaegt einen Repository-Namen aus dem Ordnernamen vor, bietet optionale Beschreibung sowie private/public Auswahl an und prueft vor Ausfuehrung GitHub-Login, Ordner-ohne-Git, Git-Repo-ohne-Commits und vorhandene Remote-Situation; `git init` fuer Ordner ohne Git und Public Publish brauchen eine sichtbare Bestaetigung; bei fehlenden Commits wird zum Commit-Flow gefuehrt statt automatisch zu committen.
- Implementierungsnotiz: Dieser Task startet noch keinen versteckten Publish-Durchlauf. Er bereitet die validierten Eingaben und bestaetigten Entscheidungen fuer den Runner aus `T43` vor.
- Notiz: Review-Punkt adressiert: Da `T41` inzwischen abgeschlossen ist, wurde T42 erneut auf `review` gesetzt. Die bestehende Publish-Preflight-Umsetzung bleibt unveraendert; fokussierte Tests fuer Publish-Preflight und Dialog-Flow bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Publish to GitHub bereitet den ausgewaehlten lokalen Ordner bzw. Repository-Kontext mit vorgeschlagenem Repository-Namen, optionaler Beschreibung und private/public Auswahl vor; die Preflight-Pruefung validiert GitHub-Login, Ordner-ohne-Git, fehlende Commits, lokale Branch-Situation und vorhandene Remotes, verlangt sichtbare Bestaetigungen fuer Git init und Public Publish und startet weder Git init noch Commit noch Publish-Runner. Fokussierte Publish-/Dialog-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T43 - Publish-Runner mit Remote-Schutz und Initial Push bauen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T7`, `T16`, `T41`, `T42`
- Definition of Done: Der Publish-Runner erstellt das GitHub-Repository, initialisiert bei bestaetigtem Ordner-ohne-Git das lokale Git-Repo, setzt `origin` nur nach klarer Remote-Pruefung, ueberschreibt vorhandene Remotes nie still, fuehrt den initialen Push bzw. Publish Branch aus und oeffnet oder aktualisiert danach den Repository-Tab; Fortschritt, Erfolg, GitHub-Fehler, Git-Fehler und rohe Ausgaben sind im UI sichtbar.
- Implementierungsnotiz: Git-Kommandos laufen nur ueber den whitelisted Git Wrapper und die Operation Queue. HTTPS/Git Credential Manager priorisieren; kein Token in Remote-URLs oder Git-Argumente schreiben; SSH-Fehler auf das lokale Git/SSH-Setup zurueckfuehren.
- Notiz: Publish-Runner erstellt das GitHub-Repository ueber den GitHub-Client, prueft vorhandene Remotes vor `origin`-Setzung, initialisiert Git nur bei bestaetigtem Ordner-ohne-Git, pusht den aktuellen Branch per whitelisted Git Wrapper und liefert Fortschritt, rohe Ausgaben sowie GitHub-/Git-Fehler an die UI. Fokussierte Publish-/Dialog-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. `runPublishAction` erstellt das GitHub-Repository ueber den GitHub-Client, initialisiert Git nur bei bestaetigtem Ordner-ohne-Git, prueft vorhandene Remotes vor `origin`-Setzung, verweigert stilles Remote-Ueberschreiben, setzt `origin` ohne Token in Git-Argumenten und pusht den aktuellen Branch ueber den whitelisted Git Wrapper; die UI oeffnet bzw. aktualisiert nach Erfolg den Repository-Tab und zeigt Fortschritt, Fehler sowie rohe Ausgaben. Fokussierte Publish-/Dialog-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T21 - Einklappbaren Graph/History-Bereich bauen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T6`, `T8`, `T11`
- Definition of Done: Einklappbarer Graph/History-Bereich zeigt Commit-History, aktuellen Branch, Remote-Branch, HEAD, Commit-Metadaten, Commit-Diff und lokale/remote Divergenz; Bereich bleibt optional sichtbar und verdraengt die Kern-Source-Control-UI nicht dauerhaft.
- Implementierungsnotiz: Kein Activity Feed, keine Analytics, kein Projektmanagement-Dashboard.
- Notiz: `src/repository-history.js` laedt Commit-History und HEAD-Commit-Diff ueber den whitelisted `git log`-Wrapper; `src/repository-state.js` haengt History-Daten inklusive HEAD-SHA an den Repository-Kontext, und `src/main.js` rendert einen standardmaessig eingeklappten Graph/History-Bereich mit Branch, Remote-Branch, HEAD, Divergenz, Commit-Metadaten und Diff. Fokussierte History-/Main-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. `src/repository-history.js` laedt Commit-History und HEAD-Commit-Diff ueber den whitelisted Git-Wrapper, `src/repository-state.js` haengt History inklusive HEAD-SHA an den Repository-Kontext, und `src/main.js` rendert den Bereich standardmaessig eingeklappt mit Branch, Remote-Branch, HEAD, Divergenz, Commit-Metadaten und Diff. Fokussierte History-/State-/GitHub-Tests sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T23 - Git Output, Fehlertexte und Sicherheitswarnungen fertigstellen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T7`, `T12`, `T14`, `T15`, `T16`, `T43`
- Definition of Done: Git Output ist jederzeit erreichbar; GitHub- und Git-Fehler sind lesbar; gefaehrliche Aktionen haben bestaetigte Warnungen fuer Discard, Amend, Branch loeschen, Remote ueberschreiben und Public Publish; rohe Ausgaben bleiben einsehbar, sind aber nicht die einzige Nutzererklaerung.
- Implementierungsnotiz: Keine versteckten Automatismen wie Auto-Commit, Auto-Push oder Auto-Publish.
- Notiz: Publish-Preflight-Ergebnisse werden jetzt im Git Output protokolliert, inklusive lesbarer Fehlerdetails und Preflight-Checks; bestehende Remote-Konfigurationen zeigen im Publish-Panel explizit, dass Source Companion Remotes nicht automatisch ueberschreibt oder ersetzt. Bestehende bestaetigte Warnungen fuer Discard, Amend, Branch loeschen und Public Publish bleiben erhalten. Fokussierte Main-/Publish-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Git Output bleibt ueber den Repository-Kontext erreichbar und enthaelt jetzt auch Publish-Preflight-Ergebnisse mit lesbaren Fehlerdetails und Check-Zusammenfassung; GitHub-/Git-Fehler werden nicht nur als rohe Ausgabe angezeigt, und bestaetigte Warnungen fuer Discard, Amend, Branch loeschen, Remote-Schutz und Public Publish sind vorhanden. Fokussierte Main-/Publish-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T24 - Kernflows testen und Review-Checkliste dokumentieren

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T8`, `T12`, `T13`, `T14`, `T16`, `T17`, `T23`, `T47`, `T29`, `T30`, `T38`, `T39`, `T40`, `T43`
- Definition of Done: Automatisierte oder manuelle Repro-Schritte decken Repo ohne Git, Git init, Clone, Publish, Status, Diff, Datei- und Hunk-Staging, Commit, Amend, Branch-Wechsel, Pull/Push-Fehler, Stash, GitHub Auth-Fehler und PR/Checks ab; ausgeschlossene Features wie Editor, Terminal, Force Push und Workspaces sind in Tests oder Architekturentscheidungen abgesichert.
- Implementierungsnotiz: Testabdeckung nach Risiko waehlen. Falls ein Flow nur manuell pruefbar ist, klare Schritte und erwartetes Ergebnis dokumentieren.
- Notiz: 2026-06-09 14:38 CEST umgesetzt: `docs/core-flow-review-checklist.md` dokumentiert automatisierte Basispruefung, Testabdeckung und manuelle Repro-Schritte fuer Repo ohne Git, Git init, Clone, Publish, Status, Diff, Datei-/Hunk-Staging, Commit, Amend, Branch, Pull/Push-Fehler, Stash, GitHub Auth-Fehler, PR/Checks, Review-Kommentare und ausgeschlossene Features. Vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. `docs/core-flow-review-checklist.md` deckt automatisierte Basispruefung, Testabdeckung und manuelle Repro-Schritte fuer Repo ohne Git, Git init, Clone, Publish, Status, Diff, Datei-/Hunk-Staging, Commit, Amend, Branch, Pull/Push-Fehler, Stash, GitHub Auth-Fehler, PR/Checks, Review-Kommentare und ausgeschlossene Features ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T25 - AI Commit Message Konzept ausarbeiten

- Status: `done`
- Prioritaet: `P3`
- Abhaengigkeiten: `T14`
- Definition of Done: Produktentscheidung fuer AI Commit Message ist dokumentiert; entschieden ist, ob ein leeres Commit-Message-Feld direkt eine Message generiert oder zuerst bestaetigt; Datenbasis, Datenschutz, Kosten, Fehlerfaelle und UI-Grenzen sind beschrieben.
- Implementierungsnotiz: Codex-Verhalten als Referenz: Wenn Commit Message leer bleibt, kann eine Message generiert werden. Feature darf kein AI Chat, kein Agent-Loop und kein autonomer Commit werden; Nutzer muss Vorschlag pruefen und Commit selbst ausloesen.
- Notiz: 2026-06-09 16:23 CEST umgesetzt: `docs/ai-commit-message-concept.md` dokumentiert AI Commit Message als spaetere optionale Commit-Box-Funktion mit expliziter Bestaetigung bei leerem Message-Feld, staged Diff als Datenbasis, Datenschutz-/Credential-Grenzen, Kosten-/Rate-Limit-/Fehlerfaelle und UI-Grenzen ohne Chat, Agent-Loop oder autonomen Commit. `docs/plan.md` verweist auf die Entscheidung.
- Review-Ergebnis: Bestanden am 2026-06-09. `docs/ai-commit-message-concept.md` dokumentiert die Produktentscheidung, dass AI Commit Message spaeter optional ist, leere Message-Felder nicht still generieren, sondern eine explizite Bestaetigung brauchen, staged Diff die erste Datenbasis bleibt und Datenschutz, Kosten-/Rate-Limit-/Fehlerfaelle sowie UI-Grenzen ohne Chat, Agent-Loop oder autonomen Commit beschrieben sind. `docs/plan.md` verweist konsistent auf diese Entscheidung.
- Offene Review-Punkte: -

### T26 - Source-Control-Toolbar und View Modes bauen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T9`, `T10`, `T11`, `T16`
- Definition of Done: Source-Control-Bereich hat kompakte Toolbar-Aktionen fuer Refresh, View Mode, Commit/Checkmark, Source-Control-Aktionen und More Menu; View Mode beeinflusst die Changes-/Diff-Darstellung nachvollziehbar; Refresh nutzt den entprellten Status-Refresh; More Menu enthaelt nur erlaubte Git/GitHub-Aktionen.
- Implementierungsnotiz: Toolbar an Cursor/VS-Code-Source-Control orientieren, aber keine Projektbaum-, Terminal-, Task-Runner- oder Dashboard-Aktionen aufnehmen.
- Notiz: 2026-06-09 14:26 CEST umgesetzt: Source-Control rendert jetzt eine kompakte Toolbar mit Refresh, Commit, ausgewaehlten Dateiaktionen, Split/List/Diff-View-Modes und einem More-Menu fuer erlaubte Sync-, Stash- und PR-Refresh-Aktionen. View Modes schalten die Changes-/Diff-Darstellung per Tab-Kontext um; Toolbar-Refresh nutzt den bestehenden Repository-State-Refresh. Fokussierter Main-UI-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Source-Control-Toolbar, Refresh, Commit-/Dateiaktionen, Split/List/Diff-View-Modes und More-Menu fuer erlaubte Sync-, Stash- und PR-Refresh-Aktionen sind im Repository-UI verdrahtet; die View-Modes beeinflussen Changes-/Diff-Anzeige pro Tab-Kontext und Toolbar-Refresh nutzt den bestehenden Repository-State-Refresh. Fokussierte Main-UI-Tests sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T46 - GitHub Remote-Erkennung und PR-API-Grundlage bauen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T16`, `T38`
- Definition of Done: GitHub-Remote wird aus den Git-Remotes des aktiven Repository-Kontexts erkannt und in Owner/Repository, Remote-Name und URL normalisiert; HTTPS- und SSH-GitHub-URLs werden unterstuetzt; nicht-GitHub-Remotes und mehrdeutige Remotes liefern lesbare Zustaende; der GitHub API Client kann vorhandene PRs fuer den aktuellen Branch laden und neue PRs mit Base-Branch, Titel und Beschreibung erstellen; fehlende Auth, fehlende Remote-Zuordnung, fehlende Scopes, Rate-Limits, Netzwerkfehler und API-Fehler werden strukturiert zurueckgegeben.
- Implementierungsnotiz: API-Methoden und Remote-Erkennung ohne UI-Spezialfaelle kapseln. Keine Issue Board-, Kanban-, Notification- oder Dashboard-Funktionen aufnehmen.
- Notiz: 2026-06-09 12:19 CEST umgesetzt: Repository-State normalisiert GitHub-Remotes inklusive Owner/Repository, Remote-Name, URL und HTML-Link, erkennt HTTPS-/SSH-URLs und liefert lesbare Zustaende fuer nicht-GitHub- und mehrdeutige Remotes. `GitHubApiClient` und Renderer-Bridge koennen PRs fuer den aktuellen Branch laden und neue PRs erstellen; fehlende Remote-Zuordnung und bestehende Auth-/Scope-/Rate-Limit-/Netzwerk-/API-Fehler werden strukturiert zurueckgegeben. Fokussierte Tests und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Repository-State normalisiert GitHub-Remotes aus HTTPS- und SSH-URLs inklusive Owner/Repository, Remote-Name, URL und HTML-Link, meldet nicht-GitHub- und mehrdeutige Remotes lesbar, und `GitHubApiClient` plus Renderer-Bridge laden vorhandene PRs fuer den aktuellen Branch bzw. erstellen neue PRs mit Base, Head, Titel und Beschreibung. Fehlende Auth, fehlende Remote-Zuordnung, fehlende Scopes, Rate-Limits, Netzwerkfehler und API-Fehler werden strukturiert behandelt. Fokussierte GitHub-/State-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T47 - GitHub PR-Erstellung im Repository-UI verdrahten

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T46`
- Definition of Done: Aktiver Repository-Kontext zeigt die erkannte GitHub-Remote-Zuordnung; eine vorhandene PR fuer den aktuellen Branch wird angezeigt oder verlinkt; neue PR kann mit Base-Branch, Titel und Beschreibung aus dem UI erstellt werden; gewaehlte Base und Head sind vor Ausfuehrung sichtbar; erstellte oder vorhandene PR kann im Browser oder in der GitHub-UI geoeffnet werden; Lade-, Erfolgs- und Fehlerzustaende sind im Repository-Kontext und Git Output sichtbar.
- Implementierungsnotiz: GitHub-Funktionen bleiben auf Versionskontrolle begrenzt. Kein Issue Board, kein Kanban, keine Notifications-Zentrale und kein allgemeines GitHub-Dashboard.
- Notiz: 2026-06-09 13:07 CEST umgesetzt: Repository-UI zeigt eine GitHub-Pull-Request-Sektion mit erkannter Remote-Zuordnung, automatischem Laden vorhandener PRs fuer den aktuellen Branch, Links zu Repository/PR, Create-PR-Formular mit sichtbarem Base/Head sowie Lade-, Erfolgs- und Fehlerstatus im Repository-Kontext und Git Output. Fokussierte Main-UI-Tests und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Repository-UI zeigt die erkannte GitHub-Remote-Zuordnung, laedt vorhandene PRs fuer den aktuellen Branch, verlinkt Repository und PR, erstellt neue PRs mit sichtbarer Base-/Head-Auswahl sowie Titel/Beschreibung und schreibt Lade-, Erfolgs- und Fehlerzustaende in Repository-Kontext und Git Output. Fokussierte Main-/GitHub-/State-Tests sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T29 - GitHub PR-Status und Checks anzeigen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T46`, `T47`
- Definition of Done: Fuer erkannte oder erstellte PRs werden PR-Status, Checks, Check-Ergebnisse und Links zu den Detailseiten angezeigt; laufende, erfolgreiche, fehlgeschlagene und unbekannte Check-Zustaende sind unterscheidbar; Rate-Limit-, Berechtigungs- und Netzwerkfehler werden lesbar angezeigt.
- Implementierungsnotiz: Checks nur anzeigen und oeffnen. Kein Actions-Dashboard Deluxe, keine Workflow-Steuerung und keine CI-Logs als eigenes Produktmodul.
- Notiz: 2026-06-09 14:18 CEST umgesetzt: GitHub-Client und Renderer-Bridge laden PR-Commit-Statuses und Check-Runs tokenfrei, normalisieren laufende/erfolgreiche/fehlgeschlagene/unbekannte Zustaende sowie Rate-Limit-/Berechtigungs-/Netzwerk-/API-Fehler. Die bestehende PR-UI zeigt fuer erkannte oder erstellte PRs Check-Zusammenfassung, einzelne Status-/Check-Ergebnisse und Links zu Detailseiten; Git Output enthaelt die Check-Zusammenfassung. Fokussierte GitHub-/Main-Tests und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. PR-Status und Checks werden fuer erkannte und erstellte PRs ueber Commit-Status und Check-Runs geladen, in laufende/erfolgreiche/fehlgeschlagene/unbekannte Zustaende normalisiert, mit Detail-Links im Repository-UI angezeigt und inklusive lesbarer Rate-Limit-, Berechtigungs- und Netzwerk/API-Fehler im Git Output protokolliert. Fokussierte GitHub-/Main-Tests sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T30 - GitHub Review-Kommentare und Issue-Links anzeigen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T46`, `T47`
- Definition of Done: Review-Kommentare der erkannten PR werden angezeigt oder zur GitHub-Ansicht verlinkt; Issue-Nummern aus Branch-Namen und Commit-Messages werden erkannt und als GitHub-Links angeboten; nicht gefundene Issues, fehlende Berechtigungen und API-Fehler werden verstaendlich behandelt.
- Implementierungsnotiz: Nur Verknuepfung und Anzeige fuer Versionskontrolle. Keine Issue-Verwaltung, keine Discussions, keine Wiki-Funktionen und keine Notifications-Zentrale.
- Notiz: 2026-06-09 14:11 CEST umgesetzt: GitHub-Client und Renderer-Bridge laden PR-Review-Kommentare tokenfrei, erkennen Issue-Nummern aus Branch-Namen und Commit-History, pruefen Issue-Links inklusive nicht gefundener oder nicht sichtbarer Issues und zeigen Review-Kontext, Kommentarlinks, Issue-Links sowie Fehler im Repository-UI und Git Output an. Fokussierte GitHub-/Main-Tests bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. GitHub-Client und Renderer-Bridge laden PR-Review-Kommentare, erkennen Issue-Nummern aus Branch-Namen und Commit-History, pruefen Issue-Links inklusive nicht gefundener oder nicht sichtbarer Issues und zeigen Review-Kontext, Kommentarlinks, Issue-Links sowie API-/Berechtigungsfehler im Repository-UI und Git Output an. Fokussierte GitHub-/Main-Tests sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Offene Review-Punkte: -

### T31 - Merge/Rebase-Basisumfang entscheiden

- Status: `done`
- Prioritaet: `P3`
- Abhaengigkeiten: `T1`
- Definition of Done: Produktentscheidung ist dokumentiert, ob Merge und/oder Rebase Teil des ersten Produktziels bleiben oder explizit in spaeteren Scope verschoben werden; Entscheidung benennt erlaubte Aktionen, ausgeschlossene History-Rewrite-Faelle, erforderliche Warnungen, Konfliktverhalten und Git-Output-Anforderungen; `docs/plan.md` und `docs/scope-gates.md` sind bei Scope-Aenderung konsistent.
- Implementierungsnotiz: Erst entscheiden, dann bauen. Kein interaktives Rebase, kein History-Rewrite-Wizard und kein komplexes Cherry-Pick-UI.
- Notiz: 2026-06-09 15:51 CEST umgesetzt: Merge bleibt im ersten Produktziel als begrenzte Basisfunktion fuer aktuellen Branch plus ausgewaehlten Ziel-Branch; Rebase und andere History-Rewrites wurden in spaeteren Scope verschoben. `docs/plan.md` und `docs/scope-gates.md` dokumentieren erlaubte Merge-Aktion, ausgeschlossene History-Rewrites, Warnungen/Blockaden, Konfliktverhalten und Git-Output-Anforderungen.
- Review-Ergebnis: Bestanden am 2026-06-09. `docs/plan.md` und `docs/scope-gates.md` dokumentieren konsistent, dass Merge als begrenzte Basisfunktion im ersten Produktziel bleibt, Rebase und andere History-Rewrites spaeteren Scope bilden, und Warnungen/Blockaden, Konfliktverhalten sowie Git-Output-Anforderungen fuer Merge sichtbar sein muessen.
- Offene Review-Punkte: -

### T32 - Merge-Basisfunktion umsetzen

- Status: `done`
- Prioritaet: `P3`
- Abhaengigkeiten: `T6`, `T8`, `T15`, `T16`, `T23`, `T31`
- Definition of Done: Falls `T31` Merge fuer den ersten Produktumfang freigibt, kann der aktuelle Branch mit einem ausgewaehlten Branch gemerged werden; Fortschritt, Erfolg, Git-Fehler, Konfliktzustand und Git Output sind sichtbar; bei uncommitted changes oder Git-Konflikten wird kein Terminal vorausgesetzt; falls `T31` Merge verschiebt, wird dieser Task entsprechend als nicht mehr im ersten Umfang markiert.
- Implementierungsnotiz: Rebase nur in einem separaten spaeteren Task planen, wenn `T31` es ausdruecklich freigibt und Fehler-, Warn- und Abbruchfaelle sauber bedienbar sind.
- Notiz: 2026-06-09 21:22 CEST umgesetzt und Review-Punkt adressiert: `git merge --no-edit <branch>` ist im Git CLI Wrapper whitelisted, `src/repository-merge-actions.js` kapselt Merge-Vorbedingungen, Erfolg, Git-Fehler und Konfliktmeldungen, und `src/main.js` zeigt einen Merge-Bereich mit sichtbarem Ziel-Branch, Busy-/Erfolgs-/Fehlerstatus, Git Output und Status-Refresh. Desktop-Bridge und Tauri-Handler bieten `runMergeAction` als expliziten Command; die line-ending-stabile Merge-Regression sowie die volle Node-Test-Suite bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Merge ist als begrenzte Basisfunktion fuer den aktuellen Branch plus ausgewaehlten Ziel-Branch umgesetzt; `src/repository-merge-actions.js` validiert Ziel-Branch, lokale Aenderungen und bestehende Konflikte vor der Ausfuehrung, der Git CLI Wrapper erlaubt nur `git merge --no-edit <branch>`, und UI/Desktop-Bridge zeigen Fortschritt, Erfolg, Git-Fehler, Konfliktzustand, Git Output und Status-Refresh. Fokussierte Merge-/Desktop-Bridge-Tests sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build wurde nicht ausgefuehrt, weil `cargo` in dieser Umgebung nicht installiert ist.
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

### T48 - Tauri-Shell fuer bestehende Full UI anlegen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T33`, `T4`
- Definition of Done: Ein Tauri-Projektgeruest startet die bestehende Web-/HTML-UI in einem Desktop-Fenster; Dev- und Build-Startpunkte sind dokumentiert; Fenster-, Asset- und Security-Konfiguration sind auf die Full UI beschraenkt; der Renderer erhaelt keine direkte Node-, Shell- oder freie Dateisystem-Schnittstelle; bestehende leere und fehlerhafte Startzustaende bleiben sichtbar.
- Implementierungsnotiz: Zuerst die Shell ohne neue Produktflaeche anlegen. Bestehende UI-Dateien wiederverwenden und keine Desktop-spezifischen Features in den Renderer mischen, bevor der Bridge-Vertrag steht.
- Notiz: 2026-06-09 14:53 CEST umgesetzt: Tauri-v2-Projektgeruest in `src-tauri/` angelegt, Desktop-Startpunkte in `package.json` und `docs/desktop-shell.md` dokumentiert, Asset-Kopie auf `index.html` plus `src/` nach `desktop-dist/` begrenzt und Security/Capability ohne Shell-, Dateisystem- oder Git-Bridge-Permissions gesetzt. Fokussierter Desktop-Shell-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Tauri-Build selbst wurde nicht ausgefuehrt, da Abhaengigkeiten nicht installiert sind.
- Review-Ergebnis: Bestanden am 2026-06-09. Tauri-v2-Projektgeruest, Desktop-Startpunkte, Asset-Kopie nach `desktop-dist`, Hauptfenster-Konfiguration und Security/Capability ohne Shell-, Dateisystem- oder Git-Bridge-Permissions sind vorhanden; die bestehende Full UI bleibt als `index.html` plus `src/` die einzige Renderer-Flaeche. Fokussierter Desktop-Shell-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; der native Tauri-Build wurde mangels installierter Abhaengigkeiten nicht ausgefuehrt.
- Offene Review-Punkte: -

### T49 - Kontrollierten Desktop-Bridge-Vertrag fuer Git und Repository-State bauen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T6`, `T7`, `T8`, `T48`
- Definition of Done: Die Tauri-Bridge bietet nur explizit whitelisted Commands fuer Repository oeffnen, Git-Status, Diff, Datei-/Hunk-/Commit-/Branch-/Sync-/Stash-Aktionen und Git Output; alle Git-Ausfuehrungen nutzen den bestehenden Git CLI Wrapper und die Operation Queue; stdout, stderr, Exit-Code und strukturierte Fehler folgen dem dokumentierten Fehlervertrag; Renderer-Code nutzt eine gemeinsame Bridge-Fassade statt direkter Shell- oder Dateisystemzugriffe.
- Implementierungsnotiz: Bridge-API klein und versionskontrollbezogen halten. Keine freien Command-Runner, keine generische Filesystem-API und keine Token-Werte an den Renderer liefern.
- Notiz: 2026-06-09 15:10 CEST umgesetzt: `src/desktop-bridge.js` definiert die gemeinsame Renderer-Fassade, whitelisted Tauri-Command-Namen und ein testbares Backend, das Repository-State, Diff sowie Datei-/Hunk-/Commit-/Branch-/Sync-/Stash-Aktionen ueber `GitOperationQueue` und den bestehenden Git Wrapper ausfuehrt; `src/main.js` bevorzugt die Fassade vor Web-/CommonJS-Fallbacks. 2026-06-09 15:45 CEST Review-Punkte adressiert: `src-tauri/src/lib.rs` registriert die zehn erlaubten `#[tauri::command]`-Handler inklusive `invoke_handler(tauri::generate_handler![...])`; die Handler starten einen persistenten `src/desktop-bridge-worker.js`, der `createDesktopBridgeBackend()` mit bestehendem Git CLI Wrapper und `GitOperationQueue` nutzt. `src/desktop-bridge.js` kapselt Tauri-Payloads als `{ request: ... }`, `docs/desktop-bridge.md` dokumentiert native Handler und Worker-Vertrag, und `tests/desktop-bridge.test.js` prueft Handler-Registrierung sowie Worker-Queue-Handoff. 2026-06-09 16:08 CEST Review-Punkt erneut adressiert: Native Worker-Starts und der Handoff-Test nutzen jetzt `--preserve-symlinks` und `--preserve-symlinks-main`, sodass `src/desktop-bridge-worker.js` in der aktuellen Desktop-/Testumgebung startet und die Queue-Anfrage beantwortet. Fokussierter Bridge-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` in dieser Umgebung nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-09. Die Desktop-Bridge bietet nur die explizit whitelisted Repository-Commands fuer Open, Status, Diff, Datei-/Hunk-/Commit-/Branch-/Sync-/Stash-Aktionen und Git Output; Renderer-Code nutzt die gemeinsame Bridge-Fassade, Tauri registriert die erlaubten Handler, und der persistente Worker fuehrt die bestehenden Repository-Module ueber `GitOperationQueue` und Git CLI Wrapper aus. Fokussierter Bridge-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` in dieser Umgebung nicht installiert ist.
- Offene Review-Punkte: -

### T50 - Native Ordnerdialoge und Desktop-Watcher verdrahten

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T9`, `T39`, `T40`, `T49`
- Definition of Done: Repo oeffnen, Clone-Zielordner und Publish-Zielordner nutzen native Desktop-Dialoge ueber erlaubte Bridge-Commands; abgebrochene, ungueltige und nicht mehr vorhandene Pfade werden lesbar behandelt; pro geoeffnetem Repository startet ein Desktop-faehiger Status-Watcher und wird beim Tab-Schliessen beendet; Watcher-Refreshes bleiben entprellt und kollidieren nicht mit laufenden Git-Operationen.
- Implementierungsnotiz: Dialoge duerfen nur konkrete Pfade fuer erlaubte Git-Flows liefern. Watcher und Refresh sollen denselben Repository-State wie die Full UI aktualisieren.
- Notiz: 2026-06-09 17:48 CEST umgesetzt: Open-, Clone-, GitHub-Clone- und Publish-Dialoge haben Desktop-Browse-Aktionen, die ueber explizite Tauri-Bridge-Commands native Ordnerdialoge nutzen und Abbruch, ungueltige sowie nicht vorhandene Pfade lesbar behandeln. Die Desktop-Bridge bietet Watch-Start/Get/Stop-Commands im persistenten Worker, startet pro Repository-Kontext einen `RepositoryStatusWatcher`, liefert Snapshot/State/Fehler an den Renderer und schliesst den Watcher beim Tab-Schliessen. Fokussierte Desktop-/Renderer-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` in dieser Umgebung nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-09. Native Open-/Clone-/GitHub-Clone-/Publish-Ordnerdialoge sind als whitelisted Tauri-Commands registriert, liefern nur konkrete Ordnerpfade bzw. Abbruch-/Fehlerzustaende zurueck und werden im Renderer in die passenden Formularfelder uebernommen. Desktop-Watcher werden pro Repository-Kontext ueber den persistenten Bridge-Worker gestartet, liefern Snapshot/State/Fehler an den Renderer, nutzen den bestehenden debounced `RepositoryStatusWatcher` und werden beim Tab-Schliessen gestoppt. Fokussierte Desktop-/Renderer-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` in dieser Umgebung nicht installiert ist.
- Offene Review-Punkte: -

### T52 - Desktop GitHub Auth-Bridge und Secure Token Store bauen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T38`, `T49`
- Definition of Done: Die Tauri-/Backend-Bridge bietet explizit whitelisted GitHub-Auth-Commands fuer Device Login starten, Login-Status/Polling, Login abbrechen, Logout und Auth-Status laden; Tokens werden ueber den in `docs/github-auth-decision.md` beschriebenen SecureTokenStore gelesen, geschrieben und geloescht; Token-Werte erscheinen nie im Renderer, in `localStorage`, Repository-Kontexten, Remote-URLs oder Git-Argumenten; fehlende Auth, fehlende Scopes, widerrufene Tokens, Rate-Limits, Netzwerkfehler, Login-Ablauf und nicht verfuegbarer Secure Storage folgen dem dokumentierten Fehlervertrag.
- Implementierungsnotiz: GitHub OAuth Device Flow und OS-Credential-Store zuerst sauber kapseln. Der Renderer darf nur Status, User Code, Verification URL, Ablaufzeit und lesbare Fehler sehen; kein eigenes SSH-Key-Management und keine GitHub-Dashboard-Funktionen aufnehmen.
- Notiz: 2026-06-09 18:55 CEST Review-Punkte adressiert: `createDesktopBridgeBackend()` erstellt im Default-Pfad jetzt ein `GitHubAuthBridgeBackend` mit backend-only `GitHubDeviceFlow` und `DesktopSecureTokenStore`; der Device Flow nutzt die GitHub-OAuth-Endpunkte im Worker, optionalen Systembrowser-Start und tokenfreies Renderer-Polling. `DesktopSecureTokenStore` liest/schreibt/loescht Tokens ueber einen OS-Credential-Store-Adapter mit separater nicht-sensitiver Metadatei; Windows Credential Manager, macOS Keychain und Linux Secret Service/libsecret sind als Plattformpfade gekapselt. `docs/desktop-bridge.md` dokumentiert Default-Pfad und OAuth-Client-ID-Konfiguration. Fokussierte GitHub-/Desktop-Bridge-Tests bestanden mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Die Tauri-/Backend-Bridge stellt die explizit whitelisted GitHub-Auth-Commands fuer Auth-Status, Device-Login Start/Status/Polling/Cancel, Login und Logout bereit; `createDesktopBridgeBackend()` verdrahtet im Default-Pfad `GitHubAuthBridgeBackend`, backend-only `GitHubDeviceFlow` und `DesktopSecureTokenStore`. Renderer-Antworten normalisieren Auth- und Device-Login-Status tokenfrei, `DesktopSecureTokenStore` trennt OS-Credential-Store-Token von nicht-sensitiver Metadatei, und fehlende Auth/Scopes, widerrufene Tokens, Rate-Limits, Netzwerkfehler, Login-Ablauf und nicht verfuegbarer Secure Storage folgen dem dokumentierten Fehlervertrag. Fokussierte Auth-/Bridge-/Renderer-Tests bestanden mit Preserve-Symlink-Flags; die volle Node-Suite wird nur durch die uncommitted `T32`-Merge-Regression blockiert. Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T53 - Desktop GitHub-Repository-Liste und Clone-Flow verdrahten

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T40`, `T50`, `T52`
- Definition of Done: Clone from GitHub nutzt in der Desktop-Full-UI ausschliesslich die Tauri-/Backend-Bridge fuer Auth-Status, User-Repositories, Repository-Suche und Clone-Start; Owner/Name, Beschreibung, Sichtbarkeit, Stars, Clone-URL und private/public Indikator bleiben vor Ausfuehrung sichtbar; Zielordner kommt aus dem nativen Dialog-Flow; Clone-Fortschritt, Erfolg, SSH-/HTTPS-/Auth-/API-/Netzwerkfehler und erfolgreiches Oeffnen als Repository-Tab sind im Repository-Kontext und Git Output sichtbar.
- Implementierungsnotiz: URL-Clone bleibt ohne GitHub Login moeglich. GitHub-Clone liefert nur Repository-Metadaten und Clone-URL an den bestehenden Clone-Runner; Tokens nicht in Git-URLs oder Git-Argumente schreiben.
- Notiz: 2026-06-09 17:43 CEST umgesetzt: Die Desktop-Bridge bietet jetzt whitelisted GitHub-Repository-Commands fuer User-Repository-Liste und Repository-Suche sowie einen whitelisted Clone-Runner-Command; Tauri registriert `github_list_user_repositories`, `github_search_user_repositories` und `repository_run_clone_action`. Der persistente Worker delegiert GitHub-Metadaten an den backend-internen GitHub-Client, normalisiert sie tokenfrei und fuehrt Clone-Starts ueber den bestehenden Clone-Runner mit `GitOperationQueue`/Git CLI Wrapper aus. `src/main.js` routet den GitHub-Clone-Dialog im Desktop ueber diese Bridge-Methoden und nutzt weiter den nativen Zielordner-Flow.
- Review-Ergebnis: Bestanden am 2026-06-09. Die Desktop-Full-UI nutzt fuer Clone from GitHub die Tauri-/Backend-Bridge fuer Auth-Status, User-Repository-Liste, Repository-Suche und Clone-Start; Repository-Metadaten bleiben vor Ausfuehrung sichtbar, der Zielordner kommt aus dem nativen Dialog-Flow, und der Clone-Runner laeuft ueber `GitOperationQueue`/Git CLI Wrapper ohne Token in Git-URLs oder Git-Argumenten. Fokussierte Clone-/GitHub-/Desktop-Bridge-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build wurde nicht ausgefuehrt, weil `cargo` in dieser Umgebung nicht installiert ist.
- Offene Review-Punkte: -

### T54 - Desktop Publish-to-GitHub ueber Backend-Bridge abschliessen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T41`, `T42`, `T43`, `T50`, `T52`
- Definition of Done: Publish to GitHub nutzt in der Desktop-Full-UI ausschliesslich die Tauri-/Backend-Bridge fuer Auth-Status, GitHub-Repository-Erstellung, Publish-Vorbedingungen, native Zielordnerauswahl und Publish-Runner; Repository-Name, Beschreibung, private/public Auswahl, lokale Git-Initialisierung, Remote-Pruefung und Public-Publish-Bestaetigung sind vor Ausfuehrung sichtbar; Fortschritt, Erfolg, GitHub-Fehler, Git-Fehler, Remote-Konflikte und rohe Ausgaben sind im UI und Git Output sichtbar; Tokens bleiben backend-intern und werden nie in Remote-URLs oder Git-Argumente geschrieben.
- Implementierungsnotiz: Bestehende Web-Publish-Logik wiederverwenden und nur die Desktop-Ausfuehrung ueber erlaubte Bridge-Commands fuehren. HTTPS/Git Credential Manager priorisieren; kein Org-Admin-, Issue- oder Dashboard-Scope.
- Notiz: 2026-06-09 20:08 CEST umgesetzt: Die Desktop-Bridge bietet jetzt whitelisted Publish-Commands fuer `preparePublishPreflight` und `runPublishAction`, Tauri registriert `repository_prepare_publish_preflight` und `repository_run_publish_action`, und `src/main.js` bevorzugt diese Bridge-Methoden fuer den Desktop-Publish-Flow. Die Bridge nutzt die bestehenden Publish-Module, fuehrt Git-Schritte ueber `GitOperationQueue`/Git CLI Wrapper aus, erstellt GitHub-Repositories ueber den backend-internen Auth-Client und normalisiert Publish-Antworten tokenfrei. Fokussierter Desktop-Bridge-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build wurde nicht ausgefuehrt, weil `cargo` in dieser Umgebung nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-09. Publish to GitHub bevorzugt in der Desktop-Full-UI die whitelisted Tauri-/Backend-Bridge fuer Auth-Status, Publish-Preflight und Publish-Runner; lokale Git-Schritte laufen ueber `GitOperationQueue`/Git CLI Wrapper, GitHub-Repository-Erstellung nutzt den backend-internen Auth-Client, und Renderer-Payloads enthalten nur Pfad, Name, Beschreibung, Sichtbarkeit sowie Init-/Public-Bestaetigungen. Fokussierte Publish-/GitHub-/Desktop-Bridge-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build wurde nicht ausgefuehrt, weil `cargo` in dieser Umgebung nicht installiert ist.
- Offene Review-Punkte: -

### T58 - Publish-Git-Output fuer Repository-Metadaten lesbarer machen

- Status: `done`
- Prioritaet: `P3`
- Abhaengigkeiten: `T23`, `T54`
- Definition of Done: Publish-bezogene Git-Output-Details zeigen erstellte oder verwendete GitHub-Repositories als lesbaren Owner/Name, Sichtbarkeit und URL statt als rohes Objekt; Web- und Desktop-Publish-Pfade nutzen dieselbe Formatierung; rohe technische Details bleiben bei Fehlern einsehbar, enthalten aber keine Token-Werte oder auth-haltigen Remote-URLs; ein fokussierter Test oder dokumentierter Smoke-Schritt deckt einen erfolgreichen Publish-Output und einen Publish-Fehler ab.
- Implementierungsnotiz: Das ist eine kosmetische Nacharbeit am Output-Text, keine Aenderung an Publish-Vorbedingungen, Remote-Schutz, Auth oder Push-Verhalten. Bestehende tokenfreie Repository-Normalisierung aus `T54` beibehalten.
- Notiz: 2026-06-09 umgesetzt: Git-Output-Details formatieren Publish-Repositories jetzt als Owner/Name, Sichtbarkeit und URL statt als rohes Objekt; angezeigte Command-, Detail-, stdout-/stderr- und Message-Texte entfernen auth-haltige HTTPS-URL-Userinfo. VM-Renderer-Tests decken erfolgreichen Publish-Output und Publish-Fehler mit auth-haltigen Remote-URLs ab; die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags.
- Review-Ergebnis: Bestanden am 2026-06-09. Publish-bezogene Git-Output-Details zeigen Repository-Metadaten als lesbaren Owner/Name, Sichtbarkeit und URL statt als rohes Objekt; Command-, Detail-, stdout-/stderr- und Message-Texte entfernen auth-haltige HTTPS-URL-Userinfo. Web- und Desktop-Publish-Pfade nutzen dieselbe Git-Output-Formatierung. Fokussierte Renderer-Tests fuer erfolgreichen Publish-Output und Publish-Fehler sowie die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build wurde nicht ausgefuehrt, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T55 - Desktop PR-, Checks- und Review-Bridge verdrahten

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T46`, `T47`, `T29`, `T30`, `T52`
- Definition of Done: Die Desktop-Full-UI nutzt fuer GitHub-Remote-Erkennung, vorhandene PRs, PR-Erstellung, PR-Checks, Check-Links, Review-Kommentare und Issue-Links ausschliesslich die Tauri-/Backend-Bridge; Base/Head, Titel, Beschreibung, erkannte PR, Check-Zustaende und Review-/Issue-Links bleiben wie in der Web-Version sichtbar; fehlende Auth, fehlende Remote-Zuordnung, fehlende Scopes, Rate-Limits, Berechtigungs-, Netzwerk- und API-Fehler sind strukturiert im Repository-Kontext und Git Output sichtbar.
- Implementierungsnotiz: GitHub-Funktionen bleiben auf Versionskontrolle begrenzt. Keine Issue-Verwaltung, Notifications, Workflow-Steuerung, CI-Log-Ansicht oder GitHub-Dashboard-Funktionen aufnehmen.
- Notiz: 2026-06-09 umgesetzt: Die Desktop-Bridge bietet jetzt whitelisted PR-/Checks-/Review-Commands fuer vorhandene PRs, PR-Erstellung, Check-/Status-Lookup und Review-/Issue-Kontext; Tauri registriert die vier Commands, `GitHubAuthBridgeBackend` delegiert sie an den backend-internen GitHub-Client, und `src/main.js` routet die bestehende PR-UI im Desktop ueber diese Bridge-Methoden. Antworten werden tokenfrei normalisiert; fokussierte Desktop-Bridge-Tests decken PR-, Check- und Review-Kontext ohne Token-Leakage ab.
- Review-Ergebnis: Bestanden am 2026-06-09. Die Desktop-Full-UI bezieht GitHub-PR-, Check- und Review-/Issue-Kontext ueber die whitelisted Tauri-/Backend-Bridge-Methoden; Tauri registriert die zugehoerigen Commands, und `GitHubAuthBridgeBackend` delegiert tokenfrei an den backend-internen GitHub-Client. Base/Head, Titel, Beschreibung, erkannte PR, Check-Zustaende und Review-/Issue-Links bleiben in der bestehenden PR-UI sichtbar; fokussierte Desktop-Bridge-Tests decken PR-, Check- und Review-Kontext ohne Token-Leakage ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; Rust-Format/Build wurde nicht ausgefuehrt, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T56 - Desktop Full-UI-Paritaet gegen Web-Version abschliessen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T49`, `T50`, `T52`, `T53`, `T54`, `T55`
- Definition of Done: Die Desktop-Full-UI erreicht funktionale Paritaet zur bestehenden Web-Version fuer Open, URL-Clone, Clone from GitHub, Publish, Source Control, Diff, Datei-/Hunk-Aktionen, Commit/Amend, Branch, Sync, Stash, PR, Checks und Review-Kommentare; Renderer-Code nutzt fuer Desktop-Flows keine direkte Shell-, freie Dateisystem-, Token- oder GitHub-API-Schnittstelle; automatisierte oder dokumentierte Smoke-Schritte decken die Paritaetsflows inklusive Fehlerfaellen ab; verbleibende Desktop-spezifische Luecken sind in einer Planungsnotiz oder einem Desktop-Dokument konkret benannt.
- Implementierungsnotiz: Das ist ein Integrations-/Review-Task, kein Ort fuer neue Produktflaechen. Wenn dabei grosse Luecken auffallen, neue konkrete Tasks anlegen statt die Paritaetsaufgabe weiter aufzublaehen.
- Notiz: 2026-06-09 umgesetzt: `docs/desktop-full-ui-parity.md` dokumentiert automatisierte Abdeckung und manuelle Smoke-Schritte fuer Open, URL-Clone, Clone from GitHub, Publish, Source Control, Diff, Datei-/Hunk-Aktionen, Commit/Amend, Branch, Sync, Stash, PR, Checks und Review-Kommentare inklusive Fehlerfaellen. Zusaetzlicher Renderer-Test stellt sicher, dass Desktop-Publish-Preflight ueber die Bridge laeuft und keine Renderer-GitHub-Client-Objekte in die Desktop-Anfrage uebergibt. Fokussierter Renderer-Test und vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags. Keine neue Produktluecke identifiziert; Live-Tauri-Smoke/Rust-Build bleibt blockiert, weil `cargo` in dieser Umgebung nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-09. Desktop-Full-UI-Paritaet ist ueber die whitelisted Desktop-Bridge fuer Open, URL-Clone, Clone from GitHub, Publish, Source Control, Diff, Datei-/Hunk-Aktionen, Commit/Amend, Branch, Sync, Stash, PR, Checks und Review-Kommentare dokumentiert und automatisiert abgesichert; Renderer-Desktop-Flows uebergeben keine direkte Shell-, freie Dateisystem-, Token- oder GitHub-API-Schnittstelle. Fokussierte Desktop-/Renderer-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build und Live-Tauri-Smoke konnten nicht ausgefuehrt werden, weil `cargo` in dieser Umgebung nicht installiert ist.
- Offene Review-Punkte: -

### T44 - Floating Window Modus konzipieren

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T33`, `T14`, `T16`, `T23`
- Definition of Done: Ein kurzes Konzept dokumentiert Layout, sichtbare Felder, erlaubte Aktionen, Fehler-/Busy-Zustaende, Warnungsweiterleitung, Fokusverhalten und die gemeinsame State-/Queue-Nutzung fuer das Floating Window; enthalten sind Repository, Branch, Change-Zaehler, Status/Fehler sowie kompakte Aktionen fuer Commit, Commit and Push, Push und Pull/Sync; ausgeschlossen bleiben Dashboard-, Terminal-, Projektbaum- und Task-Runner-Funktionen.
- Implementierungsnotiz: Erst den kompakten Modus festlegen, dann bauen. Das Konzept muss benennen, welche Aktionen direkt im Floating Window laufen und welche in die Full UI fuehren.
- Notiz: 2026-06-09 15:23 CEST umgesetzt: `docs/floating-window-concept.md` dokumentiert Layout, sichtbare Felder, direkte Floating-Window-Aktionen, Full-UI-Weiterleitungen, Fehler-/Busy-Zustaende, Warnungsweiterleitung, Fokusverhalten sowie gemeinsame Repository-State-/Queue-Nutzung. Ausgeschlossene Dashboard-, Terminal-, Projektbaum-, Task-Runner- und freie Command-Runner-Funktionen sind explizit abgegrenzt.
- Review-Ergebnis: Bestanden am 2026-06-09. `docs/floating-window-concept.md` dokumentiert Layout, sichtbare Felder, erlaubte direkte Aktionen, Full-UI-Weiterleitungen, Fehler-/Busy-Zustaende, Warnungsweiterleitung, Fokusverhalten und gemeinsame Repository-State-/Queue-Nutzung; Dashboard-, Terminal-, Projektbaum-, Task-Runner- und freie Command-Runner-Funktionen sind explizit ausgeschlossen.
- Offene Review-Punkte: -

### T45 - Floating Window Modus bauen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T56`, `T44`
- Definition of Done: Die Desktop-App bietet gemaess `T44` ein kleines Floating Window fuer den aktiven Repository-Kontext; es zeigt Repository, Branch, Change-Zaehler, Status/Fehler und kompakte Aktionen fuer Commit, Commit and Push, Push und Pull/Sync; alle Aktionen nutzen denselben Repository-State und dieselbe Operation Queue wie die Full UI und fuehren nicht zu doppelten Git-Operationen oder versteckten Fehlern.
- Implementierungsnotiz: Floating Window ist der kompakte Desktop-Modus. Es soll schnell erreichbar sein und wenig Flaeche einnehmen, aber keine wichtigen Git-Fehler verstecken.
- Notiz: 2026-06-09 umgesetzt: Die Renderer-UI bietet einen Floating-Window-Modus fuer den aktiven Repository-Kontext mit Repository-/Branch-/Upstream-/Divergenz-Anzeige, Change-Zaehlern, kompakter Commit-Message, Commit, Commit and Push, Push, Pull/Sync, Refresh und Open-Full-UI-Aktion. Die Aktionen rufen dieselben Commit-/Sync-/Refresh-Pfade wie die Full UI auf und nutzen damit denselben Repository-State, dieselbe Desktop-Bridge und dieselbe Operation Queue; fokussierter Renderer-Test deckt Rendering sowie geteilte Commit-/Push-Runner ab. Native Fensterumschaltung bleibt fuer `T36`.
- Review-Ergebnis: Bestanden am 2026-06-09. Der Floating-Window-Modus zeigt den aktiven Repository-Kontext mit Repository, Branch, Upstream/Divergenz, Change-Zaehlern, Status/Fehler sowie Commit, Commit and Push, Push, Pull/Sync, Refresh und Open-Full-UI-Aktion. Die Aktionen laufen ueber dieselben Commit-/Sync-/Refresh-Pfade wie die Full UI und nutzen damit denselben Repository-State, dieselbe Desktop-Bridge und dieselbe Operation Queue; fokussierte Renderer-/Desktop-Bridge-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags. Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T36 - Umschalten zwischen Floating Window und Full UI umsetzen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T56`, `T45`
- Definition of Done: Nutzer kann aus dem Floating Window in die Full UI wechseln und zurueck; Repository-Kontext, laufende Operationen, Fehler, Tabs und lokale UI-Zustaende bleiben konsistent; Umschalten fuehrt nicht zu doppelten Git-Operationen oder verlorenen Statusupdates.
- Implementierungsnotiz: Full UI ist die Web-Version in Desktop-Shell. Floating Window und Full UI muessen denselben Repository-State nutzen, nicht zwei voneinander abweichende Modelle.
- Notiz: 2026-06-09 umgesetzt: Der Renderer schaltet zwischen Floating Window und Full UI ueber denselben Repository-/Tab-State um und ruft in der Desktop-App den whitelisted Tauri-Command `desktop_set_window_mode` fuer Groesse, Mindestgroesse und Always-on-top-Status auf. Der native Command startet keine zweite UI-Instanz und fuehrt keine Git-Operationen aus; ein fokussierter Renderer-Test deckt aktiven Tab, laufenden Queue-Snapshot, Commit-Message und den Rueckwechsel ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-09. Renderer-Umschaltung zwischen Floating Window und Full UI arbeitet auf demselben Repository-/Tab-State, erhaelt aktiven Tab, laufenden Queue-Snapshot, Fehler und Commit-Message und nutzt den whitelisted Desktop-Bridge-Command `desktop_set_window_mode`. Der native Tauri-Command passt nur Groesse, Mindestgroesse und Always-on-top des bestehenden Fensters an und startet keine zweite UI-Instanz oder Git-Operation. Fokussierte Renderer-/Desktop-Bridge-Tests und die vollstaendige Node-Test-Suite bestanden mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T57 - Dokumentation aktualisieren und auf Englisch konsolidieren

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T24`, `T33`, `T48`, `T49`, `T56`, `T45`, `T36`
- Definition of Done: `README.md` und zentrale Dokumentation sind auf den aktuellen Produkt- und Implementierungsstand gebracht und konsistent auf Englisch formuliert; beschrieben sind Web-Prototyp, Tauri-Desktop-Ziel, Full UI, Floating Window, Git/GitHub-Funktionsumfang, Scope-Grenzen, Setup/Start, Teststrategie und bekannte Einschraenkungen.
- Implementierungsnotiz: Vor allem `README.md`, `docs/architecture.md`, `docs/plan.md`, Desktop-Dokumente und relevante Checklisten pruefen. Deutsche Planungsnotizen duerfen als historische Arbeitsnotizen bestehen bleiben, aber nutzernahe Dokumentation soll Englisch sein. Keine Produktfeatures bei der Dokumentationsarbeit neu erfinden.
- Notiz: 2026-06-09 umgesetzt: `README.md`, Produktplan, Architektur, Scope-Gates, Desktop-Shell-/Runtime-/Bridge-Dokumente, Floating-Window-Konzept, Desktop-Paritaetscheckliste, Core-Flow-Review-Checkliste und GitHub-Auth-Entscheidung wurden auf Englisch konsolidiert und auf den aktuellen Web-/Tauri-/Full-UI-/Floating-Window-Stand gebracht. Setup, Teststrategie und bekannte Cargo/Tauri-Einschraenkungen sind dokumentiert; historische Arbeitsnotizen bleiben unveraendert.
- Review-Ergebnis: Bestanden am 2026-06-09. `README.md` und zentrale Produkt-/Architektur-/Desktop-Dokumente sind auf Englisch konsolidiert und decken Web-Prototyp, Tauri-Desktop-Ziel, Full UI, Floating Window, Git/GitHub-Funktionsumfang, Scope-Grenzen, Setup/Start, Teststrategie und bekannte Cargo/Tauri-Einschraenkungen ab. Die vollstaendige Node-Test-Suite bestand mit Preserve-Symlink-Flags; Rust-Format/Build konnte nicht ausgefuehrt werden, weil `cargo` in dieser Umgebung nicht installiert ist.
- Offene Review-Punkte: -

### T59 - GitHub Actions CI fuer Tests und Builds einrichten

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T24`, `T48`, `T56`
- Definition of Done: Repository enthaelt einen GitHub Actions Workflow, der auf Pull Requests und Pushes laeuft; Node-/Frontend-Tests, relevante Lint-/Format-/Smoke-Checks und Tauri/Rust-Build- oder Check-Schritte sind abgedeckt; fehlende Systemabhaengigkeiten fuer Tauri werden im Workflow installiert oder klar dokumentiert; CI-Status ist in README oder Dokumentation beschrieben.
- Implementierungsnotiz: Workflow unter `.github/workflows/` anlegen. Erst vorhandene Skripte aus `package.json` nutzen; falls Skripte fehlen, kleine klare Scripts ergaenzen. Keine Release-/Publishing-Automation in diesem Task bauen, nur Build/Test/Check.
- Notiz: 2026-06-09 umgesetzt: `.github/workflows/ci.yml` laeuft auf Pushes und Pull Requests, installiert Node-Abhaengigkeiten, fuehrt `npm run ci:node` fuer Desktop-Asset-Smoke und Node-Tests aus, installiert Tauri-Linux-Systemabhaengigkeiten und prueft die Tauri-Rust-Crate mit `cargo fmt --check` und `cargo check`. `package.json` enthaelt jetzt klare `test`- und `ci:node`-Skripte und nutzt die bestehenden Preserve-Symlink-Flags fuer Node-Checks; README beschreibt den CI-Status und die lokalen Check-Kommandos.
- Review-Ergebnis: Bestanden am 2026-06-09. `.github/workflows/ci.yml` laeuft auf Pushes und Pull Requests, deckt Node-Tests und Desktop-Asset-Smoke ueber `npm run ci:node` ab und prueft die Tauri-Rust-Crate mit installierten Linux-Systemabhaengigkeiten per `cargo fmt --check` und `cargo check`. `package.json` enthaelt klare `test`-/`ci:node`-Skripte, und README beschreibt CI-Status sowie lokale Check-Kommandos. `npm run ci:node` bestand lokal; Rust-Format/Check konnte lokal nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T60 - Fehlgeschlagenen CI-Run nach T59 beheben

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T59`
- Definition of Done: Der letzte fehlgeschlagene GitHub-Actions-Run ist analysiert und die Ursachen sind behoben; `npm run ci:node` besteht lokal oder im naechsten CI-Run; `cargo fmt --check` fuer `src-tauri` besteht im CI; der naechste Push-/PR-CI-Run auf `main` ist gruen oder verbleibende externe Blocker sind konkret dokumentiert.
- Implementierungsnotiz: CI-Run `27258539853` vom 2026-06-10 ist weiter fehlgeschlagen. Die vorherigen Blocker sind behoben: `Node tests and desktop assets` ist gruen, `cargo fmt --check` ist gruen, `desktop-dist` wird im Tauri-Rust-Job vor `cargo check` erzeugt, und die Icon-Dateien sind vorhanden. Der verbleibende Fehler liegt im Schritt `Check Tauri crate`: `cargo check` scheitert bei `tauri::generate_context!()` wegen `unknown field icon`, weil Tauri v2 das Feld `icon` im Window-Konfigurationsobjekt nicht akzeptiert. Das Window-Icon-Feld muss aus `app.windows[]` entfernt bleiben; Icons werden ueber `bundle.icon` abgesichert. Keine CI-Abschwaechung vornehmen; der Rust-Check soll die echte Tauri-Konfiguration inklusive Bundle-Icons pruefen.
- Notiz: 2026-06-10 09:06 CEST umgesetzt: `src-tauri/icons/` enthaelt jetzt die von Tauri erwarteten PNG-Icon-Dateien, und `src-tauri/tauri.conf.json` referenziert das Window-Icon sowie die Bundle-Icon-Liste explizit. `tests/desktop-shell.test.js` prueft die Icon-Konfiguration und vorhandene Dateien. `npm run ci:node` und `git diff --check` bestanden lokal; `cargo fmt --check`/`cargo check` konnten lokal nicht ausgefuehrt werden, weil `cargo`/`rustfmt` in dieser Umgebung nicht installiert sind. Der naechste GitHub-Actions-Run muss `Tauri Rust check` remote bestaetigen.
- Notiz: 2026-06-10 09:18 CEST umgesetzt: `src-tauri/tauri.conf.json` entfernt das Tauri-v2-ungueltige `icon`-Feld aus `app.windows[0]`; die Bundle-Icon-Liste bleibt unter `bundle.icon` erhalten. `tests/desktop-shell.test.js` prueft jetzt explizit, dass das Window-Objekt kein `icon`-Feld enthaelt, und dass alle Bundle-Icons vorhanden sind. `npm run ci:node` bestand lokal mit 116/116 Tests; `git diff --check` bestand. `cargo fmt --check`/`cargo check` konnten lokal nicht ausgefuehrt werden, weil `cargo`/`rustfmt` in dieser Umgebung nicht installiert sind.
- Review-Ergebnis: Bestanden am 2026-06-10 09:12 CEST. GitHub-Actions-Run `27259460202` fuer Commit `9181843 Fix Tauri v2 icon config for CI` ist gruen; `Node tests and desktop assets`, `cargo fmt --check`, Desktop-Asset-Erzeugung und `cargo check` im `Tauri Rust check` bestanden.
- Offene Review-Punkte: -

### T62 - Publish-Preflight fuer Ordner ohne Git korrekt blockieren

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T42`, `T43`, `T23`, `T58`
- Definition of Done: Publish-Preflight fuer einen Ordner ohne Git meldet nach bestaetigtem Git init nicht faelschlich `ready`, solange danach kein Initial Commit existiert; die UI fuehrt klar in den Commit-Flow oder blockiert Publish mit `needsCommit`, bevor der Publish-Runner gestartet werden kann; `runPublishAction` und Preflight liefern konsistente Meldungen fuer Ordner ohne Git, bestaetigtes Init und fehlende Commits; fokussierte Tests decken den Non-Git-Ordner mit `initIfNeeded: true` sowie den anschliessenden fehlenden-Commit-Fall ab.
- Implementierungsnotiz: Preflight darf weiterhin kein `git init`, Commit oder Publish automatisch ausfuehren. Die Aenderung soll nur die Bereitschafts-/Blockierungslogik korrigieren: bestaetigtes Init ist eine erlaubte spaetere Runner-Aktion, ersetzt aber keinen Initial Commit. Bestehende Public-Publish-, Remote-Schutz- und Git-Output-Formatierung beibehalten.
- Notiz: 2026-06-10 09:53 CEST umgesetzt: Publish-Preflight fuer Non-Git-Ordner mit `initIfNeeded: true` meldet nicht mehr `ready`, sondern blockiert mit `needsGitInit`, `needsCommit` und `no-commits`, bis ein Initial Commit existiert. Die Publish-UI zeigt diesen blockierten Zustand ohne Runner-Wartemeldung; `runPublishAction` bleibt konsistent und erstellt kein GitHub-Repository, wenn ein bestaetigtes Init danach weiterhin keinen Commit hat. Fokussierter Publish-Test und `npm run ci:node` bestanden lokal mit 117/117 Tests.
- Review-Ergebnis: Bestanden am 2026-06-10. Preflight blockiert Non-Git-Ordner mit bestaetigtem `initIfNeeded` weiterhin mit `needsGitInit`, `needsCommit` und `no-commits`, ohne `git init` oder Publish auszufuehren; `runPublishAction` prueft nach bestaetigtem Init erneut auf fehlende Commits und erstellt dann kein GitHub-Repository. Fokussierte Publish-/Renderer-Tests und `npm run ci:node` bestanden lokal mit 117/117 Tests.
- Offene Review-Punkte: -

### T63 - macOS-Keychain-Speicherung ohne Token-Prozessargumente umsetzen

- Status: `done`
- Prioritaet: `P2`
- Abhaengigkeiten: `T37`, `T38`, `T52`
- Definition of Done: Der macOS SecureTokenStore schreibt GitHub-Tokens in die Keychain, ohne den Token als Prozessargument sichtbar zu machen; Windows Credential Manager und Linux Secret Service behalten ihre tokenarmen Pfade bei; Fehler bei nicht verfuegbarem Keychain-/Credential-Store bleiben als `secure-storage-unavailable` strukturiert; ein fokussierter Test stellt sicher, dass der macOS-Credential-Adapter beim Schreiben kein Token-Argument an `security` oder einen anderen Prozess uebergibt.
- Implementierungsnotiz: Aktuell nutzt der macOS-Adapter `security add-generic-password ... -w <token>`, wodurch der Token in der Prozess-Argumentliste landen kann. Bevorzugt eine stdin-basierte oder native Backend-Loesung verwenden; falls das `security` CLI keine passende stdin-Variante bietet, eine kleine native Tauri/Rust-Keychain-Schicht oder ein sicherer anderer Adapter pruefen. Keine Token in Renderer-State, Git-Argumente, Remote-URLs, Logs oder Git Output schreiben.
- Notiz: 2026-06-10 10:17 CEST umgesetzt: Der macOS-Credential-Adapter uebergibt GitHub-Tokens beim Schreiben nicht mehr als `security`-Prozessargument und nutzt stattdessen stdin; die bestehenden Windows-Credential-Manager- und Linux-Secret-Service-Pfade bleiben unveraendert. Ein fokussierter GitHub-Client-Test prueft, dass `security add-generic-password` kein Token-Argument und kein `-w`-Passwortargument erhaelt. Der fokussierte Testlauf `node --preserve-symlinks --preserve-symlinks-main --test tests/github-api-client.test.js` bestand lokal mit 22/22 Tests.
- Notiz: 2026-06-10 10:36 CEST Review-Punkt adressiert: Der macOS-Credential-Adapter ruft `security add-generic-password` jetzt mit `-w` als letztem Prompt-/Schreibsignal auf, uebergibt den GitHub-Token aber weiterhin ausschliesslich ueber stdin und nie als Prozessargument. Der fokussierte Test prueft kein Token-Argument, `-w` als letztes Argument und stdin-Weitergabe.
- Notiz: 2026-06-10 10:46 CEST Review-Punkt adressiert: Der macOS-Credential-Adapter schreibt Tokens jetzt ueber den dokumentierten interaktiven `security -i`-Modus und sendet den vollstaendigen `add-generic-password ... -w <token>`-Befehl ueber stdin, statt von einer undokumentierten `-w`-stdin-Schreibweise abzuhaengen. Der Token erscheint weiterhin nicht in Prozessargumenten; der fokussierte GitHub-Client-Test prueft `security -i`, tokenfreie argv und den interaktiven Schreibbefehl.
- Review-Ergebnis: Bestanden am 2026-06-10 10:53 CEST. Der macOS-Credential-Adapter startet nur `security -i` und uebergibt den GitHub-Token nicht als Prozessargument; der interaktive `add-generic-password ... -w <token>`-Befehl laeuft ueber stdin. Windows Credential Manager und Linux Secret Service behalten ihre tokenarmen Pfade, Fehler bleiben als `secure-storage-unavailable` strukturiert, und der fokussierte Test prueft tokenfreie macOS-argv. `node --preserve-symlinks --preserve-symlinks-main --test tests/github-api-client.test.js`, `git diff --check` und `npm run ci:node` bestanden lokal mit 118/118 Tests.
- Offene Review-Punkte: -

### T64 - Desktop-Bridge-Paketierungsvariante entscheiden

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T48`, `T49`, `T56`, `T59`, `T60`
- Definition of Done: Eine kurze Entscheidung in `docs/desktop-bridge.md`, `docs/desktop-runtime-decision.md` oder einem neuen Desktop-Planungsdokument benennt verbindlich, ob die gebaute App die Bridge ueber Tauri Resource plus explizit aufgeloeste Node/JS-Runtime, Node-Sidecar, native Rust-Backend-Ausfuehrung oder strukturierten fehlende-Runtime-Fehler startet; Dev-, CI- und installierte Bundle-Pfade sind getrennt beschrieben; der Fehlervertrag fuer fehlenden Worker, fehlende Runtime oder Bridge-Startfehler ist benannt; Scope-Grenzen gegen freie Shell, generische Filesystem-API, Token-Oberflaeche und neue Produktflaechen bleiben explizit erhalten.
- Implementierungsnotiz: Vor der Codeaenderung entscheiden, weil `src-tauri/src/lib.rs` aktuell `node` aus `PATH` startet und `../src/desktop-bridge-worker.js` relativ zu `CARGO_MANIFEST_DIR` sucht. Die Entscheidung soll die bestehende Bridge und ihre Whitelist respektieren, nicht die Desktop-Architektur neu erfinden.
- Notiz: 2026-06-10 umgesetzt: `docs/desktop-bridge.md` legt die Paketierungsvariante fest: bestehender JavaScript-Bridge-Worker ueber Tauri-Resources plus explizit aufgeloeste Node-Runtime statt generischem Node-Sidecar oder Rust-Neuimplementierung. Das aktuelle Bundle enthaelt keine Node-Binary; installierte Builds nutzen `SOURCE_COMPANION_NODE_BINARY` oder `node` aus der Prozessumgebung und liefern bei fehlender Runtime `desktop-bridge-runtime-missing`, ohne die App-Shell hart zu beenden. Dev-, CI- und installierte Bundle-Pfade sowie strukturierte Fehler fuer fehlenden Worker, fehlende Runtime, Startfehler und Worker-Exit sind dokumentiert; Scope-Grenzen gegen freie Shell, generische Filesystem-API, Token-Oberflaeche und neue Produktflaechen bleiben explizit erhalten.
- Review-Ergebnis: Bestanden am 2026-06-10. `docs/desktop-bridge.md` trifft eine verbindliche Packaging-Entscheidung fuer JavaScript-Bridge-Worker als Tauri-Resource plus explizit aufgeloeste Node-Runtime, trennt Dev-, CI- und installierte Bundle-Pfade, benennt strukturierte Fehler fuer fehlenden Worker, fehlende Runtime, Startfehler und Worker-Exit und haelt die Scope-Grenzen gegen freie Shell, generische Filesystem-API, Token-Oberflaeche und neue Produktflaechen fest. Das aktuelle Tauri-Bundle paketiert den Worker-/Modulbaum, aber keine Node-Binary; fehlendes Node ist ein strukturierter Bridge-Fehler und kein Startup-Abbruch.
- Offene Review-Punkte: -

### T65 - Desktop-Bridge-Worker im Tauri-Bundle aufloesen

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T64`
- Definition of Done: `src-tauri/src/lib.rs` startet die Bridge gemaess `T64` aus einem Tauri-Bundle-tauglichen Pfad und haengt in installierten Builds nicht mehr vom lokalen Projekt-Source-Tree oder `CARGO_MANIFEST_DIR/../src/desktop-bridge-worker.js` als einzigem Pfad ab; `src-tauri/tauri.conf.json` oder die native Implementierung paketiert die benoetigten Worker-/Resource-/Sidecar-Artefakte; Dev- und Test-Overrides wie `SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER` bleiben moeglich, ohne den Bundle-Pfad zu verdecken; fokussierte Tests oder ein dokumentierter Check pruefen Pfadaufloesung, fehlenden Worker und unveraenderte Bridge-Whitelist.
- Implementierungsnotiz: Eng auf Worker-/Resource-Aufloesung bleiben. Keine freien Commands, keine generische Dateisystemoberflaeche und keine Renderer-Token einfuehren. Falls weiterhin ein JS-Worker genutzt wird, muss dessen Arbeitsverzeichnis so gesetzt werden, dass die bestehenden CommonJS-Imports und Asset-Pfade im Bundle funktionieren.
- Notiz: 2026-06-10 umgesetzt: `src-tauri/src/lib.rs` initialisiert den Desktop-Bridge-Worker jetzt im Tauri-Setup mit Zugriff auf `app.path().resource_dir()`, priorisiert `SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER`, nutzt danach den paketierten `src/desktop-bridge-worker.js`-Resource-Pfad und erst zuletzt den Source-Tree-Fallback fuer Entwicklung. `src-tauri/tauri.conf.json` paketiert den bestehenden `src`-Worker-/Modulbaum als Tauri-Resource, das Worker-CWD bleibt der Resource-/Projekt-Root, und die fokussierten Tests pruefen Resource-Manifest, Pfad-Reihenfolge, fehlenden Worker und unveraenderte Bridge-Whitelist. `npm run ci:node` bestand lokal mit 117/117 Tests; Rust/Tauri-Check konnte lokal nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-10. `src-tauri/src/lib.rs` loest den Worker zuerst ueber `SOURCE_COMPANION_DESKTOP_BRIDGE_WORKER`, danach ueber `app.path().resource_dir()/src/desktop-bridge-worker.js` und erst danach ueber den Source-Tree-Fallback auf; `src-tauri/tauri.conf.json` paketiert den `src`-Worker-/Modulbaum als Resource. Die Tests decken Resource-Manifest, Pfad-Reihenfolge, fehlenden Worker und unveraenderte Bridge-Whitelist ab. `npm run ci:node` bestand lokal mit 118/118 Tests und `git diff --check` bestand; Rust/Tauri-Check konnte lokal nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: -

### T66 - Fehlendes lokales Node und Bundle-Bridge-Smoke absichern

- Status: `done`
- Prioritaet: `P1`
- Abhaengigkeiten: `T65`
- Definition of Done: Eine installierte oder gebaute Desktop-App bricht beim Start nicht nur deshalb ab, weil auf dem Zielsystem kein lokales `node` im `PATH` liegt; je nach Entscheidung aus `T64` wird eine explizit aufgeloeste Runtime, ein Sidecar, native Backend-Ausfuehrung oder ein strukturierter, nutzerverstaendlicher Bridge-Fehler genutzt, ohne die App-Shell hart zu beenden; CI oder ein dokumentierter Smoke-Schritt deckt mindestens `tauri build` bzw. einen Bundle-Startpfad mit erfolgreicher Bridge-Initialisierung und einen fehlende-Runtime/fehlender-Worker-Fall ab; README oder Desktop-Dokumentation nennt die verbleibenden Plattformvoraussetzungen.
- Implementierungsnotiz: Der aktuelle `DesktopBridgeState::new().expect(...)` kann die App beim Bridge-Startfehler hart abbrechen. Diese Aufgabe soll das Runtime-/Startverhalten absichern, nachdem der Bundle-Pfad aus `T65` existiert.
- Notiz: 2026-06-10 10:58 CEST umgesetzt: `src-tauri/src/lib.rs` verwaltet Bridge-Startup jetzt als `Result`, bricht Tauri-Setup bei fehlendem Worker oder fehlender Node-Runtime nicht mehr hart ab und liefert fuer fehlendes Node einen strukturierten `desktop-bridge-runtime-missing`-Fehler aus Bridge-Kommandos. `tests/desktop-bridge.test.js` prueft den nicht-abbrechenden Setup-Pfad, Worker-/Runtime-Fehler und die unveraenderte Whitelist; README und `docs/desktop-bridge.md` dokumentieren die verbleibende Node-Voraussetzung sowie den Bundle-Smoke-/Fehlerpfad. Fokussierter Bridge-Test, `git diff --check` und `npm run ci:node` bestanden lokal mit 118/118 Tests; Rust/Tauri-Check konnte lokal nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Review-Ergebnis: Bestanden am 2026-06-10. `src-tauri/src/lib.rs` verwaltet den Desktop-Bridge-Start als `Result`, registriert den Tauri-State im Setup ohne `expect` und gibt fehlende Worker-/Runtime-Fehler aus Bridge-Kommandos strukturiert zurueck, sodass die App-Shell nicht wegen fehlendem lokalem `node` hart abbricht. Die Tests decken den erfolgreichen Worker-Start, die Tauri-Resource-/Whitelist-Absicherung sowie fehlende Worker-/Runtime-Fehler ab; README und `docs/desktop-bridge.md` nennen die verbleibende Node-Voraussetzung und den Fehlerpfad. `node --preserve-symlinks --preserve-symlinks-main --test tests/desktop-bridge.test.js`, `git diff --check` und `npm run ci:node` bestanden lokal mit 118/118 Tests. Rust/Tauri-Check konnte lokal nicht ausgefuehrt werden, weil `cargo` nicht installiert ist.
- Offene Review-Punkte: Optionaler Follow-up: Vollstaendigen installierten Bundle-Start-Smoke ergaenzen, sobald eine Node-Runtime tatsaechlich in das Tauri-Bundle aufgenommen wird.

### T67 - Web-UI als separates Release-Artefakt bereitstellen

- Status: `todo`
- Prioritaet: `P3`
- Abhaengigkeiten: `T59`
- Definition of Done: Der Release-Prozess erzeugt neben der Windows-Desktop-App optional ein `source-companion-web.zip`, das die statische Web-UI mit `index.html`, `src/` und notwendigen Assets enthaelt; das Artefakt wird an GitHub Releases angehaengt; README oder Release-Dokumentation beschreibt klar, dass das Web-Artefakt nicht dieselben nativen Git-/GitHub-/Watcher-Funktionen wie die Tauri-App bietet.
- Implementierungsnotiz: Web-UI und Desktop-App bleiben getrennte Artefakte. Kein gemeinsamer Installer, keine parallele gemeinsame Operation Queue und keine neue Backend-Server-Flaeche einfuehren. Das Web-Artefakt ist fuer Inspektion/Prototyping gedacht; echte lokale Git-Funktionen bleiben Desktop-Scope.
- Offene Review-Punkte: -
