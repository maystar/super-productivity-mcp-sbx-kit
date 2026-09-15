# TODO: Super Productivity via Local REST API in sbx-Sandbox nutzbar machen

## Ziel

Claude Code, laufend in einer `sbx`-Sandbox, soll Aufgaben in der auf dem Host laufenden Super-
Productivity-Desktop-App lesen/anlegen/ändern können — über deren
[Local REST API](https://github.com/super-productivity/super-productivity/wiki/3.01-API#3-local-rest-api)
(`http://127.0.0.1:3876` auf dem Host, Bearer-Token-Auth), erreicht aus der Sandbox über
`host.docker.internal:3876`.

**Ersetzt** einen früheren, komplexeren Ansatz (Plugin + eigener MCP-Subprozess + dateibasiertes
IPC-Verzeichnis, gemountet über `Path.home()`-Trickserei). Der ist verworfen; Details/Historie:
Git-Commit `e275fba` sowie [super-productivity-sbx-kit-in-sandbox.md](./super-productivity-sbx-kit-in-sandbox.md)
(nur noch historische Referenz, **nicht mehr aktueller Plan**).

Details zur aktuellen Architektur und was eine Sandbox mit dem Kit schon kann: [README.md](./README.md).

## Plan (mit dem Nutzer abgestimmt)

- [x] **1. Aufräumen** — altes Kit (dateibasierter IPC-Ansatz) entfernt, TODO.md/README.md neu aufgesetzt
- [x] **2. TODO.md** — diese Datei
- [x] **3. Kit mit Netzwerkfreigaben definieren** — [kits/super-productivity-rest-mcp/spec.yaml](./kits/super-productivity-rest-mcp/spec.yaml),
      nutzt `permissions.network.allow` (deklarativ, kein manuelles `sbx policy allow` nötig — siehe
      Warnhinweis in der Datei zur noch unklaren Frage `host.docker.internal:3876` vs. `localhost:3876`)
- [x] **4. README.md** — Sandbox-Start, Zweck, Host-Voraussetzungen dokumentiert
- [ ] **5. Sandbox starten** — **Aktion beim Nutzer**, mit diesem Verzeichnis als Kit-Quelle **und**
      Workdir (Befehl siehe README.md, Abschnitt "Sandbox mit diesem Kit starten")
- [ ] **6. Erreichbarkeit testen** — **Aktion für einen Agenten innerhalb der neuen Sandbox**:
      - `curl http://host.docker.internal:3876/health` → sollte `{"ok":true,"data":{"server":"up","rendererReady":true}}` liefern (unauthentifiziert, einziger offener Endpunkt)
      - Falls `403`/Policy-Block: prüfen, welcher Domain-Name in der Fehlermeldung steht
        (`host.docker.internal:3876` oder `localhost:3876`) und `spec.yaml` entsprechend anpassen/kürzen
      - Falls Connection-Error (nicht Policy-Block): prüfen, ob Super Productivity läuft und die
        REST API in den Settings aktiviert ist (siehe README.md, Abschnitt "Host-Voraussetzungen")
- [ ] **7. MCP-Server entwickeln und ins Kit integrieren** — **Aktion für einen Agenten innerhalb
      der Sandbox** (oder hier, sobald Schritt 6 grün ist), u. a.:
      - Access Token aus Super Productivity (Settings → Misc) beschaffen
      - Token in die Sandbox bringen — geplant: `sbx secret set-custom` (Platzhalter-Mechanismus,
        Token landet nie im Klartext im Kit/Repo) — **Host-Aktion**
      - MCP-Server schreiben, der die REST-Endpunkte (Tasks CRUD, task-control, focus, projects,
        tags) als Claude-Code-Tools kapselt
      - Server user-scoped in `~/.claude.json` der Sandbox registrieren (analog zum vorherigen
        Ansatz, aber ohne Host-HOME-Ableitung — hier reicht eine feste Basis-URL)
      - Mit `/mcp` und echten Testaufrufen verifizieren

---

## Bereits erledigte Host-Voraussetzungen (aus vorherigem Anlauf übernommen, weiterhin gültig)
- [x] Ubuntu-Version geprüft (24.04+)
- [x] KVM verfügbar
- [x] Docker Hub Account vorhanden
- [x] Anthropic-API-Key/Abo vorhanden
- [x] Super Productivity ≥ 14.0.0 (Electron-Desktop) installiert
- [x] `sbx` installiert, `sbx login` durchgeführt

## Noch offen, bevor Schritt 7 abgeschlossen werden kann
- [ ] In Super Productivity: **Settings → Misc → Enable local REST API** aktivieren, Access Token notieren

---

## Offene Annahmen / bei Abweichung anpassen
- Unklar, ob die Netzwerk-Policy intern auf `host.docker.internal:<port>` oder `localhost:<port>`
  matcht (siehe Warnhinweis in `spec.yaml`) — wird in Schritt 6 verifiziert.
- Unklar, ob `sbx secret set-custom --host <host> --env <NAME> --value <token>` mit `--host localhost`
  oder `--host host.docker.internal` funktioniert — wird in Schritt 7 verifiziert.
- Kits sind laut Docker-Doku "experimentell" — Schema (`permissions.network.allow` etc.) kann sich
  ändern; bei Fehlern beim Sandbox-Erstellen in Schritt 5 gegen die dann aktuelle Kit-Referenz prüfen.
