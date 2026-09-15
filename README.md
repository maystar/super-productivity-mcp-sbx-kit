# Super Productivity ↔ Claude Code via Local REST API (sbx-Sandbox)

Ziel: Claude Code, laufend in einer `sbx`-Sandbox, greift auf die laufende Super-Productivity-
Desktop-App auf dem Host zu — über deren offizielle
[Local REST API](https://github.com/super-productivity/super-productivity/wiki/3.01-API#3-local-rest-api),
nicht über ein Plugin oder dateibasiertes IPC. Das ersetzt einen früheren, komplexeren Versuch mit
Plugin + eigenem MCP-Subprozess + gemountetem IPC-Verzeichnis (siehe Git-Historie dieses Repos,
Commit `e275fba`, sowie [super-productivity-sbx-kit-in-sandbox.md](./super-productivity-sbx-kit-in-sandbox.md) —
diese Datei beschreibt den **verworfenen** Ansatz und dient nur noch als historische Referenz).

Aktueller Stand: **Netzwerk-Konnektivität wird aufgebaut und verifiziert.** Der eigentliche
MCP-Server (der die REST-Endpunkte als Claude-Code-Tools kapselt) ist der nächste Ausbauschritt,
siehe [TODO.md](./TODO.md).

---

## Wofür diese Sandbox aktuell genutzt werden kann

Mit dem hier definierten Kit (`kits/super-productivity-rest-mcp`) kann eine Sandbox:

- per HTTP auf `http://host.docker.internal:3876` zugreifen (= die Super-Productivity Local REST
  API auf dem Host, die dort auf `127.0.0.1:3876` lauscht)
- damit z. B. `curl http://host.docker.internal:3876/health` erfolgreich ausführen (unauthentifiziert,
  einziger offener Endpunkt)

Sie kann **noch nicht**: Tasks lesen/erstellen etc. — dafür fehlen noch (a) der Access Token in der
Sandbox und (b) ein MCP-Server, der die Endpunkte als Tools bereitstellt. Beides folgt in einem
späteren Schritt.

---

## Host-Voraussetzungen

Bereits erledigt (siehe abgehakte Punkte in [TODO.md](./TODO.md)):
- `sbx` installiert, `sbx login` durchgeführt, KVM verfügbar
- Super Productivity ≥ 14.0.0 (Electron-Desktop-Version) installiert

Noch zu tun, bevor die REST API tatsächlich nutzbar ist (nicht blockierend für den reinen
Konnektivitätstest in Schritt 6 der TODO.md, aber für alles danach):
- In Super Productivity: **Settings → Misc → Enable local REST API** aktivieren
- Access Token dort notieren (wird für den MCP-Server in einem späteren Schritt benötigt, z. B.
  als `sbx secret set-custom`)

---

## Sandbox mit diesem Kit starten

Dieses Verzeichnis dient hier **sowohl als Kit-Quelle als auch als Sandbox-Workdir** (anders als
beim verworfenen Vorgänger-Ansatz, wo beides getrennt war — für den aktuellen Test/Entwicklungsstand
ist das bewusst so gewählt, damit der Kit direkt aus der laufenden Sandbox heraus weiterentwickelt
werden kann). Sandbox-Name ist fest auf `sp-rest-mcp` gesetzt (nicht mehr frei wählbar) — nur so
lässt sich das Secret unten eindeutig genau dieser Sandbox zuordnen.

### 1. Access Token in Super Productivity holen

Settings → Misc → **Enable local REST API** aktivieren, falls noch nicht geschehen, dann den dort
angezeigten **Access Token** kopieren.

### 2. Token als Secret registrieren (Host-Kommando, vor `sbx run`)

```bash
sbx secret set-custom --sandbox sp-rest-mcp --host host.docker.internal --env SP_REST_TOKEN --value "<dein-access-token>"
```

Wie das wirkt (Platzhalter-Mechanismus, siehe [docs.docker.com – Custom Secrets](https://docs.docker.com/reference/cli/sbx/secret/set-custom/)):
Die Sandbox sieht in `$SP_REST_TOKEN` nur einen **Platzhalter**, nicht den echten Token. Erst wenn
ein Request aus der Sandbox tatsächlich an den Host `host.docker.internal` geht, ersetzt der
sbx-Proxy den Platzhalter im Request (z. B. im `Authorization`-Header) durch den echten Wert. Der
Token liegt damit nie im Klartext im Kit, im Repo oder im Sandbox-Dateisystem.

⚠️ **Unverifiziert** (kein `sbx`-Zugriff von hier aus möglich):
- Ob `--host host.docker.internal` das Richtige ist, oder ob (analog zur Netzwerk-Policy, die
  denselben Zugriff intern als Domain `localhost:3876` geloggt hat) stattdessen `--host localhost`
  nötig ist.
- Ob das Secret **vor** `sbx run` gesetzt sein muss, damit die Sandbox es beim Start sieht, oder ob
  es auch nachträglich funktioniert.

Beides in Schritt 6/7 der [TODO.md](./TODO.md) mit der echten Sandbox verifizieren; bei Fehlschlag
den `--host`-Wert tauschen bzw. den Befehl nach dem `sbx run` unten erneut ausführen.

### 3. Sandbox erstellen

```bash
cd /home/fabian/claude-workspace/super-productivity
sbx run claude --name sp-rest-mcp \
  --kit ./kits/super-productivity-rest-mcp \
  .
```

Kein zweiter Mount-Pfad nötig (anders als beim alten Ansatz) — die REST API braucht kein
gemountetes Host-Verzeichnis, nur die Netzwerkfreigabe aus dem Kit.

Nach dem Start: `/mcp` zeigt (noch) keinen Server, da noch keiner registriert ist — das ist für
den aktuellen Schritt (Konnektivitätstest) erwartet und normal. `echo $SP_REST_TOKEN` in der
Sandbox sollte den Platzhalter aus Schritt 2 zeigen (nicht leer, aber auch nicht der echte Token —
das ist beabsichtigt, siehe oben).

---

## Weiteres Vorgehen

Siehe [TODO.md](./TODO.md) für den vollständigen Plan (Schritt 6: Erreichbarkeit testen,
Schritt 7: MCP-Server entwickeln und ins Kit integrieren). Für Schritt 7 liegt die
API-Referenz (Endpunkte, Felder, Fehlercodes) bereits lokal vor:
[docs/rest-api-reference.md](./docs/rest-api-reference.md) — nötig, weil ein Agent innerhalb der
Sandbox keinen Zugriff auf das Gespräch hat, in dem diese Referenz recherchiert wurde.
