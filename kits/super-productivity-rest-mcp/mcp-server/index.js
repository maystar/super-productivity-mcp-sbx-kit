#!/usr/bin/env node
// MCP-Server, der die Super Productivity Local REST API als Claude-Code-Tools kapselt.
//
// Endpunkt-/Feld-Referenz: ../../docs/rest-api-reference.md (siehe TODO.md Schritt 7 für Kontext
// und den Hinweis, das vor größeren Änderungen gegen die Live-Wiki-Seite gegenzuprüfen).
//
// Auth: Bearer-Token aus process.env.SP_REST_TOKEN. In der sbx-Sandbox ist das ein Custom-Secret-
// Platzhalter (siehe README.md) — der sbx-Proxy ersetzt ihn beim tatsächlichen Request an
// host.docker.internal durch den echten Access Token; dieser Prozess sieht nur den Platzhalter,
// braucht ihn aber nicht zu kennen, um ihn korrekt mitzuschicken.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.SP_REST_BASE_URL || "http://host.docker.internal:3876";
const TOKEN = process.env.SP_REST_TOKEN;

/**
 * Ruft einen Endpunkt der Super Productivity Local REST API auf.
 * @param {string} path z. B. "/tasks" oder "/tasks/abc123"
 * @param {object} [opts]
 * @param {string} [opts.method]
 * @param {Record<string, unknown>} [opts.query] Query-Parameter, undefined/leere Werte werden weggelassen
 * @param {unknown} [opts.body] wird als JSON gesendet
 * @param {boolean} [opts.auth] Default true; nur /health braucht keinen Token
 */
async function callApi(path, opts = {}) {
  const { method = "GET", query, body, auth = true } = opts;

  const url = new URL(path, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { Accept: "application/json" };
  if (auth) {
    if (!TOKEN) {
      throw new Error(
        "SP_REST_TOKEN ist nicht gesetzt. Siehe README.md, Abschnitt \"Sandbox mit diesem Kit " +
          "starten\" — das Secret muss beim Sandbox-Start per `sbx secret set-custom` gesetzt sein.",
      );
    }
    headers.Authorization = `Bearer ${TOKEN}`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      `Netzwerkfehler beim Zugriff auf ${url}: ${err.message}. Läuft Super Productivity auf dem ` +
        "Host mit aktivierter Local REST API (Settings → Misc → Enable local REST API)? Ist die " +
        "Netzwerkfreigabe im Kit (host.docker.internal:3876) aktiv?",
    );
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`Antwort von ${url} war kein valides JSON (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }

  if (!json || typeof json.ok !== "boolean") {
    throw new Error(`Unerwartetes Antwortformat von ${url} (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }
  if (!json.ok) {
    const code = json.error?.code ?? "UNKNOWN";
    const message = json.error?.message ?? "(keine Fehlermeldung)";
    throw new Error(`${code} (HTTP ${res.status}): ${message}`);
  }
  return json.data;
}

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

async function toolResult(fn) {
  try {
    return textResult(await fn());
  } catch (err) {
    return {
      content: [{ type: "text", text: `Fehler: ${err.message}` }],
      isError: true,
    };
  }
}

const server = new McpServer({
  name: "super-productivity-rest-mcp",
  version: "0.1.0",
});

// --- Health / Status -------------------------------------------------------

server.registerTool(
  "sp_health",
  {
    title: "Super Productivity: Health-Check",
    description:
      "Prüft, ob die Super Productivity Local REST API auf dem Host erreichbar ist (unauthentifiziert).",
    inputSchema: {},
  },
  () => toolResult(() => callApi("/health", { auth: false })),
);

server.registerTool(
  "sp_status",
  {
    title: "Super Productivity: Status",
    description: "Liefert den aktuellen Task und die Gesamtanzahl an Tasks.",
    inputSchema: {},
  },
  () => toolResult(() => callApi("/status")),
);

// --- Tasks ------------------------------------------------------------------

server.registerTool(
  "sp_tasks_list",
  {
    title: "Tasks auflisten",
    description: "Listet Tasks, optional gefiltert nach Titel, Projekt, Tag, Status und Quelle.",
    inputSchema: {
      query: z.string().optional().describe("Titel enthält (case-insensitive)"),
      projectId: z.string().optional(),
      tagId: z.string().optional(),
      includeDone: z.boolean().optional().describe("Default false"),
      source: z.enum(["active", "archived", "all"]).optional(),
    },
  },
  (args) => toolResult(() => callApi("/tasks", { query: args })),
);

server.registerTool(
  "sp_task_get",
  {
    title: "Einzelnen Task abrufen",
    description: "Liefert einen Task anhand seiner ID.",
    inputSchema: { id: z.string() },
  },
  ({ id }) => toolResult(() => callApi(`/tasks/${encodeURIComponent(id)}`)),
);

server.registerTool(
  "sp_task_create",
  {
    title: "Task erstellen",
    description:
      "Erstellt einen neuen Task. Ein Subtask (parentId gesetzt) erbt das Projekt des Parents und " +
      "kann keine eigenen Tags haben.",
    inputSchema: {
      title: z.string().min(1),
      parentId: z.string().optional(),
      notes: z.string().optional(),
      isDone: z.boolean().optional(),
      timeEstimate: z.number().optional().describe("Millisekunden"),
      timeSpent: z.number().optional().describe("Millisekunden"),
      projectId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      dueDay: z.string().optional().describe("YYYY-MM-DD"),
      dueWithTime: z.number().optional().describe("Unix-Timestamp ms"),
      plannedAt: z.number().optional().describe("Unix-Timestamp ms"),
      deadlineDay: z.string().optional().describe("YYYY-MM-DD, schließt deadlineWithTime aus"),
      deadlineWithTime: z.number().optional().describe("Unix-Timestamp ms, schließt deadlineDay aus"),
      deadlineRemindAt: z.number().optional(),
    },
  },
  (args) => toolResult(() => callApi("/tasks", { method: "POST", body: args })),
);

server.registerTool(
  "sp_task_update",
  {
    title: "Task teilweise aktualisieren",
    description:
      "Aktualisiert einzelne Felder eines Tasks. parentId/subTaskIds können NICHT geändert " +
      "werden (führt zu 400). deadlineDay/deadlineWithTime/deadlineRemindAt schließen sich " +
      "gegenseitig aus.",
    inputSchema: {
      id: z.string(),
      title: z.string().min(1).optional(),
      notes: z.string().optional(),
      isDone: z.boolean().optional(),
      timeEstimate: z.number().optional(),
      timeSpent: z.number().optional(),
      projectId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      dueDay: z.string().optional(),
      dueWithTime: z.number().optional(),
      plannedAt: z.number().optional(),
      deadlineDay: z.string().optional(),
      deadlineWithTime: z.number().optional(),
      deadlineRemindAt: z.number().optional(),
    },
  },
  ({ id, ...patch }) => toolResult(() => callApi(`/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body: patch })),
);

server.registerTool(
  "sp_task_delete",
  {
    title: "Task löschen",
    description: "Löscht einen Task unwiderruflich.",
    inputSchema: { id: z.string() },
  },
  ({ id }) => toolResult(() => callApi(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })),
);

server.registerTool(
  "sp_task_start",
  {
    title: "Task starten",
    description: "Setzt den angegebenen Task als aktuellen Task.",
    inputSchema: { id: z.string() },
  },
  ({ id }) => toolResult(() => callApi(`/tasks/${encodeURIComponent(id)}/start`, { method: "POST" })),
);

server.registerTool(
  "sp_task_archive",
  {
    title: "Task archivieren",
    description: "Verschiebt einen Task ins Archiv.",
    inputSchema: { id: z.string() },
  },
  ({ id }) => toolResult(() => callApi(`/tasks/${encodeURIComponent(id)}/archive`, { method: "POST" })),
);

server.registerTool(
  "sp_task_restore",
  {
    title: "Task aus Archiv wiederherstellen",
    description: "Stellt einen archivierten Task wieder her.",
    inputSchema: { id: z.string() },
  },
  ({ id }) => toolResult(() => callApi(`/tasks/${encodeURIComponent(id)}/restore`, { method: "POST" })),
);

// --- Task-Control -------------------------------------------------------------

server.registerTool(
  "sp_task_control_get_current",
  {
    title: "Aktuellen Task abrufen",
    description: "Liefert den aktuell laufenden Task (task-control).",
    inputSchema: {},
  },
  () => toolResult(() => callApi("/task-control/current")),
);

server.registerTool(
  "sp_task_control_set_current",
  {
    title: "Aktuellen Task setzen",
    description: "Setzt den aktuellen Task; taskId weglassen/null löscht den aktuellen Task.",
    inputSchema: { taskId: z.string().nullable().optional() },
  },
  ({ taskId }) =>
    toolResult(() => callApi("/task-control/current", { method: "POST", body: { taskId: taskId ?? null } })),
);

server.registerTool(
  "sp_task_control_stop",
  {
    title: "Aktuellen Task stoppen",
    description: "Stoppt den aktuell laufenden Task (ohne einen anderen zu starten).",
    inputSchema: {},
  },
  () => toolResult(() => callApi("/task-control/stop", { method: "POST" })),
);

// --- Focus Mode (read-only) ----------------------------------------------------

server.registerTool(
  "sp_focus_get",
  {
    title: "Focus-Mode-Status abrufen",
    description: "Liefert Modus (Flowtime/Pomodoro/Countdown), Zyklus und laufenden Timer, falls aktiv.",
    inputSchema: {},
  },
  () => toolResult(() => callApi("/focus")),
);

// --- Projects / Tags --------------------------------------------------------

server.registerTool(
  "sp_projects_list",
  {
    title: "Projekte auflisten",
    description: "Listet Projekte, optional gefiltert nach Titel (case-insensitive).",
    inputSchema: { query: z.string().optional() },
  },
  (args) => toolResult(() => callApi("/projects", { query: args })),
);

server.registerTool(
  "sp_tags_list",
  {
    title: "Tags auflisten",
    description: "Listet Tags, optional gefiltert nach Titel (case-insensitive).",
    inputSchema: { query: z.string().optional() },
  },
  (args) => toolResult(() => callApi("/tags", { query: args })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
