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
- [x] **3. Kit mit Netzwerkfreigaben definieren** — [kits/super-productivity-rest-mcp/spec.yaml](./kits/super-productivity-rest-mcp/spec.yaml),
      nutzt `permissions.network.allow` (deklarativ, kein manuelles `sbx policy allow` nötig). Ein
      erster Testlauf schlug fehl (`field permissions not found in type spec.SpecFile`) — Ursache
      war `schemaVersion: "1"`; das Feld existiert erst ab `schemaVersion: "2"`, mit der der Nutzer
      dieses Feld in anderen Kits bereits erfolgreich verwendet. Auf `"2"` korrigiert. Weiterhin
      offen: `host.docker.internal:3876` vs. `localhost:3876` (siehe Warnhinweis in der Datei)
- [x] **4. README.md** — Sandbox-Start, Zweck, Host-Voraussetzungen dokumentiert
- [x] **5. Sandbox starten** — **Aktion beim Nutzer**, mit diesem Verzeichnis als Kit-Quelle **und**
      Workdir (Befehle siehe README.md, Abschnitt "Sandbox mit diesem Kit starten" — inkl.
      Token/Secret-Übergabe, die dort jetzt konkret definiert ist statt nur "geplant"). Tatsächlich
      gestarteter Name: `superprod` (abweichend vom Vorschlag `sp-rest-mcp` im README — reiner
      Default, kein Muss)
- [x] **6. Erreichbarkeit testen** — durchgeführt in Sandbox `superprod` (2026-09-14):
      - `curl http://host.docker.internal:3876/health` → `200 OK`,
        `{"ok":true,"data":{"server":"up","rendererReady":true}}` ✅ — kein Policy-Block, Netzwerk-
        Teil der Kit-Freigabe funktioniert wie geplant, `host.docker.internal:3876` ist korrekt.
      - Erster Versuch (Secret ursprünglich mit `--host host.docker.internal` gesetzt, beim
        Sandbox-Start): `curl -H "Authorization: Bearer $SP_REST_TOKEN" .../status` → **echte**
        `401 UNAUTHORIZED` von der Super-Productivity-API (kein Proxy-Block!) — Platzhalter kam
        unersetzt an. Vermuteter Grund: `--host host.docker.internal` war falsch.
      - Nutzer hat das **gleiche** Secret (`--env SP_REST_TOKEN`) erneut gesetzt, diesmal mit
        `--host localhost` (= der jetzt in README.md Schritt 2 fest hinterlegte Befehl), **ohne**
        die laufende Sandbox neu zu starten. Der neue Platzhalter tauchte danach **nicht** als
        aktualisierter Wert von `$SP_REST_TOKEN` in der laufenden Sandbox auf (auch nicht nach
        frischer Login-Shell) — Custom Secrets werden also offenbar nur **beim Sandbox-Start**
        in die Prozessumgebung injiziert, ein `set-custom` auf eine bereits laufende Sandbox wirkt
        sich dort nicht sofort auf `process.env` aus.
      - Test **direkt mit dem neuen Platzhalterwert** (vom Nutzer aus der Host-Kommandoausgabe
        mitgeteilt, nicht aus einer Sandbox-Env-Var) gegen `GET /status` → **`200 OK`**, echte
        Task-Daten zurück ✅ — bestätigt: Platzhalter-Ersetzung durch den sbx-Proxy funktioniert mit
        `--host localhost`, rein netzwerkseitig (Zielhost + registrierter Wert), unabhängig davon,
        ob der Wert gerade als Env-Var in der Sandbox sichtbar ist.
      - **Schlussfolgerung:** `--host localhost` ist korrekt (nicht `host.docker.internal`).
        Damit ein MCP-Server (Schritt 7) den Token regulär über `process.env.SP_REST_TOKEN` lesen
        kann, muss die Sandbox mit dem `--host localhost`-Secret **neu gestartet** werden — als
        Nächstes geplant.
- [x] **6b. Schritt 6 wiederholt, in frisch gestarteter Sandbox `sp-rest-mcp`** (2026-09-14,
      Default-Name aus README, **nicht** `superprod` — die vorherige Sandbox war zwischenzeitlich
      beendet worden):
      - `curl http://host.docker.internal:3876/health` → `200 OK` ✅ (weiterhin unverändert)
      - `curl -H "Authorization: Bearer $SP_REST_TOKEN" .../status` → **`200 OK`**,
        `{"ok":true,"data":{"currentTask":null,"currentTaskId":null,"taskCount":39}}` ✅
      - **Damit bestätigt:** Das Secret war diesmal **vor** `sbx run` mit `--host localhost`
        gesetzt (README Schritt 2) — Token-Substitution funktioniert beim Sandbox-Start
        zuverlässig. Die schmalere, noch offene Frage aus Schritt 6 (ob ein `set-custom` auf eine
        **bereits laufende** Sandbox nach deren Neustart ankommt) ist damit nicht separat
        getestet, aber praktisch nicht mehr relevant: Sandboxen werden ohnehin mit gesetztem
        Secret frisch gestartet.
      - `echo $SP_REST_TOKEN` in dieser Sandbox zeigt weiterhin nur den Platzhalter
        (`sbx-cs-jcMRloAQd1lWDwFK`) — erwartet, siehe README.
- [x] **7. MCP-Server entwickeln und ins Kit integrieren** — durchgeführt in Sandbox
      `sp-rest-mcp` (2026-09-14):
      - **Schema-Check vorab (wie gefordert):** `docs.docker.com/ai/sandboxes/customize/kit-reference/`
        war von der Sandbox aus tatsächlich erreichbar (kein zusätzlicher Netzwerk-Freigabe-Bedarf,
        anders als in der Datei ursprünglich angenommen — generelles Web scheint hier per Default
        offen zu sein, nur `host.docker.internal` brauchte die explizite Kit-Freigabe). Ergebnis:
        unter `schemaVersion: "2"` heißt der Top-Level-Schlüssel `setup:` (mit `install`/`startup`/
        `files` darunter), **nicht** `commands:` — das alte, nie getestete Kit (`e275fba`) hätte mit
        `commands:` also ebenfalls falsch gelegen. Details/Zitat der Ausführungsreihenfolge als
        Kommentar direkt in [kits/super-productivity-rest-mcp/spec.yaml](./kits/super-productivity-rest-mcp/spec.yaml).
      - **MCP-Server implementiert:** [kits/super-productivity-rest-mcp/mcp-server/](./kits/super-productivity-rest-mcp/mcp-server/)
        (Node 22, `@modelcontextprotocol/sdk`, native `fetch`). 16 Tools, ein Tool pro
        Endpunkt/Aktion aus [docs/rest-api-reference.md](./docs/rest-api-reference.md) (Tasks CRUD
        + start/archive/restore, task-control get/set/stop, `/status`, `/focus`, Projects, Tags,
        `/health`). Token kommt aus `process.env.SP_REST_TOKEN`.
      - **Stolperstein gefunden + gefixt:** Ein erster Testclient reichte dem Server-Subprozess nur
        `PATH`+`SP_REST_TOKEN` durch (nicht die volle Umgebung) → echte `403 FORBIDDEN "Invalid
        Host header"` von der Super-Productivity-API. Ursache: die Sandbox routet
        `host.docker.internal`-Traffic über einen HTTP-Proxy
        (`HTTP(S)_PROXY=http://gateway.docker.internal:3128`), der vermutlich auch den Host-Header
        normalisiert; ohne die Proxy-Env-Vars ging der Request direkt raus und wurde von der API
        abgelehnt. Fix: volle `process.env` an den Server-Subprozess durchreichen (relevant auch
        für die Kit-Registrierung — `claude mcp add` startet den Server standardmäßig mit voller
        Umgebung, ist also nicht betroffen, aber gut zu wissen für eigene Testclients).
      - **End-to-End verifiziert** (echter Test-MCP-Client, `kits/super-productivity-rest-mcp/mcp-server/test-client.mjs`,
        nicht Teil des Kits selbst): `sp_health`, `sp_status`, `sp_tasks_list`, `sp_projects_list`
        gegen die echte, laufende Super-Productivity-Instanz aufgerufen — alle liefern reale Daten
        (u. a. 39 existierende Tasks) statt Fehlern.
      - **User-scoped in `~/.claude.json` registriert:** `claude mcp add super-productivity --scope
        user -- node <Pfad>/index.js` manuell in der laufenden Sandbox ausgeführt, `claude mcp list`
        zeigt `super-productivity: ... - ✔ Connected`.
      - **Automatisierung ins Kit integriert:** `setup.startup`-Block in spec.yaml (läuft bei jedem
        Sandbox-Start, idempotent: `npm install` nur falls `node_modules` fehlt, `mcp remove` vor
        `mcp add`) — Skript isoliert extrahiert und probeweise in der laufenden Sandbox ausgeführt,
        Ergebnis identisch zur manuellen Registrierung. **Noch nicht** als Teil eines echten
        frischen `sbx run` mit diesem Kit getestet (siehe Warnhinweis in spec.yaml) — vor dem
        nächsten `sbx run` idealerweise gegenprüfen.
      - **Noch offen:** `/mcp` in dieser laufenden Claude-Code-Session zeigt den Server noch
        nicht, da die Session bereits vor der Registrierung gestartet war — Tools werden erst in
        einer neu gestarteten Session sichtbar. Bei nächster Gelegenheit (neue Session oder
        Sandbox-Neustart) mit `/mcp` und echten Tool-Aufrufen durch den Agenten selbst (nicht nur
        den Testclient) verifizieren.
- [x] **8. MCP-Server in eigenes Projekt auslagern** — Code liegt jetzt als eigenständiges,
      lokales Git-Repo unter `../super-productivity-rest-mcp/` (Geschwisterverzeichnis von
      `super-productivity/`, noch ohne Remote — Veröffentlichung auf GitHub ist Nutzer-Aktion):
      - **Struktur verbessert:** `index.js` (nur noch Entry-Point: Env lesen, stdio verbinden),
        `src/rest-client.js` (reiner HTTP-Client, kennt MCP nicht), `src/tool-result.js` (Result-/
        Error-Wrapping), `src/tools/*.js` (ein Modul je Ressource: health, tasks, task-control,
        focus, projects, tags), `src/server.js` (verdrahtet alles). User-sichtbare Strings auf
        Englisch übersetzt (eigenständiges Projekt, nicht mehr Teil dieses deutschsprachigen
        Workspace).
      - **Portabilität:** keine Kit-/Sandbox-/sbx-spezifische Annahme mehr im Code;
        `SP_REST_BASE_URL`/`SP_REST_TOKEN` bleiben Env-Var-Konfiguration mit sinnvollem Default.
      - **Dockerfile** (Multi-Stage, `node:22-alpine`, non-root) + zwei GitHub Actions
        (`ci.yml`: Test + Docker-Build auf jeden Push/PR; `docker-publish.yml`: Build+Push nach
        GHCR auf `main` und `v*.*.*`-Tags).
      - **Getestet, so weit ohne echte Super-Productivity-Instanz in dieser Sandbox möglich:**
        `npm test` (neuer netzwerkfreier Smoke-Test: In-Memory-MCP-Client, RFC-5737-unroutbare
        Adresse, prüft alle 16 Tools + korrektes `isError`-Verhalten bei unerreichbarem Backend) ✅,
        `docker build` ✅, echter MCP-Handshake (`initialize` + `tools/list` per stdio) gegen den
        gebauten Container ✅ (liefert alle 16 Tools). Der alte Testclient (jetzt
        `test/manual-client.mjs`) gegen eine **echte** laufende Instanz wurde hier **nicht** erneut
        ausgeführt — dieser Sandbox fehlt der Zugriff auf den Host; war aber bereits in Schritt 7
        gegen die echte Instanz verifiziert und ist inhaltlich unverändert.
      - README.md (Englisch) und CLAUDE.md liegen im neuen Repo.
      - **Noch offen (bewusst nicht Teil dieses Schritts):** Veröffentlichung auf GitHub (Nutzer-
        Aktion), danach Anpassung **dieses** Kits (`kits/super-productivity-rest-mcp/spec.yaml`)
        auf Bezug per Container-Image statt `npm install` aus dem Quellcode — geplant als nächster
        Schritt, sobald das neue Repo/Image über GitHub erreichbar ist.
      - **Nachtrag (2026-09-15, gleiche Sandbox `sp-rest-mcp`, andere Chat-Session):** Docker-Image
        gebaut und via `claude mcp add ... -- docker run -i --rm ...` registriert (Korrektur: in
        einer vorherigen Notiz hier fälschlich als "andere Sandbox `claude-workspace`" bezeichnet —
        `claude-workspace` ist nur der Verzeichnisname, `$SANDBOX_NAME`/`hostname` bestätigen: es
        ist dieselbe Sandbox `sp-rest-mcp` wie in Schritt 7). Dabei die gleiche
        `403 FORBIDDEN "Invalid Host header"`-Symptomatik wie in Schritt 7 reproduziert — aber aus
        einem **anderen** Grund als dort vermerkt: Schritt 7s Notiz ("`claude mcp add` startet den
        Server standardmäßig mit voller Umgebung, ist also nicht betroffen") stimmt nur für den
        **direkten Node-Aufruf**. Bei Docker als Transport greift sie **nicht** — `docker run`
        reicht die Host-Umgebung grundsätzlich nicht in den Container durch, auch nicht, wenn der
        Server-Prozess selbst mit voller Umgebung gestartet wurde; nötig sind explizite `-e`-Flags
        pro Variable. Reproduziert per direktem Node-`fetch()`-Test innerhalb des Containers: ohne
        `HTTP(S)_PROXY`/`NO_PROXY` (+ Kleinschreibung) und `NODE_USE_ENV_PROXY=1` im Container
        → `403`; mit denselben `-e`-Flags sowohl bei `claude mcp add` (äußere Prozessumgebung) als
        auch im `docker run`-Kommando selbst (damit sie in den Container gelangen) → `200 OK`,
        echte Task-Daten. Betrifft also **jede** Docker-basierte Registrierung dieses MCP-Servers
        in einer sbx-Sandbox, nicht nur diesen einen Fall — relevant für die geplante Umstellung
        dieses Kits auf Bezug per Container-Image (s. o.): der `setup.startup`-Block muss die
        Proxy-Variablen dann ebenfalls explizit in den `docker run`-Aufruf durchreichen, nicht nur
        `SP_REST_TOKEN`/`SP_REST_BASE_URL`.
      - **Root-Cause-Nachtrag (2026-09-15):** Der eigentliche Mechanismus dahinter, per Vergleichs-
        test aus dieser Sandbox belegt (drei Varianten desselben `GET /tasks`-Calls mit demselben
        `$SP_REST_TOKEN`-Wert):
        1. Über den Proxy (`http_proxy`/`HTTP_PROXY` gesetzt), Header unverändert → `200 OK`.
        2. Direkt (`--noproxy '*'`), Host-Header unverändert (`host.docker.internal:3876`) →
           `403 FORBIDDEN "Invalid Host header"`.
        3. Direkt (`--noproxy '*'`), Host-Header auf `localhost:3876` gespooft → SP akzeptiert den
           Host jetzt, meldet aber `401 UNAUTHORIZED "Invalid authorization token"` — mit
           **demselben** Token, der über den Proxy soeben noch funktioniert hat.
        Schlussfolgerung: `$SP_REST_TOKEN` (`sbx-cs-...`) ist selbst nur ein **Platzhalter** für ein
        sbx Custom Secret (vgl. Schritt 6: `sbx secret set-custom ... --host localhost`) — der
        Sandbox-Proxy (`gateway.docker.internal:3128`) ersetzt ihn erst beim Durchleiten durch den
        echten Bearer-Token, **und** normalisiert dabei offenbar den Host-Header passend zum beim
        Secret hinterlegten `--host`-Wert. Ohne Proxy im Pfad bleibt der Platzhalter-String
        unverändert und wird von Super Productivity zu Recht als ungültiger Token abgelehnt (401),
        *nachdem* ein unpassender Host bereits vorher mit 403 abgelehnt worden wäre. Praktische
        Konsequenz, über den reinen Docker-Fall hinaus: **jede** Umgebung, die diesen MCP-Server für
        `SP_REST_TOKEN` nutzt, muss ihre Requests zwingend über `HTTP(S)_PROXY=http://gateway.docker.internal:3128`
        leiten (bei Node zusätzlich `NODE_USE_ENV_PROXY=1`) — unabhängig von Docker vs. direktem
        Node-Prozess. Das ist der eigentliche, allgemeinere Grund hinter der 403/401-Symptomatik,
        nicht nur ein Docker-Env-Passthrough-Detail.
- [x] **9. Kit auf Container-Image umstellen** — Nutzer hat `../super-productivity-rest-mcp/` auf
      GitHub veröffentlicht und das Image nach GHCR gepusht: `ghcr.io/maystar/super-productivity-rest-mcp`
      (2026-09-15). Daraufhin:
      - `permissions.network.allow` in spec.yaml um `ghcr.io:443` ergänzt (war zunächst per
        Default-Deny blockiert — `docker pull` schlug mit `403 Forbidden`/"Blocked by network
        policy" fehl, bis der Nutzer die Freigabe per `sbx policy allow` gesetzt hat).
      - `docker pull ghcr.io/maystar/super-productivity-rest-mcp` verifiziert (Image-Entrypoint
        `node index.js`, passt zum README des neuen Repos).
      - Lokale Registrierung umgestellt: `claude mcp remove` + `claude mcp add ... -- docker run -i
        --rm -e SP_REST_TOKEN -e SP_REST_BASE_URL -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e
        http_proxy -e https_proxy -e no_proxy -e NODE_USE_ENV_PROXY
        ghcr.io/maystar/super-productivity-rest-mcp:latest` — `claude mcp list` zeigt
        `✔ Connected`. Proxy-Env-Vars sind weiterhin nötig, s. Root-Cause-Nachtrag oben.
      - `kits/super-productivity-rest-mcp/spec.yaml`s `setup.startup`-Block auf `docker pull` +
        obigen `docker run`-Aufruf umgestellt (statt `npm install` + `node index.js` aus dem
        Quellcode).
      - `kits/super-productivity-rest-mcp/mcp-server/` (lokaler Quellcode, `node_modules`
        eingeschlossen) komplett entfernt — lebt jetzt ausschließlich in
        `../super-productivity-rest-mcp/`.
      - **Noch nicht End-to-End getestet:** der neue `setup.startup`-Block in einem frischen
        `sbx run` (nur manuell in der laufenden Sandbox nachvollzogen, s. o.) — gleiche
        Einschränkung wie schon bei Schritt 7 vermerkt.
- [x] **10. Rennen zwischen MCP-Registrierung und Agent-Start behoben** (2026-09-15) — Nutzer
      meldete: In einer frischen Sandbox fand die zuerst gestartete Claude-Code-Session den
      MCP-Server nicht (`claude mcp list` zeigte ihn nicht/nicht verbunden); nach einem Neustart
      (neue Session) war er da. Reproduziert und Root Cause verifiziert gegen
      `docs.docker.com/ai/sandboxes/customize/kit-reference/`: der primäre Agent-Prozess wartet
      **grundsätzlich nicht** auf `setup.startup` — Zitat: *"the agent launches once startup
      commands have been dispatched, regardless of `background`. A value of `false` waits within
      the startup dispatcher before it runs the next command; it doesn't delay the agent
      entrypoint."* Das Rennfenster war zudem unnötig groß, weil das Skript vor der Registrierung
      erst `docker pull` ausführte — gemessen (gleiche Sandbox): `claude mcp add` allein ~1s, ein
      kalter `docker pull` dagegen ~7s (beim allerersten Pull mit leerem Cache eher mehr, s.
      Setup-Log aus Schritt 9 mit vollem Layer-Download).
      - **Fix, zweigleisig:**
        1. Registrierung zusätzlich unter `setup.install` — läuft laut Doku *"synchronously when
           a kit is applied ... during sandbox creation"*, der Agent startet nachweislich erst
           danach. Schließt das Rennen für die allererste Session einer neuen Sandbox vollständig.
        2. `setup.startup` bleibt bestehen (Selbstheilung bei jedem weiteren Neustart, Image
           aktuell halten), jetzt aber mit Registrierung **vor** dem Pull — verkürzt das laut Doku
           grundsätzlich nicht eliminierbare Rennen bei späteren Neustarts von ~7+s auf ~1s.
      - Beide Skript-Varianten (`install`- und `startup`-Reihenfolge) einzeln in der laufenden
        Sandbox durchgespielt: `claude mcp list` zeigt danach weiterhin `✔ Connected`.
      - **Noch nicht End-to-End getestet:** ob die allererste Session eines frischen `sbx run`
        den Server jetzt tatsächlich sofort sieht (nur die einzelnen Befehle isoliert verifiziert,
        nicht der volle `setup.install`-Ablauf beim echten Sandbox-Erstellen) — vor dem nächsten
        `sbx run` gegenprüfen.
- [x] **11. Setup-Skript aus spec.yaml ausgelagert** (2026-09-15) — Die Registrierungslogik war
      zweimal fast identisch inline in `setup.install` und `setup.startup` dupliziert. Jetzt als
      eine gemeinsame Datei `files/home/.super-productivity-mcp/setup.sh` (nimmt den Phasen-Tag
      `install`/`startup` als Argument, nur fürs Log relevant), gemäß dem Kit-`files`-Mechanismus
      (`docs.docker.com/ai/sandboxes/customize/kits/`, Zitat zur Reihenfolge: *"2. Static files
      under `files/home/`. 3. `setup.install` commands, in declaration order."*) — landet also
      **vor** `setup.install` unter `/home/agent/.super-productivity-mcp/setup.sh` (Standard-
      Permission `0644`, daher Aufruf explizit mit `sh <Pfad> <Tag>` statt per Shebang/exec-Bit).
      `spec.yaml`s `install`/`startup`-Einträge rufen jetzt nur noch dieses eine Skript auf.
      Verifiziert: Skript lokal nach `$HOME` kopiert und zweimal (`install`, `startup`)
      nacheinander aufgerufen — beide Tags erscheinen korrekt im gemeinsamen Log,
      `claude mcp list` zeigt danach weiterhin `✔ Connected`. **Noch nicht getestet:** der
      tatsächliche Kopiervorgang durch `sbx` selbst bei einem echten `sbx run`/`sbx kit add`
      (nur die Kopie von Hand simuliert, s. o.).
- [x] **12. Schema-Fehler in Schritt 11 behoben** (2026-09-15) — Realer `sbx`-Lauf schlug fehl:
      `invalid spec.yaml: yaml: unmarshal errors: line 28: cannot unmarshal !!seq into string /
      line 32: field background not found in type spec.InstallCommand`. Ursache: `setup.install`
      und `setup.startup` haben **unterschiedliche** Schemas, die bislang (Schritt 7–11) nie
      gegeneinander geprüft wurden, weil `install` erst in Schritt 10 dazukam. Verifiziert gegen
      `docs.docker.com/ai/sandboxes/customize/kit-reference/`: bei `setup.install` ist `command`
      ein einzelner **String** (*"Shell strings are passed to `sh -c`."*), es gibt **kein**
      `background`-Feld und `user` defaultet auf `"0"` (root). Bei `setup.startup` ist `command`
      dagegen eine **argv-Liste** (*"String array, not interpreted by a shell."*) mit `background`
      (Default `false`) und `user`-Default `"1000"`. Der `install`-Eintrag nutzte fälschlich das
      `startup`-Schema (Listen-`command` + `background: false`). Fix: `install.command` auf den
      String `"sh /home/agent/.super-productivity-mcp/setup.sh install"` umgestellt, `background`
      entfernt. Verifiziert: `sh -c '<dieser String>'` lokal ausgeführt — Log zeigt den `install`-
      Tag korrekt, `claude mcp list` weiterhin `✔ Connected`. Weiterhin **nicht getestet:** ein
      echter `sbx run` mit dieser korrigierten spec.yaml (YAML-Syntax lokal validiert, aber ohne
      `sbx`-Binary in dieser Sandbox nicht gegen das reale Schema geprüft).
- [x] **13. Zweite, härtere Rennen-Variante gefunden und behoben** (2026-09-16) — Nutzer meldete
      nach Schritt 12 (frische Sandbox mit korrigiertem `spec.yaml`, aber nur `claude` neu
      gestartet, nicht die Sandbox selbst): MCP-Server weiterhin nicht erreichbar. Diagnose in der
      betroffenen Sandbox:
      - `files/home/.super-productivity-mcp/setup.sh` war korrekt nach `/home/agent/...` kopiert.
      - Setup-Log zeigte **beide** Phasen erfolgreich (`install` um 22:39:45 UTC, `startup` nur 4s
        später um 22:39:49 UTC — auf einer echten Sandbox-Erstellung feuern also offenbar beide,
        nicht nur `install`).
      - Trotzdem: `claude mcp list` zeigte den Server **nicht**, `~/.claude.json`s
        `mcpServers`-Block enthielt nur noch `mcp-gateway` (den eingebauten Gateway-Server), nicht
        `super-productivity`. `stat` zeigte: `~/.claude.json` wurde **36s nach** dem letzten
        Setup-Log-Eintrag nochmal komplett neu geschrieben — von der Top-Level-Struktur her klar
        durch den `claude`-Prozess selbst (Keys wie `numStartups`, `hasCompletedOnboarding`,
        `firstStartTime`, diverse Caches — kein sbx-/Kit-Mechanismus).
      - Gegenprobe: manuelle Neu-Registrierung **nach** dem Boot (Sandbox längst hochgefahren)
        blieb auch nach 60s stabil — also kein dauerhaftes Reconciling, sondern ein einmaliges
        Ereignis kurz nach dem Boot.
      - **Root Cause identifiziert:** Das Skript machte bis dahin immer `claude mcp remove` **vor**
        `claude mcp add` (nötig, weil `claude mcp add` mit "already exists" fehlschlägt, wenn der
        Server schon registriert ist — per `claude mcp add --help`/Test bestätigt). Zwischen
        `remove` und `add` gibt es eine kurze Lücke, in der `~/.claude.json` **keinen**
        `super-productivity`-Eintrag hat. Fällt der erste Start-Read der frisch startenden
        interaktiven Agent-Session in genau diese Lücke, übernimmt sie diesen Stand ins eigene
        In-Memory-Modell — und schreibt ihn bei ihrem ersten eigenen Housekeeping-Save (s. o.)
        wieder auf die Platte, unabhängig davon, dass unser `add` kurz danach erfolgreich war.
        Der redundante zweite Lauf (`startup`, 4s nach `install`, obwohl schon alles registriert
        war) war der eigentliche Auslöser, weil er genau in dem Moment lief, in dem die Session
        hochfuhr.
      - **Fix:** `remove` nur noch aufrufen, wenn er nötig ist — `setup.sh` prüft jetzt per
        `claude mcp get super-productivity`, ob der Server schon registriert ist, und ruft `add`
        **nur** auf, wenn das fehlschlägt. Kein `remove` mehr im Normalfall, also auch keine
        Lücke mehr bei jedem weiteren Start. Der allererste `add` (in `setup.install`) war ohnehin
        nie von einem `remove` begleitet und blockiert den Agenten-Start vollständig, hat also
        von vornherein keine Lücke.
      - Verifiziert lokal: Skript zweimal hintereinander aufgerufen (simuliert `install` dann
        `startup`) — zweiter Lauf erkennt "already registered, leaving it as-is", keine
        Neuregistrierung, `claude mcp list` weiterhin `✔ Connected`.
      - **Noch nicht getestet:** ob dieser Fix das Problem in einer echten frischen Sandbox
        tatsächlich behebt (nur das Skript isoliert verifiziert, nicht der volle `sbx run`-Ablauf
        mit einer echten, erstmalig startenden interaktiven Session).
- [x] **14. Umstieg auf `managed-mcp.json` versucht und wieder verworfen** (2026-09-16) — Nutzer wollte grundsätzlich wissen, ob MCP-Registrierung über eine reine
      Konfigurationsdatei statt per `claude mcp add`-Laufzeitaufruf möglich ist (Motivation: Schritt
      13s Fix reduziert das Rennen, eliminiert es aber nicht strukturell — jede Mutation von
      `~/.claude.json` zur Laufzeit bleibt riskant, solange der `claude`-Prozess dieselbe Datei
      auch selbst schreibt). Recherche (`code.claude.com/docs/en/mcp`, `.../managed-mcp`,
      `.../settings-reference`, per Agent + eigenem `WebFetch` gegengeprüft) ergab drei Optionen:
      - **`.mcp.json`** (Projekt-Scope, im Workdir) — live in dieser Sandbox verifiziert: wird
        automatisch erkannt (`claude mcp list` zeigt `Scope: Project config (shared via
        .mcp.json)`), hat aber einen Trust-Prompt (`⏸ Pending approval (run \`claude\` to
        approve)`), den `-p`-Modus laut Doku und per eigenem Test (`claude -p "..."` listete die
        Tools des Test-Servers korrekt) umgeht, im interaktiven Modus aber laut Doku erst mit
        `enableAllProjectMcpServers`/`enabledMcpjsonServers` in `.claude/settings.json`. Sicher,
        aber an ein Projektverzeichnis gebunden — Nutzer wollte explizit "außerhalb des
        Projektverzeichnisses".
      - **`managedMcpServers`** (in `managed-settings.json`) — laut Doku wörtlich nur für
        **remote** Server: *"The entry has no `command`, `args`, `env`, or `headersHelper`
        member, so a managed settings document never names a program to run on a user's
        machine."* Für unseren Docker-/stdio-Server also **nicht** nutzbar.
      - **`managed-mcp.json`** (System-Pfad `/etc/claude-code/managed-mcp.json` unter Linux) —
        unterstützt volle stdio-Server (command/args/env, gleiches Schema wie `.mcp.json`), liegt
        systemweit außerhalb jedes Projekts, kein Trust-Prompt. Haken laut Doku: **exklusive
        Kontrolle** — sobald die Datei existiert, lädt Claude Code *nur noch* die dort gelisteten
        Server (plus fest eingebaute "in-process"-Server wie vermutlich dieser Sandbox
        `mcp-gateway`) und blockt jedes weitere `claude mcp add` mit *"Cannot add MCP server:
        enterprise MCP configuration is active..."*. `claude.ai`-Connectoren (z. B. `Trello`)
        werden dabei ebenfalls unterdrückt, außer man setzt zusätzlich `"allowAllClaudeAiMcps":
        true` in einer weiteren `/etc/claude-code/managed-settings.json`.
      - **Live-Testversuch in dieser Sandbox scheiterte an einer Sicherheits-Schranke:**
        `sudo tee /etc/claude-code/managed-mcp.json` wurde vom Claude-Code-Auto-Mode-Classifier
        mit "Self-Modification" blockiert (folgerichtig — es ist die Config der gerade laufenden
        Session selbst). Ob `mcp-gateway`/`Trello` das wirklich überleben, ist damit **nicht**
        aus dieser Sandbox heraus verifizierbar.
      - **Nutzerentscheidung:** trotz des ungetesteten Risikos `managed-mcp.json` ausprobieren,
        und zwar direkt über das Kit (nicht mehr manuell) — Nutzer will einfach eine neue Sandbox
        erstellen und dort prüfen, statt Befehle von Hand einzutippen.
      - **Umsetzung:** `files/home/.super-productivity-mcp/setup.sh` schreibt jetzt
        `/etc/claude-code/managed-mcp.json` (unser Server) und `/etc/claude-code/managed-settings.json`
        (`allowAllClaudeAiMcps: true`) statt `claude mcp add`/`get` aufzurufen — kein
        `~/.claude.json`-Zugriff mehr, damit strukturell **kein** Rennen mehr mit dem
        Housekeeping-Save des Agenten möglich (Claude Code liest `managed-mcp.json` nur, schreibt
        es nie selbst). `spec.yaml`s `install`/`startup`-Einträge laufen jetzt als `user: "0"`
        (root), weil `/etc/claude-code/` Root-Rechte braucht.
      - Verifiziert (ohne den blockierten `/etc/claude-code`-Zugriff): Skript-Logik per
        sed-Umleitung in ein Temp-Verzeichnis statt `/etc/claude-code` durchgespielt — beide
        generierten JSON-Dateien sind syntaktisch valide und enthalten die erwarteten Werte.
      - **Live-Test in einer echten frischen Sandbox (Nutzer, `sbx run`):**
        ```
        claude.ai Trello: https://mcp.trello.com/v1 - ! Needs authentication
        super-productivity: docker run ... - ✔ Connected
        ```
        `super-productivity` lief sofort ohne Trust-Prompt, `Trello` überlebte dank
        `allowAllClaudeAiMcps`. Aber: **`mcp-gateway` fehlte komplett** in der Liste.
      - **Root Cause geklärt (Nutzer-Nachfrage: "über welchen Weg wird mcp-gateway gesetzt?"):**
        `claude mcp get mcp-gateway` (in dieser Arbeits-Sandbox, wo `managed-mcp.json` nie aktiv
        war) zeigt `Scope: User config (available in all your projects)` — **derselbe simple
        `claude mcp add --scope user`-Mechanismus** wie unser alter `super-productivity`-Ansatz,
        nur von der Sandbox-Basis-Provisionierung selbst ausgeführt (nutzt die vorhandenen
        Env-Vars `MCP_GATEWAY_URL`/`MCP_SENTINEL_TOKEN_NAME=proxy-managed` für URL/Header). Keine
        "in-process"/CLI-eingebaute Sonderrolle, also **nicht** von `managed-mcp.json`s
        Exklusivität ausgenommen — passt exakt zum beobachteten Ausfall.
      - **Konsequenz:** `managed-mcp.json` würde nicht nur einen Sonderfall brechen, sondern
        **jeden** Server, den die Sandbox-Plattform selbst auf die übliche Art registriert — für
        ein schlankes Produktivitäts-Kit zu riskant/greifend. **Verworfen.**
      - **Revert durchgeführt:** `spec.yaml` und `files/home/.super-productivity-mcp/setup.sh` auf
        den Stand vor Schritt 14 zurückgesetzt (Commit `6fd4882`, Schritt 13s `~/.claude.json`
        + `claude mcp get`-Check-Ansatz), `user: "1000"` statt `"0"` (kein Root mehr nötig, kein
        `/etc/claude-code`-Zugriff mehr). Kommentar in `setup.sh` ergänzt, der explizit auf diesen
        Abschnitt verweist, damit ein künftiger Versuch nicht denselben Weg wiederholt, ohne die
        Begründung zu kennen. Lokal erneut verifiziert: `install` dann `startup` durchlaufen,
        `claude mcp list` zeigt `mcp-gateway`, `claude.ai Trello` und `super-productivity`
        (`✔ Connected`) alle wie erwartet nebeneinander.
      - **Fazit für künftige Versuche in diese Richtung:** ein systemweiter, projektunabhängiger,
        Trust-Prompt-freier Weg für stdio-MCP-Server existiert in Claude Code aktuell nur über
        `managed-mcp.json`, und der ist für diesen Zweck strukturell ungeeignet (exklusive
        Kontrolle). Bleibt offen als mögliche Alternative, falls später doch noch gewünscht:
        Projekt-Scope `.mcp.json` (Schritt 14s erste Recherche-Option) — sicher, aber an das
        Sandbox-Workdir gebunden.

---

## Bereits erledigte Host-Voraussetzungen (aus vorherigem Anlauf übernommen, weiterhin gültig)
- [x] Ubuntu-Version geprüft (24.04+)
- [x] KVM verfügbar
- [x] Docker Hub Account vorhanden
- [x] Anthropic-API-Key/Abo vorhanden
- [x] Super Productivity ≥ 14.0.0 (Electron-Desktop) installiert
- [x] `sbx` installiert, `sbx login` durchgeführt

## Noch offen, bevor Schritt 7 abgeschlossen werden kann
- [x] In Super Productivity: **Settings → Misc → Enable local REST API** aktivieren, Access Token notieren

---

## Offene Annahmen / bei Abweichung anpassen
- **Geklärt (2026-09-14):** `permissions.network.allow` ist gültig, brauchte aber
  `schemaVersion: "2"` statt `"1"` (aus der alten Anleitung übernommen, ohne die Versionsbindung
  zu prüfen). Auf `"2"` korrigiert.
- **Geklärt (2026-09-14, Schritt 6):** Netzwerk-Policy matcht `host.docker.internal:3876`
  korrekt — `/health` liefert `200` ohne Policy-Block. `spec.yaml` muss hier nicht geändert werden.
- **Geklärt (2026-09-14, Schritt 6):** `sbx secret set-custom --host host.docker.internal`
  funktioniert **nicht** für die Token-Substitution (echte `401` mit unersetztem Platzhalter
  beobachtet); `--host localhost` ist der richtige Wert (verifiziert per direktem Test des neuen
  Platzhalters gegen `/status` → `200`). README.md Schritt 2 nutzt jetzt `--host localhost`.
- **Geklärt (2026-09-14, Schritt 6b):** In einer frisch mit `--host localhost`-Secret gestarteten
  Sandbox (`sp-rest-mcp`, Default-Name) liefert `GET /status` mit
  `Authorization: Bearer $SP_REST_TOKEN` ein echtes `200 OK` — Token-Substitution funktioniert
  regulär über `process.env.SP_REST_TOKEN`, kein manueller Workaround nötig. Die schmalere Frage
  (Secret-Update auf eine **bereits laufende** Sandbox nach deren Neustart) bleibt ungetestet, ist
  aber für den weiteren Plan irrelevant, da Sandboxen ohnehin mit bereits gesetztem Secret
  gestartet werden.
  Aktuelle Sandbox heißt `sp-rest-mcp` (Default-Name), nicht mehr `superprod` (die war zwischen-
  zeitlich beendet worden).
- Kits sind laut Docker-Doku "experimentell" — Schema-Details können an `schemaVersion` gebunden
  sein (s.o.); bei Fehlern in Schritt 7 (`setup:`/`commands:`/`files:`) zuerst dort ansetzen, statt
  am Feldnamen selbst zu zweifeln.
- **Geklärt (2026-09-14, Schritt 7):** `setup:`/`install:`/`startup:`/`files:` sind unter
  `schemaVersion: "2"` die korrekten Schlüssel (`setup:` top-level, nicht `commands:`) —
  verifiziert gegen die reale Kit-Referenz (von der Sandbox aus erreichbar, s. u.). Details/
  Ausführungsreihenfolge als Kommentar in spec.yaml.
- **Geklärt (2026-09-14, Schritt 7):** Generelles Web (z. B. `docs.docker.com`, `github.com`) war
  von der Sandbox aus ohne weitere Freigabe erreichbar — die in Kapitel "Ziel" und in
  `docs/rest-api-reference.md` getroffene Annahme, ein Sandbox-Agent bräuchte dafür zusätzliche
  Netzwerkfreigabe, war für **diese** Sandbox-Konfiguration zu vorsichtig (evtl. sandbox-/
  policy-abhängig, daher nicht pauschal verallgemeinert, aber hier kein Blocker).
