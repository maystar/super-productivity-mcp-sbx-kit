// Ad-hoc-Testclient, um den MCP-Server lokal zu verifizieren, ohne ihn erst in ~/.claude.json
// registrieren zu müssen. Kein Teil des Kits — nur für Schritt 7 der TODO.md gedacht.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["index.js"],
  cwd: import.meta.dirname,
  // Volle Umgebung durchreichen (nicht nur PATH/SP_REST_TOKEN) — die sbx-Sandbox routet
  // host.docker.internal-Traffic über einen HTTP-Proxy (HTTP(S)_PROXY/gateway.docker.internal),
  // der auch die Platzhalter-Substitution und ggf. Host-Header-Rewriting übernimmt. Ohne die
  // Proxy-Env-Vars geht der Request direkt raus und die API lehnt den rohen
  // "host.docker.internal"-Host-Header ab (403 "Invalid Host header").
  env: process.env,
});

const client = new Client({ name: "test-client", version: "0.0.1" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`Tools registriert: ${tools.length}`);
for (const t of tools) console.log(` - ${t.name}`);

console.log("\n--- sp_health ---");
console.log(JSON.stringify(await client.callTool({ name: "sp_health", arguments: {} }), null, 2));

console.log("\n--- sp_status ---");
console.log(JSON.stringify(await client.callTool({ name: "sp_status", arguments: {} }), null, 2));

console.log("\n--- sp_tasks_list (limit via query, includeDone false) ---");
const list = await client.callTool({ name: "sp_tasks_list", arguments: { query: "" } });
console.log(JSON.stringify(list, null, 2).slice(0, 1500));

console.log("\n--- sp_projects_list ---");
console.log(JSON.stringify(await client.callTool({ name: "sp_projects_list", arguments: {} }), null, 2).slice(0, 1000));

await client.close();
process.exit(0);
