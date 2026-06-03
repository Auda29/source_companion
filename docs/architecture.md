# Source Companion - Architektur-Start

Dieses Dokument beschreibt die erste technische Komponentenstruktur fuer Source Companion. `docs/plan.md` bleibt die verbindliche Produktquelle; `docs/scope-gates.md` begrenzt neue Architekturentscheidungen auf Git/GitHub-Versionskontrolle.

## Architekturprinzipien

- Jeder geoeffnete Tab repraesentiert genau einen Repository-Kontext.
- UI-Komponenten duerfen Git- und GitHub-Aktionen nur ueber whitelisted Backend-Schnittstellen starten.
- Es gibt keinen freien Command Runner, kein Terminal, keinen Editor und keine Plugin-Plattform.
- Fehler werden strukturiert an die UI gemeldet und koennen zusaetzlich rohe Git- oder GitHub-Ausgaben enthalten.

## Runtime-Entscheidung

Die Web-/HTML-UI bleibt die Frontend-Schicht fuer Prototyp und Full UI. Fuer das Desktop-Ziel ist Tauri gewaehlt; die Begruendung und Bewertung gegen Electron stehen in `docs/desktop-runtime-decision.md`.

Tauri stellt nur eine kontrollierte Bridge fuer lokale Git-CLI-Ausfuehrung, Dateiwatcher, Datei-/Ordnerauswahl, GitHub Auth und sicheren Tokenzugriff bereit. Renderer-Code erhaelt keine freie Node-, Shell- oder Dateisystem-Schnittstelle. Floating Window und Full UI muessen denselben Repository-State und dieselbe Git Operation Queue nutzen.

## UI-Schichten

### App Shell und Projektauswahl

Verantwortung:
- zuletzt geoeffnete Repositories anzeigen
- lokale Repositories, Clone- und Publish-Einstiege anbieten
- Repository-Kontexte als Tabs oeffnen und schliessen

Erlaubte Eingaben:
- lokal ausgewaehlte Ordnerpfade
- Clone-URLs
- GitHub-Repository-Auswahl aus dem GitHub API Client
- Nutzeraktionen fuer Oeffnen, Clone, Publish und Tab-Wechsel

Fehlerausgaben:
- ungueltiger oder nicht mehr vorhandener Pfad
- Ordner ohne Git-Repository
- Clone- oder Publish-Vorbedingungen nicht erfuellt
- fehlende GitHub-Authentifizierung

Ausgeschlossene Funktionen:
- Workspaces
- Projektbaum
- Dashboard- oder Projektmanagementansichten

### Source-Control-Schicht

Verantwortung:
- aktuellen Repository-Zustand darstellen
- Changed, Staged, Untracked und Conflicts trennen
- Datei- und Hunk-Aktionen ausloesen
- Commit-, Branch-, Sync- und Stash-Aktionen sichtbar machen

Erlaubte Eingaben:
- aktiver Repository-Kontext
- strukturierte Git-Zustandsdaten
- Nutzeraktionen fuer erlaubte Git-Kommandos
- bestaetigte Sicherheitsdialoge fuer riskante Aktionen

Fehlerausgaben:
- lesbare Git-Fehler nahe der betroffenen Aktion
- Operation-laeuft- und Abbruchzustaende
- Konfliktzustaende nach Pull, Merge oder Stash Apply

Ausgeschlossene Funktionen:
- Datei-Bearbeitung
- Terminal-Ausgaben als einzige Fehlererklaerung
- Force Push oder versteckte History-Rewrites

### Diff- und History-Schicht

Verantwortung:
- unified Diff fuer ausgewaehlte Dateien darstellen
- staged und unstaged Diffs unterscheidbar anzeigen
- Binary-, neue, geloeschte und umbenannte Dateien verstaendlich behandeln
- einklappbare Commit-History und Divergenz anzeigen

Erlaubte Eingaben:
- Repository-Kontext
- Dateipfad und Diff-Modus
- Commit- oder Branch-Auswahl fuer History-Ansichten

Fehlerausgaben:
- Diff nicht verfuegbar
- Binary-Datei ohne Textdiff
- veralteter oder nicht mehr passender Hunk
- Git-Fehler beim Laden von Log oder Diff

Ausgeschlossene Funktionen:
- Side-by-side Diff als Pflicht fuer den Startumfang
- Inline-Editor
- Activity Feed oder Analytics-Dashboard

## Backend-Komponenten

### Repository-Kontextmodell

Verantwortung:
- Pfad, Anzeigenamen, Git-Zustand, Branch, Remote, Upstream, ahead/behind und GitHub-Verknuepfung pro Tab halten
- laufende Operationen und Fehler pro Repository isolieren
- globale Vermischung zwischen Tabs verhindern

Erlaubte Eingaben:
- normalisierte lokale Pfade
- Ergebnisse aus Git CLI Wrapper, Dateiwatcher und GitHub API Client
- Nutzeraktionen, die einem konkreten Repository-Kontext zugeordnet sind

Fehlerausgaben:
- `invalid-path`
- `not-a-git-repository`
- `git-error`
- `github-error`
- `operation-running`
- `conflict`

Ausgeschlossene Funktionen:
- Workspace-Modell
- globaler aktiver Repository-Singleton als Quelle fuer Operationen
- Zustandsableitung aus verstreuten UI-Flags

### Git CLI Wrapper

Verantwortung:
- erlaubte Git-Kommandos strukturiert ausfuehren
- stdout, stderr, Exit-Code und lesbare Fehler getrennt erfassen
- lange Operationen fuer Abbruch vorbereiten

Erlaubte Eingaben:
- Repository-Pfad
- whitelisted Git-Aktion
- strukturierte Argumente fuer `status`, `diff`, `add`, `restore`, `commit`, `branch`, `switch`, `fetch`, `pull`, `push`, `remote`, `clone`, `init`, `log` und `stash`
- optionales Abort-Signal fuer lange Operationen

Fehlerausgaben:
- Exit-Code
- stdout
- stderr
- normalisierte Fehlerkategorie
- nutzerlesbarer Fehlertext

Ausgeschlossene Funktionen:
- freie Shell-Kommandos
- nicht whitelisted Git-Subcommands aus der UI
- stiller Force Push
- automatisches Commit, Push oder Publish

### Git Operation Queue

Verantwortung:
- Git-Operationen pro Repository serialisieren
- parallele Operationen in unterschiedlichen Repositories erlauben
- Status-Refreshes fair einplanen und nicht dauerhaft verdraengen

Erlaubte Eingaben:
- Repository-Kontext-ID
- Git-Operation aus dem Git CLI Wrapper
- Prioritaet fuer Status-Refresh oder Nutzeraktion
- Abort-Signal

Fehlerausgaben:
- `queued`
- `running`
- `succeeded`
- `failed`
- `aborted`
- letzter strukturierter Git-Fehler

Ausgeschlossene Funktionen:
- globale Queue fuer alle Repositories
- parallele schreibende Git-Operationen im selben Repository
- stille Retry-Schleifen ohne sichtbaren Status

### GitHub API Client

Verantwortung:
- GitHub Login-Status nutzen
- User-Repositories laden und durchsuchen
- Repositories erstellen
- PRs, Checks und Review-Kommentare lesen oder erstellen, soweit im Produktplan erlaubt

Erlaubte Eingaben:
- gespeichertes GitHub-Token
- Such- und Filterparameter fuer Repositories
- Repository Owner/Name
- PR- und Branch-Daten
- Publish-Daten wie Name, Beschreibung und Sichtbarkeit

Fehlerausgaben:
- fehlende Authentifizierung
- fehlende Berechtigung
- Rate Limit
- Netzwerkfehler
- GitHub API Fehlertext und Statuscode

Ausgeschlossene Funktionen:
- GitLab-, Bitbucket- oder Forge-Abstraktion
- Issue Board, Kanban, Wiki oder Discussions
- eigenes SSH-Key-Management

Auth-Entscheidung:
- Der konkrete GitHub-Auth-Flow und die sichere Token-Speicherung sind in `docs/github-auth-decision.md` festgelegt.
- GitHub-API-Token duerfen nur durch die Auth-/Token-Verwaltung gelesen werden; der API Client erhaelt Tokens backend-intern und gibt sie nie an den Renderer weiter.

### Dateiwatcher

Verantwortung:
- Datei-, Index- und Git-Metadaten-Aenderungen erkennen
- Status-Refresh entprellen
- Branch-Wechsel und relevante `.git`-Aenderungen abdecken

Erlaubte Eingaben:
- Repository-Pfad
- Watcher-Konfiguration fuer Arbeitsbaum und `.git`
- Queue-Schnittstelle fuer geplante Refreshes

Fehlerausgaben:
- Watcher nicht startbar
- Pfad verschwunden
- Refresh wegen laufender Operation verschoben
- Watcher-Event verworfen oder zusammengefasst

Ausgeschlossene Funktionen:
- blindes Neuladen bei jedem Event
- Dateiinhalte bearbeiten
- Build-, Test- oder Task-Runner starten

### Lokaler State Store

Verantwortung:
- zuletzt geoeffnete Repositories speichern
- UI-Praeferenzen fuer erlaubte Git-Ansichten halten
- nicht-sensitive Repository-Metadaten persistieren

Erlaubte Eingaben:
- normalisierte Repository-Pfade
- Anzeigenamen
- zuletzt genutzte Clone-Zielordner
- UI-Zustand wie aktiver Tab, eingeklappter History-Bereich oder View Mode

Fehlerausgaben:
- Store nicht lesbar
- Store nicht schreibbar
- gespeicherter Pfad ist ungueltig
- gespeicherter Zustand wurde verworfen

Ausgeschlossene Funktionen:
- Token oder andere Geheimnisse speichern
- Workspace-Verwaltung
- Projektmanagementdaten

### Auth- und Token-Verwaltung

Verantwortung:
- GitHub-Login starten und beenden
- Token sicher speichern und abrufen
- fehlende oder unzureichende Berechtigungen fuer GitHub-Funktionen melden

Erlaubte Eingaben:
- GitHub Device-Flow-Ergebnis gemaess `docs/github-auth-decision.md`
- Logout-Aktion
- Anfrage nach Auth-Status fuer GitHub-Funktionen

Fehlerausgaben:
- Login fehlgeschlagen
- Token fehlt
- Token abgelaufen oder widerrufen
- Scope reicht nicht aus
- sichere Speicherung nicht verfuegbar

Ausgeschlossene Funktionen:
- eigenes SSH-Key-Management
- Speicherung von Tokens im lokalen State Store
- Speicherung von Tokens im Renderer, in Web Storage, in Repository-Kontexten, in Git-Remote-URLs oder in Git-Command-Argumenten
- automatische GitHub-Aktionen ohne explizite Nutzeraktion

Speicherentscheidung:
- Tauri koordiniert den GitHub OAuth Device Authorization Flow im Backend.
- Tokens werden ueber eine native `SecureTokenStore`-Abstraktion im Betriebssystem-Credential-Store gespeichert: Windows Credential Manager, macOS Keychain oder Linux Secret Service/libsecret.
- Der Web-Prototyp darf keine persistente GitHub-Auth einfuehren; echte Persistenz beginnt erst in der Desktop-Shell.

## Fehlervertrag

Jede Backend-Antwort, die fehlschlagen kann, liefert mindestens:

- `kind`: normalisierte Fehlerkategorie
- `message`: kurze nutzerlesbare Beschreibung
- `raw`: optionale Rohdaten wie stdout, stderr oder API-Antwort
- `operationId`: Zuordnung zu laufender Operation, falls vorhanden
- `repositoryId`: Zuordnung zum Repository-Kontext, falls vorhanden

Damit kann die UI Fehler direkt an der betroffenen Aktion zeigen und rohe Ausgaben im Git Output zugaenglich halten.
