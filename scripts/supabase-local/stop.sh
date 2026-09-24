#!/usr/bin/env bash
# Derruba o "Supabase local" sem Docker iniciado por start.sh.
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="${LOCAL_STACK_DIR:-$RAIZ/.local-stack}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"

for servico in gateway postgrest auth; do
  if [[ -f "$STACK/$servico.pid" ]]; then
    kill "$(cat "$STACK/$servico.pid")" 2>/dev/null || true
    rm -f "$STACK/$servico.pid"
  fi
done

if [[ -d "$STACK/pgdata" ]]; then
  if [[ "$(id -u)" == "0" ]]; then
    runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$STACK/pgdata" -m fast stop >/dev/null 2>&1 || true
  else
    "$PG_BIN/pg_ctl" -D "$STACK/pgdata" -m fast stop >/dev/null 2>&1 || true
  fi
fi
echo "[supabase-local] parado."
