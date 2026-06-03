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

## Aufgaben

### T1 - Produktquelle und Scope-Gates festziehen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: -
- Definition of Done: README oder ein Architektur-Startdokument verweist klar auf `docs/plan.md` als Produktquelle; Nicht-Ziele wie Editor, Terminal, Agent, Workspaces, GitLab/Bitbucket und Force Push sind in einem Scope-Gate dokumentiert; neue Features muessen am Git/GitHub-Versionskontroll-Gate gemessen werden.
- Implementierungsnotiz: Keine Produktentscheidungen neu erfinden. Die Regeln aus `docs/plan.md` Abschnitt 2, 3, 8, 9 und 12 uebernehmen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T2 - Architektur-Startdokument fuer Kernkomponenten anlegen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T1`
- Definition of Done: Ein technisches Startdokument benennt UI-Schichten, Git CLI Wrapper, GitHub API Client, Dateiwatcher, lokalen State Store und Auth/Token-Verwaltung; es beschreibt pro Komponente Verantwortung, erlaubte Eingaben, Fehlerausgaben und ausgeschlossene Funktionen.
- Implementierungsnotiz: Architektur bleibt eng auf Source-Control-Funktionen. Keine Plugin-Plattform, kein Terminal, kein freier Command Runner.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T3 - Repository-Kontextmodell definieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`
- Definition of Done: Ein Repository-Kontextmodell ist dokumentiert oder typisiert und enthaelt Pfad, Anzeigenamen, Git-Status, Branch, Remote, Upstream, ahead/behind, laufende Operationen, Fehlerzustand und GitHub-Verknuepfung; mehrere Kontexte koennen ohne globale Vermischung existieren.
- Implementierungsnotiz: Jeder Tab repraesentiert genau einen Repository-Kontext. Keine Workspaces modellieren.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T4 - App-Shell und Projektauswahl bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T3`
- Definition of Done: Startoberflaeche zeigt dauerhaft gespeicherte zuletzt geoeffnete Repositories sowie Aktionen fuer Repo oeffnen, Clone Repo, Clone from GitHub und Publish to GitHub; ausgewaehlte Repositories werden in Tabs geoeffnet; leere und fehlerhafte Startzustaende sind sichtbar.
- Implementierungsnotiz: Projektauswahl klein halten. Sie ist Einstieg in Git-Kontexte, kein Dashboard und keine Projektverwaltung. Zuletzt geoeffnete Repositories im lokalen State Store speichern und ungueltige Pfade verstaendlich behandeln.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T5 - Repo-Tabs mit isolierten Kontexten umsetzen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T3`, `T4`
- Definition of Done: Mehrere Repositories koennen parallel in Tabs geoeffnet werden; Tab-Wechsel zeigt den richtigen Repository-Zustand; laufende Operationen und Fehler bleiben je Repository isoliert; Schliessen eines Tabs entfernt nur dessen Kontext.
- Implementierungsnotiz: Keine globalen Singletons fuer aktives Repo verwenden, wenn sie Tab-Isolation verhindern.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T6 - Git CLI Wrapper Basisschicht implementieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T2`
- Definition of Done: Git-Kommandos laufen ueber einen whitelisted Wrapper; stdout, stderr, Exit-Code und strukturierte Fehler werden getrennt erfasst; Argumente werden strukturiert uebergeben; freie Shell-Kommandos sind fuer die UI nicht verfuegbar.
- Implementierungsnotiz: Wrapper mindestens fuer `status`, `diff`, `add`, `restore`, `commit`, `branch`, `switch`, `fetch`, `pull`, `push`, `remote`, `clone`, `init`, `log` und `stash` vorbereiten.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T7 - Git Operation Queue pro Repository implementieren

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T3`, `T6`
- Definition of Done: Git-Operationen werden pro Repository kontrolliert serialisiert; parallele Operationen in verschiedenen Repositories bleiben moeglich; laufende, erfolgreiche, fehlgeschlagene und abgebrochene Operationen sind im State unterscheidbar.
- Implementierungsnotiz: Lange Operationen sollen abbrechbar vorbereitet werden. Queue darf Status-Refreshes nicht dauerhaft verhungern lassen.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T8 - Repository-Erkennung und Git-Zustandsmodell umsetzen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T6`, `T7`
- Definition of Done: App erkennt kein Ordner offen, Ordner ohne Git, normales Git-Repo, Repo mit Remote, GitHub-Remote, GitHub-authentifiziert, Operation laeuft, Konflikt und Fehler; Branch, Upstream, ahead/behind, staged, unstaged, untracked und conflicted Dateien werden geladen.
- Implementierungsnotiz: Zustaende explizit modellieren, nicht aus verstreuten UI-Flags ableiten.
- Review-Ergebnis: -
- Offene Review-Punkte: -

### T9 - Dateiwatcher und entprellten Status-Refresh bauen

- Status: `todo`
- Prioritaet: `P1`
- Abhaengigkeiten: `T7`, `T8`
- Definition of Done: Datei- und Git-Index-Aenderungen aktualisieren den Repository-Zustand automatisch; Events werden entprellt; Status wird nicht bei jedem Event blind neu geladen; Refresh-Konflikte mit laufenden Git-Operationen sind geregelt.
- Implementierungsnotiz: Watcher soll Branch-Wechsel, Index-Aenderungen und normale Dateiaenderungen abdecken.
- Review-Ergebnis: -
- Offene Review-Punkte: -

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

### T22 - GitHub PRs, Checks und Review-Kommentare integrieren

- Status: `todo`
- Prioritaet: `P2`
- Abhaengigkeiten: `T16`, `T18`
- Definition of Done: GitHub Remote wird erkannt; PRs koennen erstellt und geoeffnet werden; PR Status, Checks, Check-Ergebnisse, Review-Kommentare und erkannte Issue-Nummern aus Branch/Commit werden angezeigt oder verlinkt; GitHub-Funktionen bleiben auf Versionskontrolle begrenzt.
- Implementierungsnotiz: Kein Issue Board, kein Kanban, keine Notifications-Zentrale, kein Actions-Dashboard Deluxe, keine Wiki- oder Discussions-Funktionen.
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
- Abhaengigkeiten: `T8`, `T12`, `T13`, `T14`, `T16`, `T17`, `T18`, `T19`, `T20`, `T22`, `T23`
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

### T27 - Merge/Rebase-Basisumfang klaeren und umsetzen

- Status: `todo`
- Prioritaet: `P3`
- Abhaengigkeiten: `T6`, `T8`, `T15`, `T16`, `T23`
- Definition of Done: Entscheidung ist dokumentiert, ob Merge/Rebase-Basisfunktionen Teil des ersten Produktziels bleiben oder explizit in spaeteren Scope verschoben werden; falls enthalten, funktioniert mindestens Merge des aktuellen Branches mit einem ausgewaehlten Branch inklusive Fortschritt, Konfliktzustand und Git Output; Rebase wird nur angeboten, wenn Fehler-, Warn- und Abbruchfaelle sauber bedienbar sind.
- Implementierungsnotiz: Kein interaktives Rebase, kein History-Rewrite-Wizard, kein komplexes Cherry-Pick-UI. Wenn Rebase nicht ausreichend sicher abbildbar ist, Produktplan und Scope-Gate klar auf spaeter verschieben.
- Review-Ergebnis: -
- Offene Review-Punkte: -
