# Super Productivity ↔ Claude Code via Local REST API (sbx sandbox)

Gives a Claude Code sandbox (`sbx`) access to a Super Productivity desktop app running on the
host, via its official
[Local REST API](https://github.com/super-productivity/super-productivity/wiki/3.01-API#3-local-rest-api).

## What this enables

With the kit defined by
[super-productivity-rest-mcp/super-productivity-rest-mcp.yaml](./super-productivity-rest-mcp/super-productivity-rest-mcp.yaml)
(a Kits v3 mixin), a sandbox can:

- reach `http://host.docker.internal:3876` (the Super Productivity Local REST API on the host,
  listening on `127.0.0.1:3876`)
- use the MCP server from the published image
  [`ghcr.io/maystar/super-productivity-rest-mcp`](https://github.com/maystar/super-productivity-rest-mcp)
  as Claude Code tools (tasks CRUD + start/archive/restore, task control, status, focus mode,
  projects, tags)

## Host prerequisites

- `sbx` >= v0.45 installed (Kits v3 support), `sbx login` done
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
  --kit "git+https://github.com/maystar/super-productivity-mcp-sbx-kit.git#dir=super-productivity-rest-mcp" \
  <working-directory>
```

From a local clone, `--kit ./super-productivity-rest-mcp` works the same way. To check what the
kit declares without starting a sandbox: `sbx kit inspect ./super-productivity-rest-mcp`.

On create, sbx asks for consent to run Docker inside the sandbox: the kit requests
`dockerd@1` because the MCP server runs as a container, and that capability counts as
privileged.

On the first run, sbx asks once whether the `super-productivity` secret may be sent to the
domains the kit declares (`host.docker.internal`, `localhost`). The approval, not the token, is
stored in `~/.config/sbx/credentials.yaml`.

The sandbox only ever sees the placeholder `proxy-managed` in `SP_REST_TOKEN`; the sbx proxy
replaces the `Authorization: Bearer` header with the real token when a request reaches the host,
so the token is never stored in plaintext in this repo or the sandbox filesystem. Because the
secret is global, it survives `sbx rm` and is reused by every new sandbox with this kit. To
replace it (e.g. after regenerating the token in Super Productivity), run
`sbx secret set super-productivity` again.

## Kits v3

The kit was migrated from the v2 `spec.yaml` to the v3 descriptor format
([sandbox-kit-spec](https://github.com/docker/sandbox-kit-spec)). Built-in agents such as
`sbx run claude` are v3 kits and take v3 mixins. What changed:

- **Layout:** the kit lives in `super-productivity-rest-mcp/`. sbx names a kit after its
  directory and reads `<dir>/<dir>.yaml`, so Git references need `#dir=super-productivity-rest-mcp`.
- **Content:** `setup.sh` is no longer copied from a `files/` folder. The companion
  `super-productivity-rest-mcp.dockerfile` ships it as an overlay layer to
  `/opt/super-productivity-mcp/setup.sh`, so sbx builds the kit when it creates the sandbox.
- **Network:** grants are split by phase. `ghcr.io:443` is allowed during install and at run
  time; the REST API (`host.docker.internal:3876`, `localhost:3876`) only at run time.
- **Docker:** requested explicitly via `dockerd@1` (see above).
- **Hooks:** v3 hooks only see environment variables they list. Both hooks list `DOCKER_HOST`
  and the proxy variables for the `claude` and `docker` calls in `setup.sh`.
- **Credential:** unchanged in substance (`super-productivity` service, `SP_REST_TOKEN`,
  proxy-managed Bearer header for both host names), still required.

Existing sandboxes created with the v2 kit keep running; recreate them to switch to v3.

### Migrating from the custom secret

Earlier versions of this README used a sandbox-scoped custom secret
(`sbx secret set-custom --sandbox <name> --host localhost --env SP_REST_TOKEN`). It is removed
together with its sandbox by `sbx rm`, so recreate existing sandboxes after storing the service
secret. If you set such a custom secret globally (without `--sandbox`), check with
`sbx secret ls -g` and remove it, otherwise it can collide with the service secret on
`SP_REST_TOKEN`.

