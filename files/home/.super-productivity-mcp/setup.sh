#!/bin/sh
# Registers the super-productivity MCP server via Claude Code's managed-mcp.json
# mechanism (system-wide, outside any project directory — see
# https://code.claude.com/docs/en/managed-mcp) and keeps the published image
# up to date.
#
# Called from spec.yaml with a phase tag ("install" or "startup") so the
# shared log file shows which phase produced each block. Runs as root (user
# "0" in spec.yaml) because /etc/claude-code/ requires root to write.
#
# Why this replaces the earlier `claude mcp add`/`remove` approach: that
# mutated ~/.claude.json at runtime, which raced with the interactive agent
# process's own writes to the same file (see TODO.md steps 10 and 13 for the
# full history — a `claude mcp remove` followed by `claude mcp add` left a
# brief window with no super-productivity entry, and if the agent's first
# read landed in that window, its later housekeeping save silently wiped the
# registration). managed-mcp.json has no such race: Claude Code only *reads*
# it, it never rewrites it, so a plain, idempotent file write is safe to
# repeat on every start.
#
# Trade-off, by design of managed-mcp.json (not something this script can
# avoid): while this file exists, Claude Code takes *exclusive* control of
# MCP for every session on this machine — nobody can `claude mcp add` other
# ad-hoc servers anymore, they'd all have to go in this same file.
# managed-settings.json's `allowAllClaudeAiMcps` keeps claude.ai connectors
# (e.g. the Trello connector seen in this environment) loading alongside it;
# built-in/CLI-configured servers (e.g. this sandbox's mcp-gateway) aren't
# subject to managed-mcp.json's exclusivity at all. Unverified as of
# 2026-09-16 — check TODO.md for the current verification status before
# assuming this is settled.
set -u

TAG="${1:-setup}"
LOG="/home/agent/.cache/super-productivity-mcp-setup.log"
mkdir -p "/home/agent/.cache"
exec >>"$LOG" 2>&1
printf '=== %s %s ===\n' "$TAG" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

IMAGE="ghcr.io/maystar/super-productivity-rest-mcp:latest"

mkdir -p /etc/claude-code

cat > /etc/claude-code/managed-mcp.json <<EOF
{
  "mcpServers": {
    "super-productivity": {
      "type": "stdio",
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "SP_REST_TOKEN", "-e", "SP_REST_BASE_URL", "-e", "HTTP_PROXY", "-e", "HTTPS_PROXY", "-e", "NO_PROXY", "-e", "http_proxy", "-e", "https_proxy", "-e", "no_proxy", "-e", "NODE_USE_ENV_PROXY", "$IMAGE"]
    }
  }
}
EOF

cat > /etc/claude-code/managed-settings.json <<'EOF'
{
  "allowAllClaudeAiMcps": true
}
EOF

docker pull "$IMAGE" || echo "WARNING: docker pull ($TAG) failed, docker run will pull on demand"
