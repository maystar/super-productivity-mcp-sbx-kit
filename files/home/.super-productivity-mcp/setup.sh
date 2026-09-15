#!/bin/sh
# Registers (or re-registers) the super-productivity MCP server against the
# published container image and keeps that image up to date.
#
# Called from spec.yaml with a phase tag ("install" or "startup") so the
# shared log file shows which phase produced each block. Behavior is
# otherwise identical in both phases: the agent process either waits for the
# whole call to finish (setup.install, at sandbox creation) or doesn't wait
# at all (setup.startup, on every later start) — the ordering of register vs.
# pull inside this script doesn't change that, so one script suffices for
# both.
set -u

TAG="${1:-setup}"
exec >>"$HOME/.cache/super-productivity-mcp-setup.log" 2>&1
mkdir -p "$HOME/.cache"
printf '=== %s %s ===\n' "$TAG" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

export PATH="$HOME/.local/bin:$HOME/.claude/local:$PATH"
IMAGE="ghcr.io/maystar/super-productivity-rest-mcp:latest"

claude mcp remove super-productivity --scope user >/dev/null 2>&1 || true
claude mcp add super-productivity --scope user -- \
  docker run -i --rm \
    -e SP_REST_TOKEN -e SP_REST_BASE_URL \
    -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY \
    -e http_proxy -e https_proxy -e no_proxy \
    -e NODE_USE_ENV_PROXY \
    "$IMAGE" \
  || echo "ERROR: claude mcp add ($TAG) failed"

docker pull "$IMAGE" || echo "WARNING: docker pull ($TAG) failed, docker run will pull on demand"
