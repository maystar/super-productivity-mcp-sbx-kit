# Super Productivity + Claude Code: MCP-Server läuft komplett in der sbx-Sandbox

Diese Anleitung ist eigenständig lesbar: Sie deckt Voraussetzungen, `sbx`-Installation, die Super-Productivity-Plugin-Einrichtung und den Kit-basierten Sandbox-Aufbau ab, bei dem der MCP-Server als normaler Subprozess **innerhalb** der microVM läuft — nicht auf dem Host.

> **Hinweis:** Kits sind laut Docker-Doku aktuell **experimentell** ("Kit file format, CLI commands... subject to change"). Diese Variante ist technisch sauberer im Sinne von "MCP wirklich isoliert", aber weniger battle-tested als eine host-seitige Lösung.

---

## Wie Super Productivity und der MCP-Server überhaupt kommunizieren

Bevor es an den Aufbau geht, der zentrale Mechanismus, der alles andere in dieser Anleitung erklärt:

Es ist **kein Netzwerk-Protokoll** (kein HTTP, kein WebSocket) zwischen Plugin und MCP-Server, sondern **dateibasiertes IPC** ("Inter-Process Communication"):

- Beide Seiten — das Super-Productivity-Plugin (läuft *innerhalb* der Electron-App) und der MCP-Server (ein Python-Prozess) — lesen und schreiben Kommando- und Antwort-Dateien in ein gemeinsames Verzeichnis: `~/.local/share/super-productivity-mcp/` (Linux/macOS).
- Der MCP-Server **pollt** dieses Verzeichnis in einem festen Intervall (Standard ~2 Sekunden), sieht neue Kommando-Dateien vom Plugin, verarbeitet sie, schreibt die Antwort zurück ins selbe Verzeichnis.
- Es gibt **keinen Socket, keinen Port, keine Netzwerkverbindung** zwischen den beiden — die einzige Kopplung ist genau dieses eine Verzeichnis auf der Festplatte.

**Das ist der Grund**, warum "MCP im Container/Sandbox laufen lassen" überhaupt eine Herausforderung ist: Wo auch immer der MCP-Server läuft, er *muss* exakt dieses Host-Verzeichnis sehen können — sonst gibt es keine Verbindung zur App. Alles, was folgt, dreht sich letztlich darum, wie man diesen einen Ordner dorthin bekommt, wo der Server läuft.

---

## Architekturüberblick

```
┌───────────────────────────────────────────┐
│ Host (Linux)                               │
│  Super Productivity (Electron, nativ)      │
│   └─ Plugin ── liest/schreibt: ────────────┼──┐
│  ~/.local/share/super-productivity-mcp/    │  │  Bind-Mount
│                                             │  │  (exakt gleicher Pfad)
│  ┌──────────────────────────────────────┐  │  │
│  │ sbx-microVM                           │  │  │
│  │  Claude Code                          │  │  │
│  │   └─ startet per .mcp.json:           │  │  │
│  │      python3 -m superproductivity_mcp │◄─┼──┘
│  │      (liest/schreibt dasselbe Verz.)  │  │
│  └──────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

Super Productivity selbst bleibt zwingend **nativ auf dem Host** (Electron-App): Das Plugin, das die IPC-Dateien schreibt, braucht die Berechtigung `nodeExecution`, die laut offizieller Super-Productivity-Doku ausschließlich in der Electron-Desktop-App verfügbar ist — nicht in der Web-Version, nicht containerisiert. Nur der MCP-Server (die Gegenstelle) wandert in dieser Anleitung in die Sandbox.

---

## Voraussetzungen

- **Linux, offiziell Ubuntu 24.04+** (andere Debian-Derivate funktionieren mit dem apt-Repo oft auch, sind aber nicht offiziell getestet)
- **KVM-Hardwarevirtualisierung** aktiv:
  ```bash
  lsmod | grep kvm
  ```
  Muss `kvm_intel`, `kvm_amd` oder `kvm` zeigen. Läuft dein Host selbst schon in einer VM, muss diese verschachtelte Virtualisierung ("nested virtualization") unterstützen.
- Docker Hub / Docker-ID-Account (für `sbx login`)
- Anthropic-API-Key **oder** ein Claude-Abo (Pro/Max) für die Anmeldung von Claude Code
- Super Productivity **14.0.0 oder höher**, Electron-Desktop-Version (nicht Web/Browser)
  Downloads für Linux: [2.01 Downloads and Install](https://github.com/super-productivity/super-productivity/wiki/2.01-Downloads-and-Install)

Offizielle Voraussetzungen zu `sbx`: [Install Docker Sandboxes](https://docs.docker.com/ai/sandboxes/install.md)

---

## Schritt 1: `sbx` installieren

Falls noch kein Docker Engine auf dem Host läuft, installiert dieser eine Befehl **Docker Engine + `sbx` in einem Rutsch**:

```bash
curl -fsSL https://get.docker.com | sudo SBX=1 sh
sudo usermod -aG kvm $USER
newgrp kvm
```

Ist Docker Engine bereits vorhanden und du willst wirklich nur `sbx` dazu:

```bash
curl -fsSL https://get.docker.com | sudo REPO_ONLY=1 sh
sudo apt-get install docker-sbx
sudo usermod -aG kvm $USER
newgrp kvm
```

Anmelden:

```bash
sbx login
```
Öffnet einen Docker-OAuth-Flow im Browser.

Referenz: [Install Docker Sandboxes](https://docs.docker.com/ai/sandboxes/install.md)

---

## Schritt 2: Super-Productivity-Plugin installieren (Host)

Das Plugin ist die Gegenstelle in Super Productivity, die die IPC-Dateien unter `~/.local/share/super-productivity-mcp/` schreibt und liest.

1. **Backup nicht vergessen**, bevor du das Plugin installierst: [2.02 Restore Data From Backup](https://github.com/super-productivity/super-productivity/wiki/2.02-Restore-Data-From-Backup)

2. Plugin-ZIP von der aktuellen Release-Seite herunterladen:
   **https://github.com/ben-elliot-nice/superproductivity-mcp/releases/latest**
   (Datei heißt `superproductivity-mcp-plugin-v<version>.zip`)

3. In Super Productivity: **Settings → Plugins → Upload Plugin** → die ZIP-Datei auswählen.
   Offizielle Doku zur Plugin-Verwaltung: [2.21 Manage Plugins](https://github.com/super-productivity/super-productivity/wiki/2.21-Manage-Plugins)

4. Plugin über den Toggle **aktivieren**. Electron zeigt einen nativen **Allow/Deny-Dialog** für die Berechtigung **`nodeExecution`** — hier **Allow** wählen. Ohne diese Berechtigung startet das Plugin nicht.

5. Im Plugin-Dashboard (in Super Productivity über das Menü erreichbar) findest du die genaue Versionsnummer des Plugins — nützlich für Schritt 3, falls du die MCP-Server-Version exakt pinnen willst.

Projektquelle / technische Details zum Server: [github.com/ben-elliot-nice/superproductivity-mcp](https://github.com/ben-elliot-nice/superproductivity-mcp) · [PyPI-Paketseite](https://pypi.org/project/superproductivity-mcp/)

---

## Schritt 3: Kit-Verzeichnis anlegen

Das Kit installiert die Python-Abhängigkeit für den MCP-Server direkt ins Sandbox-Image, sobald die Sandbox erstellt wird.

```bash
mkdir -p ~/kits/super-productivity-mcp
cd ~/kits/super-productivity-mcp
```

`spec.yaml`:

```yaml
schemaVersion: "1"
kind: mixin
name: super-productivity-mcp
displayName: Super Productivity MCP
description: Installiert die Python-Abhängigkeit für den Super-Productivity-MCP-Server in der Sandbox

commands:
  install:
    - command: "pip install --user --break-system-packages superproductivity-mcp"
      user: "1000"
      description: "superproductivity-mcp installieren"
```

`user: "1000"` installiert als der normale, nicht-root `agent`-Benutzer, mit dem die Sandbox-Templates standardmäßig laufen (nicht als root).

Optional mit Versionspinning (damit sie zur Plugin-Version aus Schritt 2 passt):

```yaml
commands:
  install:
    - command: "pip install --user --break-system-packages superproductivity-mcp==2.2.1"
      user: "1000"
```

Referenz: [Kit spec reference](https://docs.docker.com/ai/sandboxes/customize/kit-reference.md), [Kit examples](https://docs.docker.com/ai/sandboxes/customize/kit-examples.md)

---

## Schritt 4: `.mcp.json` im Projekt anlegen

Im Arbeitsverzeichnis, das du als Sandbox-Workspace nutzt (z. B. `~/mein-projekt`):

```bash
cat > ~/mein-projekt/.mcp.json << 'EOF'
{
  "mcpServers": {
    "super-productivity": {
      "command": "python3",
      "args": ["-m", "superproductivity_mcp"],
      "env": {
        "HOME": "__HOST_HOME__"
      }
    }
  }
}
EOF
```

Ersetze `__HOST_HOME__` durch deinen tatsächlichen Host-Home-Pfad, z. B. `/home/max`:

```bash
sed -i "s|__HOST_HOME__|$HOME|" ~/mein-projekt/.mcp.json
```

**Warum das `HOME`-Override nötig ist:** Der Server ermittelt sein Datenverzeichnis vermutlich über `Path.home()`. Die Sandbox-Templates laufen intern als `agent`-User mit eigenem `$HOME` (z. B. `/home/agent`) — das entspricht *nicht* deinem Host-Benutzer-Pfad. Der zusätzliche Workspace-Mount aus Schritt 5 landet aber an deinem **Host**-Pfad. Das explizite `HOME` im `.mcp.json`-`env`-Block sorgt dafür, dass nur dieser eine Subprozess in `$HOME/.local/share/super-productivity-mcp` schaut — exakt dort, wo der Mount liegt.

Referenz zu projekt-gescopten Servern: [Claude Code – MCP](https://docs.claude.com/en/docs/claude-code/mcp)

---

## Schritt 5: Sandbox mit Kit + zusätzlichem Mount starten

```bash
cd ~/mein-projekt
sbx run claude --name sp-in-sandbox \
  --kit ~/kits/super-productivity-mcp \
  ~/mein-projekt "$HOME/.local/share/super-productivity-mcp"
```

- Erstes Pfad-Argument (`~/mein-projekt`) = Haupt-Workspace
- Zweites Pfad-Argument = zusätzlicher gemounteter Host-Pfad — er wird **am exakt gleichen absoluten Pfad** in der VM eingehängt
- `--kit` installiert beim (ersten) Erstellen die Python-Abhängigkeit ins Sandbox-Image

Beim ersten Start fragt `sbx` nach Anthropic-Zugangsdaten:
- **API-Key**: `sbx secret set -g anthropic` (einmalig, verschlüsselt im Host-Credential-Store gespeichert)
- **Claude-Abo**: interaktiver OAuth-Flow, `sbx`s Proxy übernimmt das — kein Token landet in der Sandbox selbst

Bei einem projekt-gescopten `.mcp.json` fragt Claude Code interaktiv um Bestätigung ("Trust this workspace / approve this MCP server"), bevor der Server geladen wird — einmalig pro Sandbox bestätigen.

Referenz: [Claude Code – Docker Sandboxes](https://docs.docker.com/ai/sandboxes/agents/claude-code.md)

---

## Schritt 6: Testen

In der laufenden Session prüfen, ob der Server verbunden ist:

```
/mcp
```

sollte `super-productivity` als verbunden zeigen. Zusätzlich gibt es ein Diagnose-Tool im Server selbst, das die tatsächlich verwendeten Pfade anzeigt — hilfreich, um zu bestätigen, dass `HOME` korrekt gegriffen hat:

```
Nutze debug_directories, um die MCP-Datenverzeichnisse anzuzeigen
```

Danach normale Testaufrufe:

```
Zeig mir alle offenen Aufgaben in Super Productivity
Erstelle eine Aufgabe "Quartalsbudget prüfen" mit Tag #finance
```

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| `sbx` startet nicht / KVM-Fehler | `lsmod \| grep kvm` prüfen, `kvm-ok` für Diagnose, Nested Virtualization aktivieren falls in VM |
| Plugin lädt nicht | Super-Productivity-Version ≥ 14.0.0 prüfen; Plugin-Berechtigung `nodeExecution` im Plugin-Panel kontrollieren |
| `/mcp` zeigt Server nicht / Fehler beim Start | Prüfen, ob `pip install` beim Kit-Install erfolgreich lief: `sbx exec sp-in-sandbox -- pip show superproductivity-mcp` |
| Keine Daten von Super Productivity | `debug_directories`-Tool nutzen, Pfad mit `ls "$HOME/.local/share/super-productivity-mcp"` auf dem Host vergleichen; Super Productivity muss während der Session laufen |
| Zweiter Mount-Pfad wird nicht übernommen | Sicherstellen, dass der Pfad wirklich existiert, bevor die Sandbox erstellt wird (Super Productivity muss vorher schon einmal gelaufen sein und das Verzeichnis angelegt haben) |
| `.mcp.json` wird nicht geladen | Trust-Dialog beim ersten Start in der Sandbox-Session bestätigen |

---

## Alle Referenzen im Überblick

- Docker Sandboxes – Installation: https://docs.docker.com/ai/sandboxes/install.md
- Docker Sandboxes – Übersicht: https://docs.docker.com/ai/sandboxes.md
- Docker Sandboxes – Claude Code Integration: https://docs.docker.com/ai/sandboxes/agents/claude-code.md
- Kit-Konzept & Beispiele: https://docs.docker.com/ai/sandboxes/customize/kit-examples.md
- Kit-Spec-Referenz: https://docs.docker.com/ai/sandboxes/customize/kit-reference.md
- Claude Code – MCP-Konfiguration: https://docs.claude.com/en/docs/claude-code/mcp
- superproductivity-mcp – GitHub/Releases: https://github.com/ben-elliot-nice/superproductivity-mcp
- superproductivity-mcp – PyPI: https://pypi.org/project/superproductivity-mcp/
- Super Productivity – Downloads & Install (Linux): https://github.com/super-productivity/super-productivity/wiki/2.01-Downloads-and-Install
- Super Productivity – Plugins verwalten: https://github.com/super-productivity/super-productivity/wiki/2.21-Manage-Plugins
- Super Productivity – Backup/Restore: https://github.com/super-productivity/super-productivity/wiki/2.02-Restore-Data-From-Backup
