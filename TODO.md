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
API-Endpunkte/Felder/Fehlercodes für Schritt 7 (**bereits recherchiert, lokal abgelegt** — ein
Agent in der Sandbox hat keinen Zugriff auf dieses Gespräch und müsste die GitHub-Wiki-Seite sonst
selbst nachladen, was zusätzliche Netzwerkfreigabe für `github.com` bräuchte):
[docs/rest-api-reference.md](./docs/rest-api-reference.md).

## Plan (mit dem Nutzer abgestimmt)

- [x] **1. Aufräumen** — altes Kit (dateibasierter IPC-Ansatz) entfernt, TODO.md/README.md neu aufgesetzt
- [x] **2. TODO.md** — diese Datei
- [x] **3. Kit + Netzwerkfreigabe** — **korrigiert nach echtem Testlauf:** `permissions.network.allow`
      im Kit existiert in der installierten sbx-Version nicht (`sbx run` schlug fehl mit
      `field permissions not found in type spec.SpecFile`). [spec.yaml](./kits/super-productivity-rest-mcp/spec.yaml)
      ist jetzt auf reine Metadaten reduziert; die Freigabe passiert stattdessen über das separate
      Host-Kommando `sbx policy allow network ...` (README.md, Schritt 2 — eingebaut in denselben
      Copy-Paste-Block wie Secret + `sbx run`)
- [x] **4. README.md** — Sandbox-Start, Zweck, Host-Voraussetzungen dokumentiert
- [ ] **5. Sandbox starten** — **Aktion beim Nutzer**, mit diesem Verzeichnis als Kit-Quelle **und**
      Workdir, fester Name `sp-rest-mcp` (Befehle siehe README.md, Abschnitt "Sandbox mit diesem
      Kit starten" — inkl. Token/Secret-Übergabe, die dort jetzt konkret definiert ist statt nur
      "geplant")
- [ ] **6. Erreichbarkeit testen** — **Aktion für einen Agenten innerhalb der neuen Sandbox**:
      - `curl http://host.docker.internal:3876/health` → sollte `{"ok":true,"data":{"server":"up","rendererReady":true}}` liefern (unauthentifiziert, einziger offener Endpunkt)
      - Falls `403`/Policy-Block: prüfen, welcher Domain-Name in der Fehlermeldung steht
        (`host.docker.internal:3876` oder `localhost:3876`) und den `sbx policy allow network`-Aufruf
        in README.md entsprechend anpassen/kürzen
      - Falls Connection-Error (nicht Policy-Block): prüfen, ob Super Productivity läuft und die
        REST API in den Settings aktiviert ist (siehe README.md, Abschnitt "Host-Voraussetzungen")
- [ ] **7. MCP-Server entwickeln und ins Kit integrieren** — **Aktion für einen Agenten innerhalb
      der Sandbox** (oder hier, sobald Schritt 6 grün ist), u. a.:
      - **Zuerst das reale Kit-Schema verifizieren**, bevor `setup:`/`commands:`/`files:` in
        `spec.yaml` ergänzt werden — dieselbe Doku-Quelle, die `permissions.network.allow`
        fälschlich behauptet hat, ist auch die Quelle für die bisherige Annahme `setup: install:`
        statt `commands: install:`. Z. B. `sbx kit --help` bzw. `sbx run --help` in der Sandbox
        ausführen und/oder ein minimales Test-Kit mit `setup:` probeweise laden, bevor die
        eigentliche Logik reinkommt.
      - Token-Übergabe ist bereits in README.md Schritt 2 definiert (`sbx secret set-custom`,
        Platzhalter-Mechanismus, `$SP_REST_TOKEN`) — **Host-Aktion**, idealerweise schon vor/bei
        Schritt 5 erledigt, damit die Sandbox dafür nicht neu erstellt werden muss
      - MCP-Server schreiben, der die REST-Endpunkte (Tasks CRUD, task-control, focus, projects,
        tags) als Claude-Code-Tools kapselt — Endpunkt-/Feld-Details siehe
        [docs/rest-api-reference.md](./docs/rest-api-reference.md) (vor der Implementierung kurz
        gegen die Live-Wiki-Seite gegenprüfen, siehe Hinweis am Anfang der Datei)
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
- **Widerlegt (2026-09-14):** `permissions.network.allow` im Kit-Spec — existiert in der
  installierten sbx-Version nicht (`field permissions not found in type spec.SpecFile`). Ersetzt
  durch `sbx policy allow network` als Host-Kommando (README.md).
- Unklar, ob die Netzwerk-Policy intern auf `host.docker.internal:<port>` oder `localhost:<port>`
  matcht — wird in Schritt 6 verifiziert.
- Unklar, ob `sbx secret set-custom --host host.docker.internal ...` (README.md Schritt 2) so
  funktioniert oder `--host localhost` nötig ist, und ob das Secret vor `sbx run` gesetzt sein muss
  — wird in Schritt 6/7 verifiziert.
- **Wichtig für Schritt 7:** Die Docker-Sandboxes-Kit-Referenz von docs.docker.com hat sich bereits
  einmal als nicht deckungsgleich mit der real installierten sbx-Version erwiesen (s.o.). Das
  vermutete `setup: install:`/`files:`-Schema für Schritt 7 ist daher **ebenfalls unverifiziert**
  und sollte vor der Implementierung gegen die echte Sandbox getestet werden (kleines Test-Kit
  zuerst), statt der Doku blind zu vertrauen. Kits sind laut Docker offiziell "experimentell".
