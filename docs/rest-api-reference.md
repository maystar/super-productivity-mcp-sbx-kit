# Super Productivity Local REST API — Referenz

> Quelle: https://github.com/super-productivity/super-productivity/wiki/3.01-API#3-local-rest-api
> Erfasst am 2026-09-14 durch automatisierte Zusammenfassung der Wiki-Seite (kein 1:1-Zitat der
> ganzen Seite) — **vor der Implementierung des MCP-Servers (TODO.md Schritt 7) gegen die dann
> aktuelle Seite gegenprüfen**, falls etwas nicht zum beobachteten Verhalten passt. Diese Datei
> existiert, damit ein Agent innerhalb der Sandbox (ohne Zugriff auf das Gespräch, in dem das hier
> recherchiert wurde, und ohne notwendigerweise Netzwerkzugriff auf github.com) die API kennt.

## Basis

- Base URL: `http://127.0.0.1:3876` (Host-seitig; aus der Sandbox über `host.docker.internal:3876`)
- **Deaktiviert per Default.** Aktivieren: Super Productivity → Settings → Misc →
  **Enable local REST API**. Für Entwicklung: Env-Var `SP_FORCE_LOCAL_REST_API=1` beim Start
  umgeht die Einstellung.
- Nur Electron-Desktop-App (nicht Web/Mobile). App muss laufen, Renderer muss ready sein.

## Auth

- Jeder Request außer `GET /health` braucht Header `Authorization: Bearer <token>`.
- Token wird beim Aktivieren automatisch generiert, sichtbar/regenerierbar unter
  Settings → Misc → **Access Token**.
- Fehlender/ungültiger Token → `401 UNAUTHORIZED`.
- Sicherheitsmodell laut Doku: Grenze zwischen **Benutzerkonten** auf der Maschine, nicht zwischen
  Anwendungen — jeder Prozess, der als derselbe User läuft, kann die Token-Datei lesen.

## Response-Envelope

Erfolg:
```json
{ "ok": true, "data": /* Endpoint-spezifisch */ }
```
Fehler:
```json
{ "ok": false, "error": { "code": "<CODE>", "message": "<Beschreibung>" } }
```

## Endpunkte

### Health

- **GET `/health`** — unauthentifiziert. `{ "ok": true, "data": { "server": "up", "rendererReady": true } }`

### Tasks

- **GET `/tasks`** — Liste, optionale Query-Parameter:
  - `query` (string): Titel enthält, case-insensitive
  - `projectId` (string)
  - `tagId` (string)
  - `includeDone` (boolean, Default `false`)
  - `source` (`"active"` | `"archived"` | `"all"`)
- **GET `/tasks/:id`** — einzelner Task
- **POST `/tasks`** — erstellen
  - Pflichtfeld: `title` (nicht-leerer String)
  - Optional: `parentId`, `notes`, `isDone`, `timeEstimate`, `timeSpent`, `projectId`, `tagIds`,
    `dueDay`, `dueWithTime`, `plannedAt`, `deadlineDay`, `deadlineWithTime`, `deadlineRemindAt`
  - Subtask erbt `projectId` des Parents, kann keine eigenen Tags haben
- **PATCH `/tasks/:id`** — Teilupdate
  - `parentId`/`subTaskIds` können NICHT geändert werden → `400`
  - `deadlineDay`, `deadlineWithTime`, `deadlineRemindAt` schließen sich gegenseitig aus
- **DELETE `/tasks/:id`** — löschen
- **POST `/tasks/:id/start`** — als aktuellen Task setzen
- **POST `/tasks/:id/archive`** — archivieren
- **POST `/tasks/:id/restore`** — aus Archiv wiederherstellen

### Task-Control

- **GET `/task-control/current`** — aktueller Task
- **POST `/task-control/current`** — Body `{ "taskId": "<id>" }` oder `{ "taskId": null }` zum Löschen
- **POST `/task-control/stop`** — aktuellen Task stoppen
- **GET `/status`** — aktueller Task + Task-Anzahl

### Focus Mode (read-only)

- **GET `/focus`**:
  - `mode`: `"Flowtime"` | `"Pomodoro"` | `"Countdown"`
  - `cycle`: number
  - `isSessionDone`: boolean
  - `timer`: `null` oder `{ purpose, status, isOvertime, isLongBreak, elapsedMs, remainingMs, durationMs }`

### Projects / Tags

- **GET `/projects`** — Query-Parameter `query` (Titel enthält, case-insensitive)
- **GET `/tags`** — Query-Parameter `query` (Titel enthält, case-insensitive)

## Fehlercodes

| Code | HTTP-Status | Bedeutung |
|---|---|---|
| `UNAUTHORIZED` | 401 | Token fehlt/ungültig |
| `TASK_NOT_FOUND` | 404 | Task existiert nicht |
| `PROJECT_NOT_FOUND` | 404 | Projekt existiert nicht/archiviert |
| `INVALID_INPUT` | 400 | Body/Feld-Typen falsch |
| `UNSUPPORTED_FIELD` | 400 | Feld darf nicht geändert werden |
| `NOT_FOUND` | 404 | Route existiert nicht |
| `INTERNAL_ERROR` | 500 | Serverfehler |
