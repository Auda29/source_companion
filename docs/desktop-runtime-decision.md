# Source Companion - Desktop Runtime Decision

Stand: 2026-06-03

## Entscheidung

Source Companion nutzt fuer das Desktop-Ziel Tauri als lokale Desktop-Shell.

Die bestehende Web-/HTML-UI bleibt die wiederverwendbare Frontend-Schicht. Tauri stellt darum eine kontrollierte native Bridge fuer lokale Git-, Dateisystem-, Watcher- und GitHub-Auth-Funktionen bereit. Der Renderer erhaelt keine freie Node-, Shell- oder Dateisystem-Schnittstelle.

Electron bleibt eine moegliche Ausweichoption, falls eine spaetere technische Pruefung zeigt, dass Tauri eine harte Produktanforderung nicht stabil abdeckt. Fuer den geplanten Kernumfang ist Tauri jedoch die bevorzugte und dokumentierte Richtung.

## Bewertete Optionen

| Kriterium | Tauri | Electron | Entscheidung |
| --- | --- | --- | --- |
| Lokale Git-CLI-Ausfuehrung | Git kann ueber whitelisted Rust-Commands aus der Shell gestartet werden; stdout, stderr, Exit-Code und Abort-Signale bleiben backend-kontrolliert. | Git kann ueber Node child_process gestartet werden; Isolation muss besonders strikt konfiguriert werden. | Tauri, weil die Bridge standardmaessig enger geschnitten werden kann. |
| Dateiwatcher | Native Watcher passen gut in die Rust-Seite und koennen Status-Refreshes ueber die bestehende Queue anstossen. | Node-Watcher sind einfach verfuegbar, laufen aber im gleichen Oekosystem wie weitere Node-Faehigkeiten. | Tauri, weil Watcher als Backend-Funktion klar vom Renderer getrennt bleiben. |
| Datei-/Ordnerauswahl | Native Dialoge koennen als erlaubte Bridge-Aktionen fuer Repo oeffnen, Clone-Ziel und Publish-Ziel angeboten werden. | Native Dialoge sind ebenfalls moeglich. | Gleichstand; beide erfuellen die Anforderung. |
| GitHub Auth | Systembrowser-, Redirect- oder Device-Flow kann von der nativen Schicht koordiniert werden; Token landen nicht im lokalen UI-State. | Ebenfalls moeglich, typischerweise mit Node-/Electron-spezifischem Keychain-Modul. | Tauri, weil Auth in derselben engen Backend-Grenze wie Git und Filesystem bleibt. |
| Sichere Token-Speicherung | Token werden nur ueber eine native Secure-Storage-Abstraktion gelesen/geschrieben. Die konkrete Auth-Variante und Speicher-Implementierung werden in `T37` festgelegt. | Sichere Speicherung ist moeglich, benoetigt aber eigene Electron/Node-Abhaengigkeiten und strikte Renderer-Isolation. | Tauri als Runtime; konkrete Speicherentscheidung folgt in `T37`. |
| Packaging | Kleine Desktop-App ist konsistent mit dem Produktziel eines fokussierten Git/GitHub-Tools. | Reifer und breit genutzt, aber mit groesserem Runtime-Footprint. | Tauri, weil schlanke Auslieferung zum Produktziel passt. |
| Updates | Native Update-Strategie kann spaeter eingeplant werden, ohne die Produktdomaene zu erweitern. | Update-Flows sind etabliert. | Kein Blocker fuer beide; Tauri bleibt bevorzugt. |
| UI-Wiederverwendung | Die vorhandene Web-UI kann unveraendert als Renderer weitergefuehrt und schrittweise ueber Bridge-APIs ersetzt werden. | Ebenfalls moeglich. | Gleichstand; beide erfuellen die Anforderung. |

## Architekturregeln

- Renderer-Code ruft keine freien Shell-Kommandos auf.
- Git laeuft nur ueber den bestehenden whitelisted Git CLI Wrapper.
- Dateiwatcher, lokale Dialoge und GitHub Auth laufen ueber explizit benannte Bridge-Commands.
- Der lokale State Store darf keine Tokens oder Geheimnisse speichern.
- Floating Window und Full UI teilen denselben Repository-State und dieselbe Operation Queue.
- Die Desktop-Shell fuegt keine neue Produktdomaene hinzu: kein Terminal, kein Projektbaum, kein Task Runner, kein Dashboard.

## Folgen fuer Desktop-Tasks

- `T48` bereitet Tauri als Shell fuer die Full UI vor.
- `T37` entscheidet auf dieser Grundlage den konkreten GitHub-Auth-Flow und die sichere Token-Speicherung.
- `T38` implementiert Login, Logout, Auth-Status und User-Repos gegen diese Auth-Entscheidung.
