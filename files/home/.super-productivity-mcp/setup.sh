#!/bin/sh
# Registers the super-productivity MCP server against the published container
# image (if not already registered) and keeps that image up to date.
#
# Called from spec.yaml with a phase tag ("install" or "startup") so the
# shared log file shows which phase produced each block.
#
# IMPORTANT: only call `claude mcp add` when the server isn't registered yet.
# An earlier version unconditionally did `claude mcp remove` followed by
# `claude mcp add` on every run, to make re-registration idempotent. That
# leaves a brief window where ~/.claude.json has no super-productivity entry
# between the remove and the add. Observed in practice: if the interactive
# agent session happens to load ~/.claude.json into memory during exactly
# that window, it later flushes its own (stale, entry-less) in-memory config
# back to disk — e.g. on its first housekeeping write (numStartups, onboarding
# state, ...) — silently wiping the registration a `claude mcp list` right
# after setup ran had shown as present. `claude mcp add` refuses to touch an
# existing entry ("already exists"), so skipping the call entirely when one
# is already there avoids the remove/add gap altogether for every start after
# the first. The very first ever call (setup.install, which blocks the agent
# from starting at all) still does a single plain `add` with no preceding
# remove, so there's no gap there either.
#
# Don't switch this to /etc/claude-code/managed-mcp.json without re-reading TODO.md step 14
# first: that mechanism was tried and reverted because it takes *exclusive* control of MCP for
# the whole machine, which silently broke this sandbox's own `mcp-gateway` server (registered the
# same plain user-scope way as this one, not exempt from that exclusivity).
set -u

TAG="${1:-setup}"
exec >>"$HOME/.cache/super-productivity-mcp-setup.log" 2>&1
mkdir -p "$HOME/.cache"
printf '=== %s %s ===\n' "$TAG" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

export PATH="$HOME/.local/bin:$HOME/.claude/local:$PATH"
IMAGE="ghcr.io/maystar/super-productivity-rest-mcp:latest"

if claude mcp get super-productivity >/dev/null 2>&1; then
  echo "super-productivity already registered, leaving it as-is"
else
  claude mcp add super-productivity --scope user -- \
    docker run -i --rm \
      -e SP_REST_TOKEN -e SP_REST_BASE_URL \
      -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY \
      -e http_proxy -e https_proxy -e no_proxy \
      -e NODE_USE_ENV_PROXY \
      "$IMAGE" \
    || echo "ERROR: claude mcp add ($TAG) failed"
fi

docker pull "$IMAGE" || echo "WARNING: docker pull ($TAG) failed, docker run will pull on demand"
