# syntax=docker/dockerfile:1
# Overlay content of the super-productivity-rest-mcp mixin: only the setup script the lifecycle
# hooks call. Landed under /opt so the overlay ships no /home or /home/agent directory entries;
# every path it creates is root-owned and world-readable.
FROM scratch
COPY --chmod=0755 setup.sh /opt/super-productivity-mcp/setup.sh
