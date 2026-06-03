# Source Companion - GitHub Auth Decision

Stand: 2026-06-03

## Entscheidung

Source Companion nutzt fuer das Desktop-Ziel einen GitHub OAuth Device Authorization Flow, koordiniert durch die Tauri-Backend-Schicht.

Der Renderer startet Login nur ueber einen erlaubten Bridge-Command. Die native Schicht fordert bei GitHub einen Device Code an, zeigt der UI nur User Code, Verification URL und Ablaufzeit und oeffnet optional den Systembrowser. Das Polling auf den Access Token laeuft ausschliesslich im Backend.

Tokens werden nicht im Renderer, nicht in `localStorage`, nicht im lokalen State Store, nicht in Git-Remote-URLs und nicht in Git-Command-Argumenten gespeichert.

## Begruendung

- Der Device Flow passt zu einer lokalen Desktop-App ohne eingebauten Browser-Redirect-Server.
- Der Token-Austausch bleibt in der Tauri-Backend-Grenze.
- Login funktioniert auch, wenn der Nutzer GitHub im Systembrowser authentifiziert.
- Die bestehende Web-UI kann denselben Login-Zustand anzeigen, ohne Zugriff auf das Secret zu erhalten.
- HTTPS bleibt fuer GitHub-Clone/Publish priorisiert; SSH wird nur genutzt, wenn das lokale Git/SSH-Setup bereits funktioniert.

## Erforderliche Scopes

Fuer das erste Produktziel werden diese Scopes angefordert:

- `repo`: private und public Repositories lesen, erstellen, klonen/pushen, PRs und Checks fuer Repository-Kontexte lesen oder erstellen.
- `read:user`: Login-Identitaet anzeigen und Auth-Status einem Nutzer zuordnen.

Nicht angefordert:

- `workflow`, weil Source Companion Workflows nicht steuert.
- Admin-, Org- oder Enterprise-Scopes.
- Scopes fuer Issues, Discussions, Wiki oder Notifications als eigene Produktdomaene.

Wenn GitHub spaeter eine feinere Scope-Variante fuer die benoetigten Version-Control-Aktionen stabil anbietet, darf `repo` durch diese engere Variante ersetzt werden. Bis dahin ist `repo` die explizite Startentscheidung, weil private Clone-, Publish-, PR- und Check-Flows sonst nicht konsistent funktionieren.

## Login-Ablauf

1. UI ruft `githubAuth.startDeviceLogin` ueber die Tauri-Bridge auf.
2. Backend fordert Device Code, User Code, Verification URL, Ablaufzeit und Polling-Intervall an.
3. UI zeigt User Code, Ziel-URL, Ablaufzeit und Login-Status.
4. Backend oeffnet auf Wunsch den Systembrowser mit der Verification URL.
5. Backend pollt mit dem von GitHub gelieferten Intervall.
6. `authorization_pending` bleibt ein sichtbarer Wartestatus.
7. `slow_down` erhoeht das Polling-Intervall und wird nicht als finaler Fehler angezeigt.
8. `expired_token`, abgelehnter Zugriff oder Netzwerk-/API-Fehler beenden den Login mit strukturiertem Fehler.
9. Nach Erfolg validiert das Backend Token, Nutzer und Scopes.
10. Erst nach erfolgreicher Scope-Pruefung speichert das Backend das Token im sicheren Speicher.

Die UI darf den Login abbrechen. Abbruch stoppt das Backend-Polling und speichert kein Token.

## Sichere Token-Speicherung

Die konkrete Speicherentscheidung ist eine Tauri-Backend-Abstraktion ueber den Betriebssystem-Credential-Store:

- Windows: Windows Credential Manager.
- macOS: Keychain.
- Linux: Secret Service/libsecret, falls verfuegbar.

Die Rust-Seite kapselt diese Speicherung als `SecureTokenStore`, zunaechst mit einem Keychain-/Credential-Store-Adapter. Der Adapter speichert:

- Service: `Source Companion`.
- Account-Key: `github.com:<login>`.
- Secret: GitHub Access Token.

Nicht-sensitive Metadaten duerfen separat im lokalen State Store liegen:

- GitHub Login.
- Token-Quelle `device-flow`.
- erkannte Scopes.
- Zeitpunkt der letzten Validierung.

Der lokale State Store enthaelt niemals das Token selbst.

Wenn der sichere Speicher nicht verfuegbar ist, meldet die App `secure-storage-unavailable` und laesst keinen dauerhaften Login zu. Ein optionaler Entwicklungsmodus darf nur einen in-memory Token fuer die aktuelle Laufzeit halten und muss in der UI als nicht persistiert erkennbar sein.

## HTTPS-Git-Verhalten

GitHub-API-Aufrufe nutzen das Token nur im Backend.

Fuer HTTPS-Clone, Push und Publish gilt:

- bevorzugt wird das vorhandene lokale Git Credential Manager Setup;
- ein Token wird nie in Remote-URLs geschrieben;
- ein Token wird nie als Git-CLI-Argument uebergeben;
- falls ein backend-only Credential-/Askpass-Flow noetig wird, darf er das Token nur kurzlebig im Backend-Prozess bereitstellen und muss nach der Git-Operation entfernt werden.

SSH-URLs bleiben erlaubt, aber Source Companion baut kein eigenes SSH-Key-Management. SSH-Fehler verweisen auf das lokale Git/SSH-Setup.

## Logout und Revocation

Logout bedeutet:

- Token aus dem Betriebssystem-Credential-Store loeschen.
- In-memory Token und Auth-Status loeschen.
- Repository-Kontexte auf `github.authenticated = false` aktualisieren.
- GitHub-spezifische Aktionen in den no-token Zustand zuruecksetzen.

Logout fuehrt keine Git-Aenderung aus und entfernt keine Remotes.

Token-Revocation ist eine separate, explizite Aktion, falls die OAuth-App-Konfiguration und GitHub API dies fuer das gespeicherte Token erlauben. Wenn Revocation fehlschlaegt, wird der lokale Logout trotzdem abgeschlossen und die UI zeigt den Revocation-Fehler als Zusatzhinweis.

Wenn ein Token extern widerrufen wurde, erkennt die naechste GitHub-API-Validierung den Fehler, loescht den lokalen Auth-Status und fordert erneutes Login an.

## No-Token Zustand

Ohne gueltiges Token liefert der Auth-Status:

```js
{
  authenticated: false,
  user: null,
  scopes: [],
  tokenSource: null,
  error: null
}
```

GitHub-Aktionen bleiben sichtbar, aber nicht still ausfuehrbar. Clone per URL bleibt ohne GitHub Login moeglich. Clone from GitHub, Publish to GitHub, PR-Erstellung, PR-Status, Checks und Review-Kommentare zeigen eine Login-Aufforderung mit Fehlerkategorie `github-auth-missing`.

## Fehlervertrag

GitHub-Auth- und API-Fehler folgen dem allgemeinen Backend-Fehlervertrag aus `docs/architecture.md` und ergaenzen GitHub-spezifische Felder:

```js
{
  kind: "github-auth-missing",
  message: "GitHub login is required for this action.",
  status: null,
  scopesRequired: [],
  scopesGranted: [],
  rateLimit: null,
  retryAfterSeconds: null,
  raw: null
}
```

### Fehlerkategorien

| Kind | Bedeutung | UI-Verhalten |
| --- | --- | --- |
| `github-auth-missing` | Kein Token vorhanden. | Login-Aktion anzeigen; GitHub-Aktion nicht ausfuehren. |
| `github-token-invalid` | Token wurde widerrufen, ist ungueltig oder GitHub meldet Bad Credentials. | Lokalen Auth-Status loeschen und erneutes Login anbieten. |
| `github-scope-missing` | Token hat nicht alle benoetigten Scopes. | Benoetigte und vorhandene Scopes anzeigen; erneutes Login anbieten. |
| `github-rate-limit` | Primaeres Rate Limit erreicht. | Reset-Zeit anzeigen; Retry erst nach Reset empfehlen. |
| `github-secondary-rate-limit` | Sekundaeres Abuse-/Burst-Limit erreicht. | Aktion pausieren; Retry-Hinweis aus Headern anzeigen, falls vorhanden. |
| `github-network-error` | DNS, TLS, Offline oder Timeout. | Netzwerkfehler lesbar anzeigen; keine Token-Loeschung. |
| `github-api-error` | GitHub liefert einen sonstigen API-Fehler mit Statuscode. | GitHub-Message und Statuscode anzeigen. |
| `github-login-expired` | Device Code ist abgelaufen. | Login neu starten lassen. |
| `github-login-cancelled` | Nutzer oder Backend hat Login abgebrochen. | Neutralen Abbruchstatus anzeigen. |
| `secure-storage-unavailable` | Betriebssystem-Credential-Store ist nicht verfuegbar. | Dauerhaften Login blockieren; keine unsichere Persistenz nutzen. |

Rate-Limit-Antworten muessen, soweit vorhanden, `limit`, `remaining`, `resetAt` und `retryAfterSeconds` enthalten. Netzwerkfehler duerfen nicht mit fehlender Auth verwechselt werden.

## Web-Prototyp Grenze

Der Web-Prototyp darf GitHub-Auth nur simulieren oder einen nicht persistierten Entwicklungszustand halten. Verboten sind:

- Token in `localStorage`, `sessionStorage` oder IndexedDB.
- Token in URL-Parametern.
- Token in statischen Konfigurationsdateien.
- Token in Repository-Kontexten oder Recent-Repositories.
- Token in Git-Remote-URLs.

Eine echte persistente GitHub-Anmeldung ist erst in der Desktop-Shell mit `SecureTokenStore` Teil der Implementierung.

## Folgen fuer T38

`T38` implementiert auf dieser Entscheidung nur:

- Device Login starten, Status anzeigen und abbrechen.
- Logout und optional Revocation ausloesen.
- Token ueber `SecureTokenStore` lesen/schreiben/loeschen.
- Auth-Status fuer Repository-Kontexte bereitstellen.
- User-Repositories laden und durchsuchen.
- Fehler nach diesem Vertrag normalisieren.

PR-, Check- und Publish-spezifische API-Methoden bleiben in den abhaengigen Tasks.
