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

Store the access token once as a global service secret (interactive prompt, so the token stays
out of shell history):

```bash
sbx secret set super-productivity
```

Then start a sandbox with the kit:

```bash
sbx run claude --name sp-rest-mcp \
  --kit "git+https://github.com/maystar/super-productivity-mcp-sbx-kit.git" \
  <working-directory>
```

On the first run, sbx asks once whether the `super-productivity` secret may be sent to the
domains the kit declares (`host.docker.internal`, `localhost`). The approval, not the token, is
stored in `~/.config/sbx/credentials.yaml`.

The sandbox only ever sees the placeholder `proxy-managed` in `SP_REST_TOKEN`; the sbx proxy
replaces the `Authorization: Bearer` header with the real token when a request reaches the host,
so the token is never stored in plaintext in this repo or the sandbox filesystem. Because the
secret is global, it survives `sbx rm` and is reused by every new sandbox with this kit. To
replace it (e.g. after regenerating the token in Super Productivity), run
`sbx secret set super-productivity` again.

### Migrating from the custom secret

Earlier versions of this README used a sandbox-scoped custom secret
(`sbx secret set-custom --sandbox <name> --host localhost --env SP_REST_TOKEN`). It is removed
together with its sandbox by `sbx rm`, so recreate existing sandboxes after storing the service
secret. If you set such a custom secret globally (without `--sandbox`), check with
`sbx secret ls -g` and remove it, otherwise it can collide with the service secret on
`SP_REST_TOKEN`.

