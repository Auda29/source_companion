# Floating Window Concept

Stand: 2026-06-09

## Entscheidung

Das Floating Window ist der kompakte Desktop-Modus fuer den aktiven Repository-Kontext. Es zeigt nur die wichtigsten Source-Control-Informationen und startet nur kurze, eindeutig sichtbare Git-Aktionen. Fuer Diff-Pruefung, Datei-/Hunk-Staging, Branch-Verwaltung, Stash, GitHub PRs, Checks, Review-Kommentare und detaillierten Git Output fuehrt es in die Full UI.

Floating Window und Full UI nutzen denselben Repository-State, dieselbe Git Operation Queue und denselben Git Output. Es gibt keinen zweiten Repository-Store und keine eigenstaendige Git-Ausfuehrung im Floating Window.

## Layout

Das Fenster bleibt einspaltig und dicht:

- Kopfzeile mit Repository-Name, Branch und Sync-Status.
- Change-Zeile mit Zaehlern fuer Changed, Staged, Untracked und Conflicts.
- Commit-Bereich mit kompakter Commit-Message-Eingabe und Primaeraktion.
- Aktionsleiste fuer Commit, Commit and Push, Push und Pull/Sync.
- Statuszeile fuer laufende Operationen, letzte erfolgreiche Aktion oder lesbaren Fehler.
- Full-UI-Schaltflaeche fuer alle detaillierten Ansichten.

Das Fenster zeigt keine Sidebar, keine Datei-Liste, keinen Diff, keinen Graph, keinen Projektbaum und kein Terminal. Wenn mehr Detail noetig ist, oeffnet die Aktion die Full UI mit dem gleichen aktiven Repository-Kontext.

## Sichtbare Felder

Pflichtfelder:

- Repository-Anzeigename
- aktueller Branch
- Upstream oder Hinweis "no upstream"
- ahead/behind-Zaehler, sofern bekannt
- Sync-Zustand: clean, local changes, ahead, behind, diverged, conflict oder unknown
- Change-Zaehler fuer staged, unstaged, untracked und conflicted Dateien
- Commit-Message
- laufende Operation oder letzter Fehler

Optionale Felder:

- gekuerzter Repository-Pfad im Tooltip oder Sekundaertext
- GitHub-Remote-Hinweis, wenn der aktive Kontext eine erkannte GitHub-Zuordnung hat
- letzter erfolgreicher Commit-/Push-Zeitpunkt aus dem lokalen Operation-Snapshot

Nicht sichtbar:

- Token-Werte
- rohe Git-Argumente
- vollstaendige Dateipfade aller Changes
- GitHub-Dashboarddaten ausserhalb der PR-/Versionskontrollflaeche der Full UI

## Erlaubte Aktionen

Direkt im Floating Window erlaubt:

- Refresh: laedt den Repository-State ueber den bestehenden Watcher-/Refresh-Pfad.
- Commit: erstellt einen normalen Commit aus staged changes mit der eingegebenen Message.
- Commit and Push: fuehrt Commit und anschliessend Push nur nach expliziter Auswahl aus; beide Schritte bleiben als Queue-/Git-Output-Eintraege sichtbar.
- Push: pusht den aktuellen Branch ohne Force-Push.
- Pull/Sync: startet den bestehenden Pull-/Sync-Flow fuer den aktiven Branch.
- Open Full UI: fokussiert oder oeffnet die Full UI fuer denselben Repository-Kontext.

Nur ueber Full UI erlaubt:

- Datei- und Hunk-Staging
- Discard
- Amend
- Branch erstellen, wechseln oder loeschen
- Stash-Aktionen
- Publish
- GitHub Login/Logout
- PR-Erstellung, PR-Checks und Review-Kommentare
- Diff- und History-Ansichten
- detaillierter Git Output

Ausgeschlossen:

- Terminal oder freier Command Runner
- Projektbaum oder Datei-Bearbeitung
- Dashboard, Task Runner oder Notifications-Zentrale
- Force Push
- automatischer Commit, Push oder Publish ohne explizite Nutzeraktion

## Fehler- und Busy-Zustaende

Das Floating Window zeigt genau einen primaeren Status:

- `idle`: keine laufende Operation; Aktionen richten sich nach aktuellem Repository-State.
- `refreshing`: Status wird geladen; schreibende Aktionen bleiben verfuegbar nur, wenn keine Queue-Operation im Repository laeuft.
- `running`: eine Git-Operation laeuft; weitere schreibende Aktionen sind fuer diesen Repository-Kontext deaktiviert.
- `blocked`: Konflikte, fehlender Upstream, fehlende Commit-Message, leeres Staging oder ungueltiger Repository-Pfad verhindern die Aktion.
- `error`: die letzte Aktion ist fehlgeschlagen; kurze Fehlererklaerung wird angezeigt, Details liegen im Git Output der Full UI.

Fehlertexte muessen handlungsnah sein:

- fehlende Commit-Message: "Enter a commit message."
- leeres Staging fuer Commit: "Stage changes before committing."
- fehlender Upstream fuer Push/Pull: "Set an upstream branch in the Full UI."
- Konfliktzustand: "Resolve conflicts in the Full UI."
- verschwundener Pfad: "Repository path is no longer available."
- Git-Fehler: normalisierte Fehlermeldung aus dem bestehenden Fehlervertrag.

## Warnungsweiterleitung

Gefaehrliche Aktionen laufen nicht direkt im Floating Window, wenn sie eine bestaetigte Warnung brauchen. Das betrifft Discard, Amend, Branch loeschen, Remote ueberschreiben und Public Publish.

Wenn der Nutzer einen Zustand erreicht, der eine solche Aktion nahelegt, zeigt das Floating Window nur einen knappen Hinweis und eine Full-UI-Aktion. Die bestaetigte Warnung und die eigentliche Ausfuehrung bleiben in der Full UI.

## Fokusverhalten

Beim Start zeigt das Floating Window den zuletzt aktiven Repository-Kontext, falls dieser noch gueltig ist. Gibt es keinen aktiven Kontext, zeigt es einen leeren Zustand mit "Open Full UI".

Fokusregeln:

- Commit-Message erhaelt Fokus, wenn staged changes vorhanden sind und keine Operation laeuft.
- Nach erfolgreichem Commit bleibt der Fokus im Commit-Feld, damit ein weiterer kleiner Commit vorbereitet werden kann.
- Nach Commit and Push, Push oder Pull/Sync wandert der Fokus auf die Statuszeile, damit Erfolg oder Fehler wahrnehmbar ist.
- Bei Fehlern wird die Statuszeile fokussierbar; Enter auf "Open Full UI" oeffnet den betroffenen Kontext mit Git Output sichtbar.
- Umschalten zur Full UI behaelt aktiven Tab, Repository-Kontext, Queue-Snapshot und Fehlerzustand bei.

## Gemeinsame State- und Queue-Nutzung

Das Floating Window liest ausschliesslich aus dem bestehenden Repository-Kontextmodell:

- Repository-ID
- Pfad und Anzeigename
- Branch, Upstream, ahead/behind
- Change-Buckets
- Konflikt- und Fehlerzustand
- laufende und queued Operationen
- letzter Git Output Snapshot

Aktionen werden ueber dieselbe Desktop-Bridge und dieselbe `GitOperationQueue` gestartet wie in der Full UI. Pro Repository bleibt dadurch nur eine schreibende Git-Operation gleichzeitig moeglich. Watcher-Refreshes nutzen den bestehenden entprellten Refresh-Pfad und duerfen laufende Nutzeraktionen nicht ueberholen.

Das Floating Window speichert nur lokale UI-Praeferenzen wie Fensterposition, Groesse und letzter Modus. Es speichert keine Tokens, keine GitHub-Antworten, keine Repository-Duplikate und keine abgeleiteten Git-Argumente.
