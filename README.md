# Super Productivity ↔ Claude Code via Local REST API (sbx sandbox)

Gives a Claude Code sandbox (`sbx`) access to a Super Productivity desktop app running on the
host, via its official
[Local REST API](https://github.com/super-productivity/super-productivity/wiki/3.01-API#3-local-rest-api).

## What this enables

With the kit defined by [spec.yaml](./spec.yaml), a sandbox can:

- reach `http://host.docker.internal:3876` (the Super Productivity Local REST API on the host,
  listening on `127.0.0.1:3876`)
- use the MCP server from the published image
  [`ghcr.io/maystar/super-productivity-rest-mcp`](https://github.com/maystar/super-productivity-rest-mcp)
  as Claude Code tools (tasks CRUD + start/archive/restore, task control, status, focus mode,
  projects, tags)

## Host prerequisites

- `sbx` installed, `sbx login` done
- Super Productivity >= 14.0.0 (Electron desktop app) installed
- Local REST API enabled: Settings → Misc → **Enable local REST API** (note the access token
  shown there)

## Starting a sandbox with this kit

```bash
bash -c '
  read -rp "Sandbox name [sp-rest-mcp]: " SBX_NAME
  SBX_NAME="${SBX_NAME:-sp-rest-mcp}"
  read -rp "Working directory: " WORKDIR
  read -rsp "Super Productivity access token: " SP_TOKEN
  echo

  sbx secret set-custom --sandbox "$SBX_NAME" --host localhost --env SP_REST_TOKEN --value "$SP_TOKEN"

  sbx run claude --name "$SBX_NAME" \
    --kit "git+https://github.com/maystar/super-productivity-mcp-sbx-kit.git" \
    "$WORKDIR"
'
```

The sandbox only ever sees a placeholder for `SP_REST_TOKEN`; the sbx proxy substitutes the real
token when a request actually reaches the host, so the token is never stored in plaintext in this
repo or the sandbox filesystem.

