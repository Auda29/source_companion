# Source Companion - Desktop Shell

Stand: 2026-06-09

## Ziel

Die Tauri-Shell startet die bestehende Full UI in einem lokalen Desktop-Fenster. Der kontrollierte Repository-Bridge-Vertrag fuer Git- und Repository-State-Aktionen ist in `docs/desktop-bridge.md` beschrieben; native Dialoge, Desktop-Watcher und GitHub-Auth folgen in den naechsten Desktop-Tasks.

## Startpunkte

- `npm install` installiert die Tauri CLI fuer lokale Desktop-Laeufe.
- `npm run desktop:assets` kopiert `index.html` und `src/` nach `desktop-dist/`.
- `npm run desktop:dev` startet die Tauri-Entwicklungsansicht und fuehrt vorher den Asset-Kopiervorgang aus.
- `npm run desktop:build` baut das Desktop-Bundle und fuehrt vorher den Asset-Kopiervorgang aus.

## Asset-Grenze

`src-tauri/tauri.conf.json` verweist auf `../desktop-dist` statt auf das Repository-Root. Dadurch werden nur die vorhandene Full-UI-Startdatei und ihre `src/`-Assets eingebettet; Dokumentation, Tests, Git-Daten und Tauri-Quellen werden nicht als Frontend-Assets ausgeliefert.

## Security-Konfiguration

Der Renderer laeuft als Tauri-Webview ohne Node-Zugriff. Die aktuelle Capability erlaubt nur `core:default` fuer das Hauptfenster und keine Shell-, Dateisystem- oder Command-Plugins. Die Content-Security-Policy ist auf eigene Assets und die bereits vorhandenen GitHub-HTTP-Ziele begrenzt.

## Erwartete UI-Zustaende

Da die Shell dieselbe `index.html` und dieselben `src/`-Dateien nutzt, bleiben die bestehenden leeren und fehlerhaften Startzustaende der Full UI sichtbar. Native Dialoge, Desktop-Watcher und GitHub-Auth sind bewusst noch nicht Teil dieser Shell.
