# Super Productivity ↔ Claude Code via Local REST API (sbx-Sandbox)

Ziel: Claude Code, laufend in einer `sbx`-Sandbox, greift auf die laufende Super-Productivity-
Desktop-App auf dem Host zu — über deren offizielle
[Local REST API](https://github.com/super-productivity/super-productivity/wiki/3.01-API#3-local-rest-api),
nicht über ein Plugin oder dateibasiertes IPC. Das ersetzt einen früheren, komplexeren Versuch mit
Plugin + eigenem MCP-Subprozess + gemountetem IPC-Verzeichnis (siehe Git-Historie dieses Repos,
Commit `e275fba`, sowie [super-productivity-sbx-kit-in-sandbox.md](./super-productivity-sbx-kit-in-sandbox.md) —
diese Datei beschreibt den **verworfenen** Ansatz und dient nur noch als historische Referenz).

Aktueller Stand: Sandbox (`sp-rest-mcp`) läuft, **Netzwerk-Konnektivität, Token-Substitution und
der MCP-Server sind verifiziert** (`/health` → `200`, `GET /status` mit `Authorization: Bearer
$SP_REST_TOKEN` → echtes `200` mit Task-Daten, MCP-Server registriert und per Testclient gegen die
echte API verifiziert). Details und offene Punkte siehe [TODO.md](./TODO.md), Schritt 7.

---

## Wofür diese Sandbox aktuell genutzt werden kann

Mit dem hier definierten Kit (`kits/super-productivity-rest-mcp`) kann eine Sandbox:

- per HTTP auf `http://host.docker.internal:3876` zugreifen (= die Super-Productivity Local REST
  API auf dem Host, die dort auf `127.0.0.1:3876` lauscht)
- damit z. B. `curl http://host.docker.internal:3876/health` erfolgreich ausführen (unauthentifiziert,
  einziger offener Endpunkt) — **verifiziert am 2026-09-14, zuerst in Sandbox `superprod`, erneut
  in Sandbox `sp-rest-mcp`: `200 OK`**
- damit auch authentifizierte Endpunkte ansprechen, z. B. `GET /status` mit
  `Authorization: Bearer $SP_REST_TOKEN` (Secret mit `--host localhost` gesetzt) — **verifiziert
  am 2026-09-14 in Sandbox `sp-rest-mcp`: `200 OK` mit echten Task-Daten**

- per MCP-Server aus dem veröffentlichten Container-Image
  [`ghcr.io/maystar/super-productivity-rest-mcp`](https://github.com/maystar/super-productivity-rest-mcp)
  die REST-Endpunkte als 16 Claude-Code-Tools nutzen (Tasks CRUD + start/archive/restore,
  task-control, Status, Focus-Mode, Projekte, Tags) — **verifiziert am 2026-09-14** per Testclient
  gegen die echte, laufende Super-Productivity-Instanz (u. a. reale Task-Liste mit 39 Einträgen
  abgerufen). Der Server ist zusätzlich user-scoped in `~/.claude.json` der Sandbox registriert und
  wird beim Sandbox-Start automatisch registriert (`docker pull` + `claude mcp add ... -- docker
  run ...` in `setup.startup` in spec.yaml) — dieser automatisierte Teil ist noch nicht in einem
  frischen `sbx run` getestet, siehe TODO.md Schritt 7/9.

**Erledigt (TODO.md Schritt 8+9):** Der MCP-Server-Code lebt jetzt als eigenständiges Projekt unter
[../super-productivity-rest-mcp/](../super-productivity-rest-mcp/), auf GitHub veröffentlicht und
per GitHub Actions als Image nach GHCR gepusht. Dieses Kit bezieht den Server seither per
Container-Image (`ghcr.io/maystar/super-productivity-rest-mcp`) statt ihn aus lokalem Quellcode zu
bauen — `kits/super-productivity-rest-mcp/mcp-server/` (der alte, jetzt überflüssige Quellcode)
wurde entfernt.

---

## Host-Voraussetzungen

Bereits erledigt (siehe abgehakte Punkte in [TODO.md](./TODO.md)):
- `sbx` installiert, `sbx login` durchgeführt, KVM verfügbar
- Super Productivity ≥ 14.0.0 (Electron-Desktop-Version) installiert

Ebenfalls erledigt: In Super Productivity **Settings → Misc → Enable local REST API** aktiviert
und den dort angezeigten Access Token notiert (wird unten für `sbx secret set-custom` gebraucht).

---

## Sandbox mit diesem Kit starten

Dieses Verzeichnis dient hier **sowohl als Kit-Quelle als auch als Sandbox-Workdir** (anders als
beim verworfenen Vorgänger-Ansatz, wo beides getrennt war — für den aktuellen Test/Entwicklungsstand
ist das bewusst so gewählt, damit der Kit direkt aus der laufenden Sandbox heraus weiterentwickelt
werden kann). Name und Token werden beim Ausführen interaktiv abgefragt (Token-Eingabe ohne
Echo) und danach in beiden Aufrufen (`secret set-custom` und `run`) konsistent verwendet — so
bleibt sichergestellt, dass das Secret an genau die Sandbox gebunden ist, die tatsächlich gestartet
wird.

### 1. Access Token in Super Productivity holen

Settings → Misc → **Enable local REST API** aktivieren, falls noch nicht geschehen, dann den dort
angezeigten **Access Token** kopieren.

### 2. Secret setzen + Sandbox starten

```bash
read -rp "Sandbox-Name [sp-rest-mcp]: " SBX_NAME
SBX_NAME="${SBX_NAME:-sp-rest-mcp}"
read -rsp "Super Productivity Access Token: " SP_TOKEN
echo

sbx secret set-custom --sandbox "$SBX_NAME" --host localhost --env SP_REST_TOKEN --value "$SP_TOKEN"

cd /home/fabian/claude-workspace/super-productivity
sbx run claude --name "$SBX_NAME" \
  --kit ./kits/super-productivity-rest-mcp \
  .
```

Wie das Secret wirkt (Platzhalter-Mechanismus, siehe [docs.docker.com – Custom Secrets](https://docs.docker.com/reference/cli/sbx/secret/set-custom/)):
Die Sandbox sieht in `$SP_REST_TOKEN` nur einen **Platzhalter**, nicht den echten Token. Erst wenn
ein Request aus der Sandbox tatsächlich an den Host `host.docker.internal` geht, ersetzt der
sbx-Proxy den Platzhalter im Request (z. B. im `Authorization`-Header) durch den echten Wert. Der
Token liegt damit nie im Klartext im Kit, im Repo oder im Sandbox-Dateisystem — und dank `read -rs`
auch nicht in der Shell-History.

Kein zweiter Mount-Pfad nötig (anders als beim alten Ansatz) — die REST API braucht kein
gemountetes Host-Verzeichnis, nur die Netzwerkfreigabe aus dem Kit.

Nach dem Start: Das Kit zieht das Container-Image und registriert den MCP-Server automatisch
(`setup.startup`, siehe spec.yaml) — `claude mcp list` sollte `super-productivity: ... - ✔ Connected` zeigen, `/mcp`
in einer **neu gestarteten** Claude-Code-Session entsprechend die 16 Tools (eine bereits laufende
Session sieht neu registrierte Server nicht automatisch). `echo $SP_REST_TOKEN` in der Sandbox
zeigt weiterhin nur den Platzhalter aus Schritt 2 (nicht leer, aber auch nicht der echte Token —
das ist beabsichtigt, siehe oben).

---

## Weiteres Vorgehen

Siehe [TODO.md](./TODO.md) für den vollständigen Plan und Verifikationsstand. Offen:
- Schritt 7/9 (MCP-Server): den `setup.startup`-Automatismus (jetzt `docker pull` + `docker run`)
  einmal in einem frischen `sbx run` bestätigen, und die Tools in einer neu gestarteten
  Claude-Code-Session (nicht nur per Testclient) selbst aufrufen.

Für Schritt 7 liegt die API-Referenz (Endpunkte, Felder, Fehlercodes) bereits lokal vor:
[docs/rest-api-reference.md](./docs/rest-api-reference.md).
