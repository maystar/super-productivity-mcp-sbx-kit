#!/usr/bin/env python3
"""Registriert den super-productivity-MCP-Server user-scoped in ~/.claude.json.

Wird vom Kit-Install-Schritt genau einmal pro Sandbox-Erstellung aufgerufen, nachdem der
Host-HOME-Pfad aus dem gemounteten IPC-Verzeichnis abgeleitet wurde (siehe spec.yaml).

Wichtig: `Path.home()` bezieht sich hier bewusst auf das HOME des Sandbox-Users (agent,
i.d.R. /home/agent) — dort liegt Claude Codes eigene User-Config (~/.claude.json), unabhängig
davon, welches Projekt gerade als Workdir gemountet ist. Der übergebene host_home-Wert ist ein
ganz anderer Pfad (der HOST-Home, z.B. /home/fabian) und wird nur als env.HOME-Wert INNERHALB
des zu registrierenden MCP-Server-Eintrags verwendet, damit der Server-Subprozess später das
richtige IPC-Verzeichnis auf dem Host findet.

Bestehende ~/.claude.json wird nur um/in den Schlüssel mcpServers.super-productivity ergänzt,
alle anderen Inhalte (Auth, Projekt-Liste, sonstige Server, ...) bleiben unangetastet. Erneutes
Ausführen ist sicher (idempotent) und aktualisiert nur diesen einen Eintrag.
"""
import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1]:
        print("write_user_mcp_config: erwarte Host-HOME-Pfad als Argument, keiner übergeben — Abbruch.", file=sys.stderr)
        return 1
    host_home = sys.argv[1]

    config_path = Path.home() / ".claude.json"
    data = {}
    if config_path.exists():
        try:
            data = json.loads(config_path.read_text())
        except json.JSONDecodeError as exc:
            print(f"write_user_mcp_config: {config_path} enthält kein gültiges JSON ({exc}) — "
                  "breche ab, um Bestandsdaten nicht zu zerstören.", file=sys.stderr)
            return 1

    data.setdefault("mcpServers", {})
    data["mcpServers"]["super-productivity"] = {
        "command": "python3",
        "args": ["-m", "superproductivity_mcp"],
        "env": {"HOME": host_home},
    }

    config_path.write_text(json.dumps(data, indent=2) + "\n")
    print(f"write_user_mcp_config: super-productivity MCP-Server (scope: user) in {config_path} "
          f"registriert, env.HOME={host_home}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
