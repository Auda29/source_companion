# Source Companion - Produktplan v2

## 1. Kurzdefinition

Source Companion ist eine eigenständige, minimalistische Git/GitHub-Oberfläche im Stil des Cursor- bzw. VS-Code-Source-Control-Panels.

Das Tool ersetzt Cursor nur für Git.

Es ist kein Editor, kein Agent, kein Terminal, kein Dashboard und kein Projektbaum. Es zeigt Git-Zustand, macht Git-Änderungen prüfbar und erlaubt gezielte Git/GitHub-Aktionen.

## 2. Produktprinzip

Jede Funktion muss diese Frage bestehen:

Hilft sie direkt beim Anzeigen, Prüfen oder Ausführen eines Git/GitHub-Versionskontrollschritts?

Wenn nein, gehört sie nicht in das Produkt.

Das Produkt soll bewusst eng bleiben. Es soll kein kleiner VS-Code-Klon und kein allgemeines Entwickler-Cockpit werden.

## 3. Harte Produktgrenzen

| Bereich | Entscheidung | Notiz |
| --- | --- | --- |
| Lokales Git | ja | Kernfunktion |
| Branches | ja | Anzeigen, wechseln, erstellen, löschen |
| Diffs | ja | Datei- und Hunk-Ebene |
| Staging | ja | Datei- und Hunk-Ebene |
| Commit | ja | Commit, Amend, Commit-Message |
| Pull/Push/Fetch/Sync | ja | Mit klarer Fehleranzeige |
| Repo initialisieren | ja | Für Ordner ohne Git |
| Repo klonen | ja | URL und GitHub-Auswahl |
| Repo nach GitHub publishen | ja | Private/Public-Auswahl |
| Merge | ja, begrenzt | Aktuellen Branch mit ausgewaehltem Branch mergen |
| Rebase | spaeter | Nicht Teil des ersten Produktziels; keine History-Rewrites |
| Git Graph/History | ja | Weil es Git-Zustand sichtbar macht |
| GitHub PRs | ja | Erstellen, öffnen, Status sehen |
| GitHub Checks | ja | Status und Ergebnis öffnen |
| GitHub Issues | maximal Verknüpfung | Keine Issue-Verwaltung |
| Editor | nein | Keine Datei-Bearbeitung |
| Terminal | nein | Keine Shell, keine freien Commands |
| AI Chat | nein | Kein Agent- oder Chatbereich |
| Projektbaum | nein | Nur geänderte Dateien und Git-Kontext |
| Plugin-System | nein | Kein App-Framework |
| Task-Runner | nein | Keine Tests, Builds oder Skripte starten |
| Projektmanagement | nein | Kein Kanban, keine Boards, keine Notifications-Zentrale |

## 4. Produktname

Der Produktname ist festgelegt:

Source Companion

Der Name darf den Scope nicht aufweichen. Source Companion bleibt trotz "Companion" kein allgemeiner Entwicklungsassistent, kein Agent und kein Projekt-Dashboard. Der Companion-Kontext bezieht sich ausschließlich auf Git/GitHub-Versionierung.

## 5. Zielnutzer

Primärer Nutzer:
- Arbeitet mit Codex, Zed, Pi oder anderen Tools am Code.
- Will Git nicht in jedem Editor neu bedienen.
- Will eine dedizierte Git/GitHub-Oberfläche, die schnell, eng und vorhersehbar ist.

Typische Situation:
- Code wird außerhalb von Source Companion geändert.
- Source Companion zeigt Änderungen, Diffs und Branch-Zustand.
- Nutzer staged, committet, pusht, erstellt PRs oder klont/publisht Repos.

## 6. Kern-Workflows

### 6.1 Repo öffnen

Der Nutzer kann ein oder mehrere lokale Repositories öffnen.

Mehrere Repositories werden gleichzeitig über Tabs verwaltet. Jeder Tab steht für genau ein aktives Repository mit eigenem Git-Status, Branch, Remote und laufenden Operationen.

Zusätzlich soll es eine kleine Projektauswahl-Oberfläche geben:
- zuletzt geöffnete Repositories
- Repo öffnen
- Clone Repo
- Clone from GitHub
- Publish to GitHub, falls ein lokaler Ordner gewählt wurde

Das Tool erkennt:
- aktiver Branch
- Git-Status
- Remote
- Upstream-Branch
- staged/unstaged/untracked/conflicted Dateien
- voraus-/zurückliegende Commits gegenüber Upstream

Wenn der Ordner kein Git-Repository ist, zeigt das Tool keinen leeren Fehlerzustand, sondern konkrete Aktionen:
- Initialize Repository
- Publish to GitHub
- Clone Repo

Für das erste Produktziel gibt es keine Workspaces. Es reicht eine Liste zuletzt geöffneter Repositories.

### 6.2 Repo initialisieren

Für einen lokalen Ordner ohne Git:
- Hinweis anzeigen: Der Ordner ist noch kein Git-Repository.
- Aktion: Initialize Repository.
- Nach Initialisierung Git-Status anzeigen.
- Optional direkt danach Publish to GitHub anbieten.

Wichtig:
- Kein Editor öffnen.
- Keine Dateien automatisch erstellen, außer Git selbst verlangt es nicht.
- Keine versteckte Initial-Commit-Automatik ohne explizite Nutzeraktion.

### 6.3 Repo per URL klonen

Der Nutzer kann ein Repository per URL klonen.

UI:
- Clone Repo als Einstieg.
- Eingabefeld: Repository URL.
- Zielordner frei auswählen.
- Fortschritt anzeigen.
- Fehler lesbar anzeigen.

Unterstützte Quellen:
- HTTPS-Git-URLs
- SSH-Git-URLs
- GitHub-URLs

Nach erfolgreichem Clone:
- Repository öffnen.
- Git-Status anzeigen.
- Branch/Remote/Sync-Status anzeigen.

### 6.4 Direkt von GitHub klonen

Der Nutzer kann nach GitHub-Login direkt vorhandene Repositories klonen.

Workflow:
- GitHub Login starten.
- Verfügbare Repositories des eingeloggten Users laden.
- Repositories durchsuchen/filtern.
- Liste zeigt:
  - Owner/Name
  - Beschreibung
  - Sichtbarkeit, falls verfügbar
  - Stars, falls sinnvoll
  - Clone-URL
  - ggf. private/public Indikator
- Repository auswählen.
- Zielordner frei auswählen.
- Clone ausführen.
- Repo öffnen.

UI-Referenz:
- Suchfeld: Repository name (type to search).
- Quelle: Clone from GitHub.
- Liste ähnlich VS Code/Cursor Remote Sources.

### 6.5 Lokalen Ordner nach GitHub publishen

Der Nutzer kann einen lokalen Ordner oder ein lokales Git-Repo direkt nach GitHub veröffentlichen.

Workflow:
- Publish to GitHub auswählen.
- GitHub Login prüfen.
- Zielordner bzw. lokales Repository bestätigen.
- Repository-Name vorschlagen, basierend auf Ordnername.
- Beschreibung optional.
- Sichtbarkeit wählen:
  - Private
  - Public
- GitHub-Repository erstellen.
- origin Remote setzen.
- Initial Push ausführen.
- Danach normalen Source-Control-Zustand anzeigen.

Sonderfälle:
- Wenn noch kein lokales Git-Repo existiert, zuerst explizit Initialisierung bestätigen.
- Wenn keine Commits existieren, Commit-Flow anbieten.
- Wenn origin bereits existiert, nicht überschreiben ohne Warnung.
- Wenn GitHub-Repo-Name belegt ist, verständlichen Fehler anzeigen.

Für das erste Produktziel ist GitHub die einzige Hosting-Integration. GitLab und Bitbucket bleiben außerhalb des Scopes.

### 6.6 Änderungen prüfen

Das Tool zeigt alle Änderungen nach Git-Status:
- Changed
- Staged
- Untracked
- Conflicts

Für jede Datei:
- Statussymbol
- Pfad
- Änderungstyp
- Aktionen: stage, unstage, discard

Diff-Ansicht:
- Side-by-side oder unified Diff
- Datei-Diff anzeigen
- Hunk-Auswahl
- Hunk stage/unstage
- Konflikte klar markieren

Nicht enthalten:
- Datei direkt bearbeiten
- Inline-Code-Editor
- Formatierung oder Refactoring

### 6.7 Commit

Commit-Bereich:
- Commit-Message-Feld
- Commit-Button
- Committen und pushen als direkter kombinierter Flow
- Dropdown für Commit-Varianten

Funktionen:
- Commit
- Commit staged changes
- Commit and Push
- Amend Commit
- Optional: sign-off, falls später sinnvoll

Regeln:
- Keine Commit-Ausführung ohne Message.
- Warnung bei leerem Staging-Bereich.
- Amend klar markieren, weil es History verändert.
- Fehler aus Git lesbar anzeigen.

AI Commit Message:
- kritisch und optional
- Codex-UI als Referenz: leere Commit Message kann einen Vorschlag generieren
- nur als expliziter Generierungsflow denkbar
- kein eingebauter Chat
- kein autonomer Agent

### 6.8 Branches

Branch-Leiste:
- aktueller Branch
- Upstream-Status
- ahead/behind
- sync status

Funktionen:
- Branch wechseln
- Branch erstellen
- Branch löschen
- Branch von aktuellem Branch erstellen
- Remote-Branch auschecken

Sicherheitsregeln:
- Branch löschen nur mit Warnung, wenn nicht gemerged.
- Wechsel bei uncommitted changes nur mit klarer Git-Fehlermeldung oder kontrollierter Stash-Option.
- Kein komplexer Branch-Manager als eigenes Dashboard.

### 6.9 Pull, Push, Fetch, Sync

Funktionen:
- Fetch
- Pull
- Push
- Sync
- Publish Branch

UI:
- kleine Toolbar-Aktionen
- Sync-Status in Branch-Leiste
- Fortschritt und Output
- Fehlerzustand sichtbar

Regeln:
- Keine stillen Force-Pushes.
- Force Push ist für das erste Produktziel nicht vorgesehen.
- Pull-Konflikte führen in Conflict-Ansicht, nicht in ein Terminal.

### 6.10 Merge-Basisfunktion und Rebase-Abgrenzung

Merge bleibt Teil des ersten Produktziels, aber nur als kontrollierte Basisfunktion.

Erlaubt:
- aktuellen Branch mit einem ausgewaehlten Branch mergen
- normale Fast-forward- oder Merge-Commit-Ergebnisse anzeigen
- Fortschritt, Erfolg, Git-Fehler, Konfliktzustand und Git Output sichtbar machen

Warnungen und Blockaden:
- Vor dem Merge muss der gewaehlte Ziel-Branch sichtbar sein.
- Bei uncommitted changes wird der Merge nicht still gestartet; Git-Fehler oder eine klare Vorabwarnung muessen sichtbar sein.
- Bei bereits vorhandenen Konflikten wird kein neuer Merge gestartet.
- Merge-Konflikte fuehren in den bestehenden Konfliktzustand und Git Output, nicht in ein Terminal.

Nicht fuer das erste Produktziel:
- Rebase
- interaktives Rebase
- komplexes Cherry-Pick-UI
- History-Rewrite-Wizard
- Git-Lernplattform

### 6.11 Stash-Basisfunktionen

Stash ist als Basisfunktion erlaubt, weil es direkt mit sicheren Branch-Wechseln und temporären Arbeitsständen zusammenhängt.

Erlaubt:
- Änderungen stashen
- Stash-Liste anzeigen
- Stash anwenden
- Stash löschen
- Stash mit kurzer Message anlegen

Nicht für das erste Produktziel:
- komplexer Stash-Browser
- Stash-Konflikt-Assistent
- Stash teilweise anwenden
- Stash als allgemeiner Backup-Mechanismus verkaufen

### 6.12 Git Graph und History

Graph/History ist erlaubt, weil es direkt Git-Zustand sichtbar macht.

Funktionen:
- Commit-History anzeigen
- aktueller Branch markieren
- Remote-Branch markieren
- Commit-Metadaten anzeigen
- Commit-Diff öffnen
- lokale/remote Divergenz sichtbar machen

Grenze:
- Kein allgemeines Dashboard.
- Kein Analytics- oder Projektmanagementbereich.

### 6.13 GitHub PRs

GitHub-Funktionen bleiben auf Versionskontrolle begrenzt.

Erlaubt:
- Remote als GitHub-Repo erkennen
- PR erstellen
- PR öffnen
- PR-Status anzeigen
- Checks anzeigen
- Review-Kommentare anzeigen
- Branch mit PR verknüpfen
- Issue-Nummer aus Branch/Commit erkennen und verlinken

Nicht erlaubt:
- Issue Board
- Kanban
- Notifications-Zentrale
- Discussions
- Wiki
- Actions-Dashboard Deluxe
- allgemeine GitHub-Projektverwaltung

## 7. UI-Struktur

### 7.0 UI-Laufzeitstrategie

Der aktuelle UI-Aufbau startet als Web-/HTML-Prototyp. Diese Web-Version dient dazu, Layout, Source-Control-Flows, Tabs, Diffs, Commit-Bereich, Graph/History und GitHub-Einstiege schnell sichtbar und testbar zu machen.

Nach dem lauffaehigen Web-UI soll Source Companion als lokale Desktop-App geplant und umgesetzt werden.

Begruendung:
- Das Produkt braucht Zugriff auf lokale Repositories.
- Git CLI muss lokal ausgefuehrt werden.
- Dateiwatcher braucht lokalen Dateisystemzugriff.
- Zielordner fuer Clone/Publish muessen frei waehlbar sein.
- Eine reine Web-App kann diese Anforderungen nicht sauber erfuellen.

Technische Richtung:
- Web-UI als wiederverwendbare Frontend-Schicht behalten.
- Desktop-Shell spaeter darum legen.
- Tauri ist die gewaehlte Desktop-Shell; die Bewertung gegen Electron ist in `docs/desktop-runtime-decision.md` dokumentiert.
- Die Tauri-Bridge darf nur whitelisted Git-, GitHub-, Dateiwatcher- und Datei-/Ordnerauswahl-Aktionen exponieren.

Desktop-Zielbild:
- kleines Floating Window als kompakter Standardmodus
- Umschalten auf Full UI mit dem Umfang der Web-Version
- gleiche Repository-Kontexte und Git-Operationen in beiden Modi
- keine zusaetzliche Produktdomaene durch die Desktop-Shell

Floating Window:
- zeigt aktives Repository
- aktueller Branch
- kompakter Change-Zaehler
- Commit-Message-Feld oder kompakter Commit-Einstieg
- schnelle Aktionen fuer Commit, Commit and Push, Push, Pull/Sync
- Status-/Fehlerhinweis
- Button zum Oeffnen der Full UI

Full UI:
- entspricht der Web-Version
- Repo-Tabs
- Projektauswahl
- Source-Control-Listen
- Diff-Flaeche
- Commit-Bereich
- Branch/Sync-Leiste
- einklappbarer Graph/History-Bereich
- Git Output/Fehlerbereich

### 7.1 Grundlayout

Das Layout besteht aus wenigen festen Bereichen:

- Repo-Tabs
- kleine Projektauswahl für zuletzt geöffnete Repositories
- Source-Control-Sidebar
- Diff-Fläche
- Commit-Bereich
- Branch/Sync-Leiste
- optionaler Graph/History-Bereich
- Git Output/Fehlerbereich

Keine Projektbaum-Navigation. Keine Editor-Tabs. Keine Terminal-Fläche.

### 7.2 Sidebar

Sidebar zeigt:
- Repository-Name
- Branch
- Sync-Status
- Changes
- Staged Changes
- Untracked
- Conflicts
- Aktionen für Stage/Unstage/Discard

Toolbar:
- Refresh
- View Mode
- Commit/Checkmark
- Source Control Aktionen
- More Menu

Die Toolbar darf kompakt wie Cursor/VS Code sein.

### 7.3 Commit-Bereich

Elemente:
- Commit-Message-Eingabe
- Commit-Button
- Committen-und-Pushen-Aktion
- Dropdown für Commit-Varianten
- Statushinweise

Verhalten:
- Button deaktiviert, wenn Commit nicht möglich ist.
- Fehlermeldungen nahe am Commit-Bereich.
- Amend visuell klar vom normalen Commit unterscheiden.
- Codex-Commit-UI ist eine relevante Referenz: Commit Message kann leer bleiben, wenn dadurch explizit eine Message generiert wird.
- Kombinierter Flow `Committen und pushen` ist sinnvoll, solange Commit und Push weiterhin als nachvollziehbare Git-Aktionen sichtbar bleiben.

### 7.4 Diff-Fläche

Diff-Fläche zeigt:
- ausgewählte Datei
- unified oder side-by-side Diff
- Hunk-Aktionen
- Whitespace-Optionen optional später

Keine direkte Datei-Bearbeitung.

### 7.5 Graph/History

Graph/History muss einklappbar sein.

Zeigt:
- Commit-Linie
- Commit-Message
- Autor
- Branch Labels
- Remote Labels
- HEAD

UI-Referenz:
- Der Screenshot mit Graph-Bereich ist relevant.
- Der Bereich bleibt Git-History, nicht Activity Feed.

### 7.6 Agent Review als Referenz, nicht als Feature

Cursor zeigt einen Agent-Review-Bereich. Für Source Companion gilt:

- Kein Agent Review als eigenes Produktfeature.
- Höchstens ein neutraler, einklappbarer Statusbereich für externe Checks.
- Externe Codex-Übergabe nur als Link oder explizite Aktion denkbar.

## 8. Backend-Architektur

### 8.1 Komponenten

Backend braucht nur:
- Git CLI Wrapper
- GitHub API Client
- Dateiwatcher
- lokaler State Store
- Auth/Token-Verwaltung

Mehr nicht.

### 8.2 Git CLI Wrapper

Der Git Wrapper kapselt:
- status
- diff
- add
- restore/checkout für discard
- commit
- commit --amend
- branch
- switch/checkout
- fetch
- pull
- push
- remote
- clone
- init
- log

Designregeln:
- Keine freien Shell-Kommandos.
- Nur whitelisted Git-Aktionen.
- Argumente strukturiert übergeben.
- Fehlercode, stdout, stderr getrennt erfassen.
- Lange Operationen abbrechbar machen.

### 8.3 GitHub API Client

GitHub Client kapselt:
- Login/Auth
- User-Repos listen
- Repo suchen/filtern
- Repo erstellen
- PR erstellen
- PR Status lesen
- Checks lesen
- Review-Kommentare lesen

Auth:
- Token sicher speichern.
- Logout ermöglichen.
- Fehlende Berechtigungen klar anzeigen.

### 8.4 Dateiwatcher

Watcher erkennt:
- Dateiänderungen
- Git-Index-Änderungen
- Branch-Wechsel
- Remote-State nach Fetch

Regeln:
- Status nicht bei jedem Event blind neu laden.
- Events entprellen.
- Git-Operationen nicht parallel chaotisch ausführen.

### 8.5 State-Modell

Wichtige Zustände:
- Kein Ordner offen
- Ordner offen, aber kein Git-Repo
- Git-Repo offen
- Git-Repo mit Remote
- GitHub-authentifiziert
- Operation läuft
- Konfliktzustand
- Fehlerzustand

Diese Zustände sollten explizit modelliert werden, nicht über verstreute UI-Flags.

## 9. Sicherheits- und UX-Regeln

Gefährliche Aktionen brauchen Warnung:
- Discard
- Branch löschen
- Amend
- Reset, falls später eingeführt
- Remote überschreiben
- Public Publish

Git Output:
- Immer erreichbar.
- Fehler müssen verständlich sein.
- Rohes Git-Output darf sichtbar sein, aber nicht die einzige Erklärung.

Keine versteckten Automatismen:
- Kein automatisches Commit.
- Kein automatisches Push nach Commit, außer explizit gewählt.
- Kein automatisches Publish ohne Bestätigung.
- Kein automatisches Löschen oder Überschreiben.

## 10. Produktziel

Das Produktziel beschreibt die erste vollständige Version von Source Companion. Es ist kein kleiner Zwischenstand und keine Demo, sondern der angestrebte Kernumfang, mit dem das Tool seinen Zweck erfüllt:

Cursor nur für Git ersetzen.

### 10.1 Zielzustand

Source Companion kann mehrere Git-Repositories parallel in Tabs öffnen, ihren Zustand anzeigen, Änderungen prüfbar machen und alle normalen Git/GitHub-Versionskontrollschritte ausführen.

Das Produktziel ist erreicht, wenn ein Nutzer für die tägliche Git-Arbeit nicht mehr in Cursor, VS Code oder ein Terminal wechseln muss.

Nicht gemeint ist:
- Code bearbeiten
- Tests oder Builds ausführen
- Projektmanagement betreiben
- mit einem Agent chatten
- Git durch freie Terminal-Kommandos umgehen

### 10.2 Lokales Git

Muss enthalten:
- mehrere Repositories gleichzeitig über Tabs
- kleine Projektauswahl mit zuletzt geöffneten Repositories
- Repo öffnen
- Ordner ohne Git erkennen
- Git init
- Git status
- Changed/Staged/Untracked/Conflicts
- Diff anzeigen
- Datei stage/unstage
- Hunk stage/unstage
- Datei discard mit Warnung
- Commit Message
- Commit
- Commit and Push
- Amend Commit
- Branch anzeigen
- Branch erstellen/löschen
- Branch wechseln
- Fetch/Pull/Push
- Sync
- Publish Branch
- Remote anzeigen
- Git Output/Fehler anzeigen

### 10.3 Repo-Einstieg und GitHub Publish

Muss enthalten:
- GitHub Login
- Clone per URL
- Clone from GitHub
- GitHub-Repositories des eingeloggten Users anzeigen
- GitHub-Repositories suchen/filtern
- Zielordner frei auswählen
- lokalen Ordner als Git-Repository initialisieren
- lokales Repository nach GitHub publishen
- private/public Auswahl
- origin setzen
- initial push
- nach Clone oder Publish automatisch in den normalen Source-Control-Zustand wechseln

### 10.4 Diffs, Staging und Commit-Qualität

Muss enthalten:
- Datei-Diff
- Hunk-Auswahl
- Hunk stage/unstage
- klare Trennung von staged und unstaged changes
- Warnung bei Discard
- Warnung bei Amend
- Commit-Button erst aktiv, wenn Commit möglich ist
- verständliche Fehleranzeige, wenn Git einen Commit ablehnt
- spaeter optional: leere Commit Message als Signal, um eine Commit Message zu generieren

Ziel:
- Nutzer kann kleine, saubere Commits bauen, ohne einen Editor oder ein Terminal öffnen zu müssen.

### 10.5 Branches, Sync und Stash

Muss enthalten:
- aktueller Branch
- Upstream-Anzeige
- ahead/behind Status
- Branch wechseln
- Branch erstellen
- Branch löschen mit Warnung
- Fetch
- Pull
- Push
- Sync
- aktuellen Branch mit ausgewaehltem Branch mergen
- Stash-Basisfunktionen

Stash-Basisfunktionen:
- Änderungen stashen
- Stash-Liste anzeigen
- Stash anwenden
- Stash löschen
- Stash mit kurzer Message anlegen

Nicht enthalten:
- Force Push
- Rebase und andere History-Rewrites
- komplexer Stash-Manager
- Stash teilweise anwenden

### 10.6 Graph und History

Muss enthalten:
- einklappbarer Graph/History-Bereich
- Commit-History
- aktueller Branch sichtbar
- Remote-Branch sichtbar
- Commit-Metadaten
- Commit-Diff öffnen
- lokale/remote Divergenz sichtbar machen

Graph/History ist Teil des Produktziels, weil es Git-Zustand sichtbar macht. Es darf aber nicht zu einem allgemeinen Dashboard werden.

### 10.7 GitHub PRs und Checks

Muss enthalten:
- GitHub Remote erkennen
- PR erstellen
- PR öffnen
- PR Status anzeigen
- Checks anzeigen
- Check-Ergebnis öffnen
- Review-Kommentare anzeigen
- Issue-Nummer aus Branch/Commit erkennen und verlinken

Grenze:
- keine Issue-Verwaltung
- kein Kanban
- keine Notifications-Zentrale
- kein Actions-Dashboard Deluxe

### 10.8 Nicht Teil des ersten Produktziels

Nicht Teil des ersten Produktziels:
- GitLab/Bitbucket
- Workspaces
- eigenes SSH-Key-Management
- Force Push
- Rebase
- andere History-Rewrites
- komplexes Cherry-Pick-UI
- komplexer Stash-Browser
- Stash teilweise anwenden
- AI Commit Message, solange das Konzept nicht sauber entschieden ist
- Übergabe an Codex/Zed/Pi als Kernfunktion

## 11. Spätere optionale Funktionen

Nur prüfen, wenn Kernprodukt stabil ist:
- side-by-side Diff
- Cherry-pick einzelner Commit
- einfache Conflict-Hilfe ohne Editor
- AI Commit Message, Konzept noch offen
- Übergabe an Codex/Zed/Pi für Datei-Bearbeitung oder Analyse

Wichtig:
- Optionale Funktionen dürfen keine neue Produktdomäne öffnen.
- Jede optionale Funktion braucht denselben Gate-Test aus Abschnitt 2.

## 12. Ausdrücklich nicht bauen

Nicht bauen:
- Code-Editor
- Markdown Preview
- Terminal
- AI Chat
- Agent Runner
- Codex-Run starten als Kernfunktion
- Projektbaum
- Plugin-System
- Task Runner
- Test Runner
- Build Runner
- Issue Board
- Kanban
- Notifications-Zentrale
- Actions-Dashboard Deluxe
- Wiki
- Discussions
- allgemeines Projekt-Dashboard

Merksatz:

Wir wollten einen Schraubendreher, nicht Jira.

## 13. Geklärte Entscheidungen und offene Punkte

### 13.1 Geklärte Entscheidungen

Mehrere Repositories:
- Source Companion soll mehrere Repositories gleichzeitig öffnen können.
- Umsetzung über Tabs.
- Jeder Tab ist ein Repository-Kontext.
- Zusätzlich soll es eine kleine Projektauswahl mit zuletzt geöffneten Repositories geben.

Workspaces:
- Für das erste Produktziel keine Workspaces.
- Nur zuletzt geöffnete Repositories.
- Workspaces können später neu bewertet werden, wenn Multi-Repo-Tabs nicht reichen.

Clone/Publish Zielordner:
- Zielordner muss frei wählbar sein.
- Kein harter Standardordner.
- Ein zuletzt genutzter Ordner kann optional vorgeschlagen werden.

Hosting-Integration:
- Erstmal nur GitHub.
- Kein GitLab.
- Kein Bitbucket.
- Keine generische Forge-Abstraktion im ersten Produktziel.

Graph/History:
- Graph/History muss einklappbar sein.
- Er darf sichtbar und schnell erreichbar sein, aber nicht dauerhaft Platz erzwingen.

Stash:
- Stash ist erlaubt.
- Nur Basisfunktionen.
- Kein komplexer Stash-Manager.

Merge/Rebase:
- Merge bleibt im ersten Produktziel als begrenzte Basisfunktion.
- Erlaubt ist nur: aktuellen Branch mit einem ausgewaehlten Branch mergen.
- Ziel-Branch, Fortschritt, Erfolg, Git-Fehler, Konfliktzustand und Git Output muessen sichtbar sein.
- Rebase, interaktives Rebase und andere History-Rewrites bleiben ausserhalb des ersten Produktziels.

Force Push:
- Erstmal nicht.
- Kein Force-Push-Button im ersten Produktziel.
- Kein versteckter Force Push über Sync oder Push.

AI Commit Message:
- Nicht ausgeschlossen.
- Wichtiges Feature, muss separat durchdacht werden.
- Darf nicht zu AI Chat oder Agent-Workflow ausarten.

### 13.2 Geklärt: SSH-Key-Handling

SSH-Key-Handling bedeutet:

Git kann Repositories entweder über HTTPS oder über SSH klonen/pushen.

HTTPS-Beispiel:
- https://github.com/user/repo.git
- Auth läuft typischerweise über GitHub Login, Token oder Credential Manager.

SSH-Beispiel:
- git@github.com:user/repo.git
- Auth läuft über lokale SSH-Keys, die auf dem Rechner liegen und bei GitHub hinterlegt sind.

Entscheidung:
- Kein eigenes SSH-Key-Management bauen.
- HTTPS über GitHub Login priorisieren.
- SSH-URLs akzeptieren, wenn das lokale Git/SSH-Setup bereits funktioniert.
- Wenn SSH fehlschlägt, eine verständliche Fehlermeldung anzeigen.

Begründung:
- SSH-Key-Management ist schnell ein eigenes Sicherheits- und Betriebssystem-Thema.
- Es hilft nicht direkt beim Kern-UI-Erlebnis.
- GitHub Login plus HTTPS reicht für den wichtigsten Clone/Publish-Workflow.

### 13.3 Geklärt: Hunk-Staging

Hunk-Staging bedeutet:

Eine Datei wird nicht komplett staged, sondern nur ein einzelner zusammenhängender Änderungsblock innerhalb der Datei.

Beispiel:
- Datei `app.ts` hat drei Änderungen.
- Änderung 1 gehört zu Commit A.
- Änderung 2 gehört zu Commit B.
- Änderung 3 ist noch unfertig.

Mit Datei-Staging kann man nur die ganze Datei stage/unstage.

Mit Hunk-Staging kann man gezielt nur Änderung 1 stagen und committen, während Änderung 2 und 3 unstaged bleiben.

Produktwert:
- saubere kleine Commits
- bessere Reviewbarkeit
- weniger versehentliche Änderungen im Commit

Kosten:
- Diff-UI wird komplexer.
- Git-Patch-Anwendung muss robust sein.
- Fehlerfälle bei verschobenen Änderungen und Whitespace müssen sauber behandelt werden.

Entscheidung:
- Hunk-Staging muss rein.
- Hunk stage/unstage gehört in das erste Produktziel.
- Source Companion soll nicht nur Datei-Staging können, sondern ernsthaft saubere Commit-Erstellung unterstützen.

### 13.4 Noch zu klären: AI Commit Message

AI Commit Message ist potenziell wichtig, aber gefährlich für den Scope.

Erlaubbare Richtung:
- leeres Commit-Message-Feld kann eine Commit Message generieren, aehnlich Codex
- alternativ oder ergaenzend: expliziter Button zum Vorschlagen einer Commit Message
- Vorschlag basiert nur auf staged diff
- Nutzer muss Message prüfen und selbst committen
- kein autonomer Commit
- kein Chatfenster
- kein Agent-Loop

Noch zu klären:
- lokal eingebaut oder externer Codex-Aufruf
- ob leeres Feld direkt generiert oder vorher eine kurze Bestaetigung zeigt
- nur staged diff oder auch unstaged context
- Datenschutz/Prompt-Anzeige
- Kosten/Rate-Limits
- ob das Feature Teil des ersten Produktziels oder eine spätere Erweiterung wird

## 14. Finale Definition

Source Companion ist eine dedizierte Git/GitHub-Oberfläche.

Es zeigt Git-Zustand, macht Änderungen prüfbar und führt Git/GitHub-Versionskontrollschritte aus.

Es bearbeitet keinen Code, startet keine Terminals, führt keine Tasks aus und verhält sich nicht wie ein Agent.

Sein einziger Zweck:

Cursor nur für Git ersetzen.
