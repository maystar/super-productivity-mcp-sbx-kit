# TODO: Super Productivity MCP in sbx-Sandbox einrichten

Kontext: [super-productivity-sbx-kit-in-sandbox.md](./super-productivity-sbx-kit-in-sandbox.md) ist die
vollständige Anleitung. Diese Datei hier ist bereits vorbereitet worden von einem Claude-Code-Agent,
der selbst **innerhalb** einer sbx-Sandbox läuft und daher weder `sbx` ausführen noch GUI-Dialoge
bestätigen kann. Alle Punkte unten müssen von einem **Host-Agent** (oder dir direkt am Host-Terminal)
bzw. später von einem **Agent innerhalb der neu erstellten Sandbox** erledigt werden.

**Wichtig zur Rolle dieses Verzeichnisses:** `/home/fabian/claude-workspace/super-productivity` ist
**nur der Kit-Quellordner** (wird nach `~/kits/super-productivity-mcp` kopiert, siehe Punkt 4) —
**nicht** der Workdir der späteren Sandbox.

Der Kit ist absichtlich generisch gehalten (Mixin), damit er für **beliebige** Sandboxes/Projekte über
`--kit` wiederverwendet werden kann. Er registriert den MCP-Server **user-scoped** (in `~/.claude.json`
des Sandbox-Users), nicht projekt-scoped — deshalb ist der Kit auch unabhängig davon nutzbar, welches
Projektverzeichnis gerade als Workdir gemountet ist (das ursprüngliche Projekt hier wird in der
späteren Sandbox **nicht** gemountet sein — nur der Kit-Ordner wird dorthin kopiert/referenziert).

Bereits erledigt (in diesem Repo/Verzeichnis abgelegt):
- ✅ [kits/super-productivity-mcp/spec.yaml](./kits/super-productivity-mcp/spec.yaml) — Kit-Spec (Schritt 3),
  Version **gepinnt auf `2.2.1`**. Enthält einen Install-Command, der den Host-`$HOME`-Pfad
  **automatisch** aus dem gemounteten IPC-Verzeichnis ableitet (siehe „Wie die HOME-Auflösung
  funktioniert" unten) und darüber den MCP-Server **user-scoped in `~/.claude.json`** registriert —
  kein manuelles Kit-Argument, keine `.mcp.json` im Projekt, kein `sed`-Schritt mehr nötig.
- ✅ [kits/super-productivity-mcp/files/home/.sp-mcp-kit/write_user_mcp_config.py](./kits/super-productivity-mcp/files/home/.sp-mcp-kit/write_user_mcp_config.py) —
  wird automatisch (statischer `files/`-Mechanismus, läuft vor den Install-Commands) nach
  `/home/agent/.sp-mcp-kit/` in die Sandbox kopiert und merged dort den `super-productivity`-Eintrag
  in `~/.claude.json`, ohne den Rest der Datei anzufassen.
- 🗑️ `.mcp.json` (Projekt-scoped, ursprünglich hier abgelegt) wurde **entfernt** — ersetzt durch
  die user-scoped Registrierung oben, da dieses Projektverzeichnis in der späteren Sandbox ohnehin
  nicht gemountet wäre.

## Wie die HOME-Auflösung funktioniert (zur Info, keine Aktion nötig)

1. Beim Erstellen der Sandbox wird der zweite Workdir-Pfad übergeben:
   `sbx run ... <projekt-workdir> "$HOME/.local/share/super-productivity-mcp"` (`$HOME` hier = **Host**-Shell).
2. Dieser Pfad wird 1:1 unter demselben absoluten Pfad in die Sandbox gemountet.
3. Der zweite Install-Command im Kit sucht per `find /home -path '/home/*/.local/share/super-productivity-mcp'`
   nach genau diesem gemounteten Verzeichnis und leitet daraus `/home/<user>` als Host-HOME-Pfad ab.
4. Der abgeleitete Pfad wird a) als `SP_HOST_HOME` in `/etc/sandbox-persistent.sh` persistiert (zur
   Diagnose in jeder Shell) und b) direkt an `write_user_mcp_config.py` übergeben, das ihn als
   `env.HOME` in den `super-productivity`-Eintrag von **`~/.claude.json`** (User-Scope, `/home/agent/.claude.json`
   in der Sandbox) schreibt.

**Nicht von hier aus verifizierbar** (siehe Validierungsschritt in Punkt 5 unten):
- Dass die Workdir-Mounts beim Sandbox-Start bereits aktiv sind, *bevor* die Kit-Install-Commands
  laufen. Falls nicht, findet der `find`-Befehl nichts, das Kit gibt eine Warnung aus, und der
  Server wird nicht registriert.
- Ob der Kit-Spec-Schlüssel wirklich `setup: install: / files:` heißt (aktuelle Docker-Doku, Stand
  dieser Session) oder wie in der ursprünglichen Anleitung `commands: install:` (Kits sind laut
  Docker-Doku "experimentell" — Schema kann sich geändert haben oder die Doku war zum Zeitpunkt der
  Anleitung anders). **Vor dem ersten echten `sbx run` gegenprüfen**, im Zweifel in
  [spec.yaml](./kits/super-productivity-mcp/spec.yaml) anpassen.

---

## Für einen Host-Agent (bzw. dich direkt am Host-Terminal)

### 1. Voraussetzungen prüfen (Schritt „Voraussetzungen" der Anleitung)
- [x] Ubuntu-Version prüfen (24.04+ offiziell empfohlen)
- [x] KVM prüfen: `lsmod | grep kvm` → muss `kvm_intel`/`kvm_amd`/`kvm` zeigen
- [x] Docker Hub Account vorhanden für `sbx login`
- [x] Anthropic-API-Key **oder** Claude-Abo (Pro/Max) vorhanden
- [x] Super Productivity ≥ 14.0.0, Electron-Desktop-Version installiert (nicht Web)
      Download: https://github.com/super-productivity/super-productivity/wiki/2.01-Downloads-and-Install

### 2. `sbx` installieren & einloggen (Schritt 1)
- [x] `curl -fsSL https://get.docker.com | sudo SBX=1 sh` (oder `REPO_ONLY=1` + `apt-get install docker-sbx`, falls Docker schon läuft)
- [x] `sudo usermod -aG kvm $USER && newgrp kvm`
- [x] `sbx login`

### 3. Super-Productivity-Plugin installieren (Schritt 2) — **manueller GUI-Schritt, kann kein Agent automatisieren**
- [ ] **Vorher Backup erstellen**: https://github.com/super-productivity/super-productivity/wiki/2.02-Restore-Data-From-Backup
- [ ] Plugin-ZIP laden: https://github.com/ben-elliot-nice/superproductivity-mcp/releases/latest
- [ ] In Super Productivity: Settings → Plugins → Upload Plugin → ZIP auswählen
- [ ] Plugin aktivieren (Toggle) → im nativen Electron-Dialog **„Allow"** für `nodeExecution` bestätigen
- [ ] Im Plugin-Dashboard die genaue Versionsnummer notieren und mit der gepinnten Version in
      [kits/super-productivity-mcp/spec.yaml](./kits/super-productivity-mcp/spec.yaml) (aktuell `2.2.1`)
      abgleichen — bei Abweichung dort anpassen:
      **Version im Plugin-Dashboard: ______________**
- [ ] Prüfen, dass Super Productivity mindestens einmal gelaufen ist, sodass
      `~/.local/share/super-productivity-mcp/` auf dem Host existiert:
      `ls "$HOME/.local/share/super-productivity-mcp"`
      (ohne dieses Verzeichnis schlägt sowohl der Mount in Schritt 5 als auch die Auto-Erkennung im Kit fehl)

### 4. Kit an zentralen Ort kopieren (damit es für beliebige Sandboxes wiederverwendbar ist)
- [ ] Kit-Ordner **inklusive** `files/`-Unterordner aus diesem Repo an den konventionellen Kit-Ort
      auf dem Host kopieren:
      ```bash
      mkdir -p ~/kits
      cp -r /home/fabian/claude-workspace/super-productivity/kits/super-productivity-mcp ~/kits/
      ```

### 5. Sandbox erstellen (Schritt 5 der Anleitung)
- [ ] Beliebiges Projektverzeichnis als Workdir wählen (egal welches — der Kit ist davon
      unabhängig) und Sandbox-Namen frei vergeben, z. B.:
      ```bash
      cd <ein-beliebiges-projektverzeichnis>
      sbx run claude --name <beliebiger-name> \
        --kit ~/kits/super-productivity-mcp \
        <ein-beliebiges-projektverzeichnis> "$HOME/.local/share/super-productivity-mcp"
      ```
- [ ] Beim ersten Start: Anthropic-Zugangsdaten hinterlegen
      (`sbx secret set -g anthropic` für API-Key, oder OAuth-Flow für Abo)
- [ ] **Validieren:**
      - Kit-Install-Log auf die Meldung `write_user_mcp_config: super-productivity MCP-Server ...
        registriert` prüfen (bzw. die `WARNUNG:`-Zeile, falls die Auto-Erkennung fehlgeschlagen ist)
      - In der Sandbox `cat ~/.claude.json` prüfen: `mcpServers.super-productivity.env.HOME` sollte
        dem tatsächlichen Host-Home-Pfad entsprechen
      - Bei Fehlschlag: `SP_HOST_HOME` manuell prüfen/setzen und uns Bescheid geben, damit das Kit
        robuster gemacht werden kann

---

## Für einen Agent **innerhalb** der neu erstellten Sandbox (nach Schritt 5)

### 6. Verbindung testen (Schritt 6 der Anleitung)
- [ ] `/mcp` ausführen → `super-productivity` sollte als **verbunden** angezeigt werden
- [ ] `debug_directories`-Tool nutzen, um die tatsächlich verwendeten Pfade zu prüfen —
      insbesondere bestätigen, dass `HOME` korrekt auf den Host-Home-Pfad aufgelöst wurde
      (`echo $SP_HOST_HOME` zum Vergleich)
- [ ] Testaufrufe:
      - "Zeig mir alle offenen Aufgaben in Super Productivity"
      - "Erstelle eine Aufgabe „Quartalsbudget prüfen" mit Tag #finance"
- [ ] Falls `pip install` fraglich war: `pip show superproductivity-mcp` in der Sandbox prüfen
      (von außen: `sbx exec <sandbox-name> -- pip show superproductivity-mcp`)

### 7. Bei Problemen
Siehe Troubleshooting-Tabelle in
[super-productivity-sbx-kit-in-sandbox.md](./super-productivity-sbx-kit-in-sandbox.md#troubleshooting).
Beachte: Die dortige Zeile zum `.mcp.json`-Trust-Dialog entfällt, da wir user-scoped statt
projekt-scoped registrieren.

---

## Offene Annahmen / bei Abweichung anpassen
- Es wurde angenommen, dass Workdir-Mounts beim Sandbox-Start bereits aktiv sind, bevor die
  Kit-Install-Commands laufen (Voraussetzung für die Auto-Erkennung von `SP_HOST_HOME`). Unverifiziert —
  siehe Validierungsschritt in Punkt 5.
- Es wurde angenommen, dass der `agent`-User (uid 1000) ohne `sudo` nach `/etc/sandbox-persistent.sh`
  schreiben darf (analog zu den Beispielen im Projekt-CLAUDE.md). Unverifiziert.
- Es wurde angenommen, dass der Kit-Spec-Schlüssel `setup: install:/files:` heißt (aktuelle Docker-Doku),
  nicht `commands: install:` (ursprüngliche Anleitung). Unverifiziert — siehe Hinweis oben.
- Es wurde angenommen, dass für user-scoped MCP-Server (`~/.claude.json`) kein projekt-bezogener
  "Trust this workspace"-Dialog mehr erscheint (der war nur für `.mcp.json` im Repo dokumentiert).
  Unverifiziert — falls doch ein Dialog erscheint, ist das nur einmalig zu bestätigen und kein Fehler.
