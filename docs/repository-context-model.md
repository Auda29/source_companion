# Repository-Kontextmodell

Dieses Modell beschreibt den Zustand, den Source Companion pro geoeffnetem Repository-Tab haelt. Es ist die fachliche Grundlage fuer App-Shell, Source-Control-UI, Git Operation Queue, Dateiwatcher und GitHub-Anbindung.

## Grundregel

Jeder Tab repraesentiert genau einen `RepositoryContext`. Es gibt keine Workspaces und keinen globalen aktiven Repository-Singleton als Quelle fuer Git- oder GitHub-Operationen.

UI-Aktionen muessen immer eine `repositoryId` uebergeben. Backend-Antworten, Operationen und Fehler muessen dieselbe `repositoryId` zurueckliefern, damit parallele Tabs nicht vermischt werden.

## Typmodell

```ts
type RepositoryId = string;
type OperationId = string;

type RepositoryKind =
  | "no-folder"
  | "folder-without-git"
  | "git-repository";

type RepositoryHealth =
  | "ready"
  | "operation-running"
  | "conflict"
  | "error";

type GitRemoteKind = "none" | "generic-git" | "github";

type GitFileGroup = "changed" | "staged" | "untracked" | "conflicted";

type GitFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed"
  | "unmerged"
  | "unknown";

interface RepositoryContext {
  id: RepositoryId;
  path: string;
  displayName: string;
  kind: RepositoryKind;
  health: RepositoryHealth;
  git: GitState;
  github: GitHubLink | null;
  operations: RepositoryOperationState;
  error: RepositoryError | null;
  lastRefresh: RefreshState;
}

interface GitState {
  branch: BranchState | null;
  remote: RemoteState | null;
  upstream: UpstreamState | null;
  divergence: AheadBehind;
  files: GitFileState[];
}

interface BranchState {
  name: string;
  detached: boolean;
  headSha: string | null;
}

interface RemoteState {
  name: string;
  url: string;
  kind: GitRemoteKind;
}

interface UpstreamState {
  remoteName: string;
  branchName: string;
  ref: string;
}

interface AheadBehind {
  ahead: number;
  behind: number;
}

interface GitFileState {
  path: string;
  oldPath: string | null;
  group: GitFileGroup;
  status: GitFileStatus;
  staged: boolean;
  conflicted: boolean;
}

interface GitHubLink {
  owner: string;
  name: string;
  defaultBranch: string | null;
  authenticated: boolean;
  htmlUrl: string;
}

interface RepositoryOperationState {
  running: RepositoryOperation[];
  queued: RepositoryOperation[];
  lastCompleted: RepositoryOperationResult | null;
}

interface RepositoryOperation {
  id: OperationId;
  repositoryId: RepositoryId;
  kind:
    | "status"
    | "diff"
    | "stage"
    | "unstage"
    | "discard"
    | "commit"
    | "branch"
    | "switch"
    | "fetch"
    | "pull"
    | "push"
    | "clone"
    | "init"
    | "stash";
  startedAt: string | null;
  abortable: boolean;
}

interface RepositoryOperationResult {
  operationId: OperationId;
  repositoryId: RepositoryId;
  status: "succeeded" | "failed" | "aborted";
  completedAt: string;
  error: RepositoryError | null;
}

interface RepositoryError {
  kind:
    | "invalid-path"
    | "not-a-git-repository"
    | "git-error"
    | "github-error"
    | "operation-running"
    | "conflict"
    | "watcher-error";
  message: string;
  raw: string | null;
  operationId: OperationId | null;
  repositoryId: RepositoryId;
}

interface RefreshState {
  status: "idle" | "scheduled" | "running" | "deferred" | "failed";
  requestedAt: string | null;
  completedAt: string | null;
}
```

## Feldregeln

- `id`: stabile Kontext-ID fuer einen Tab. Sie ist nicht der Pfad selbst, damit ein Pfadwechsel oder eine Normalisierung nicht versehentlich andere Kontexte ersetzt.
- `path`: normalisierter lokaler Ordnerpfad. Fuer `no-folder` darf der Wert leer sein; fuer Repository-Operationen muss er gesetzt sein.
- `displayName`: kurzer Anzeigename, normalerweise Ordnername oder `owner/name` nach GitHub-Erkennung.
- `kind`: unterscheidet leeren Startzustand, Ordner ohne Git und Git-Repository.
- `health`: fasst den sichtbaren Hauptzustand zusammen, ersetzt aber nicht die Detailfelder fuer Fehler, Konflikte oder Operationen.
- `git.branch`, `git.remote`, `git.upstream` und `git.divergence`: werden aus Git geladen und nicht aus UI-Texten abgeleitet.
- `git.files`: enthaelt nur Git-relevante Aenderungen. Source Companion fuehrt keinen Projektbaum.
- `github`: ist nur gesetzt, wenn ein GitHub-Remote erkannt wurde. `authenticated` beschreibt, ob der aktuelle GitHub-Login fuer diese Verknuepfung nutzbar ist.
- `operations`: enthaelt nur Operationen dieses Repository-Kontexts. Parallele Operationen in anderen Repositories erscheinen dort nicht.
- `error`: aktueller sichtbarer Fehler fuer diesen Kontext. Rohdaten bleiben optional fuer Git Output verfuegbar.
- `lastRefresh`: koordiniert Dateiwatcher, manuelles Refresh und laufende Git-Operationen.

## Isolationsregeln

- Tab-Wechsel aendert nur die sichtbare Auswahl, nicht den gespeicherten Zustand anderer `RepositoryContext`-Eintraege.
- Schliessen eines Tabs entfernt nur den betroffenen Kontext und dessen Watcher, Queue-Eintraege und nicht-persistente Fehler.
- Git Operation Queue, Dateiwatcher und GitHub API Client duerfen keine implizite globale `activeRepository`-Variable verwenden.
- Persistierter lokaler State speichert zuletzt geoeffnete Pfade und UI-Praeferenzen, aber keine laufenden Operationen, Fehler oder Tokens.
- GitHub-Token gehoeren zur Auth- und Token-Verwaltung, nicht in den `RepositoryContext`.

## Zustandsableitung

Die UI darf sichtbare Labels aus diesem Modell ableiten, aber keine fachlichen Repository-Zustaende aus verstreuten UI-Flags rekonstruieren. Massgeblich sind:

- `kind` fuer Start-, Nicht-Git- und Git-Repo-Zustaende
- `health` und `error` fuer Fehler, Konflikte und laufende Operationen
- `git.files` fuer Changed, Staged, Untracked und Conflicts
- `git.branch`, `git.upstream` und `git.divergence` fuer Branch- und Sync-Anzeige
- `github` fuer GitHub-spezifische Aktionen wie PRs, Checks, Clone from GitHub und Publish to GitHub
