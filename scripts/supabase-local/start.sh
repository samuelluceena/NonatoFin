#!/usr/bin/env bash
# =============================================================================
# Sobe um "Supabase local" SEM Docker (Linux), apenas para testes:
#   Postgres (porta 54322) + GoTrue/Auth (9999) + PostgREST (3001)
#   + gateway compatível com o Supabase (54321)
#
# Portas e chaves são as mesmas do `npx supabase start`, então os testes
# funcionam igual nas duas opções. Se você tem Docker, prefira `npx supabase start`.
#
# Requisitos: Linux x86-64, PostgreSQL 15+ instalado (initdb/pg_ctl), Node 20+, curl.
# Uso:
#   bash scripts/supabase-local/start.sh          # sobe (reaproveita dados)
#   bash scripts/supabase-local/start.sh --reset  # apaga o banco e recria
#   bash scripts/supabase-local/stop.sh           # derruba tudo
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
STACK="${LOCAL_STACK_DIR:-$RAIZ/.local-stack}"
AUTH_VERSION="${AUTH_VERSION:-v2.197.0}"
POSTGREST_VERSION="${POSTGREST_VERSION:-v13.0.8}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
JWT_SECRET="super-secret-jwt-token-with-at-least-32-characters-long"
PG_PORT=54322
DB_URL="postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres"

log() { echo "[supabase-local] $*"; }

if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "PostgreSQL não encontrado. Instale (ex.: apt install postgresql) ou defina PG_BIN." >&2
  exit 1
fi

mkdir -p "$STACK/bin" "$STACK/logs"

# ---------------------------------------------------------------- binários ---
if [[ ! -x "$STACK/bin/auth" ]]; then
  log "baixando GoTrue ${AUTH_VERSION}..."
  curl -fsSL "https://github.com/supabase/auth/releases/download/${AUTH_VERSION}/auth-${AUTH_VERSION}-x86.tar.gz" \
    | tar xz -C "$STACK/bin"
fi
if [[ ! -x "$STACK/bin/postgrest" ]]; then
  log "baixando PostgREST ${POSTGREST_VERSION}..."
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-linux-static-x86-64.tar.xz" \
    | tar xJ -C "$STACK/bin"
fi

# Postgres recusa rodar como root: usa o usuário "postgres" nesse caso.
como_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

# ---------------------------------------------------------------- postgres ---
if [[ "${1:-}" == "--reset" ]]; then
  bash "$RAIZ/scripts/supabase-local/stop.sh" >/dev/null 2>&1 || true
  rm -rf "$STACK/pgdata"
fi

if [[ ! -d "$STACK/pgdata" ]]; then
  log "criando cluster Postgres..."
  mkdir -p "$STACK/pgdata"
  [[ "$(id -u)" == "0" ]] && chown -R postgres "$STACK/pgdata" "$STACK/logs"
  como_pg "$PG_BIN/initdb" -D "$STACK/pgdata" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
fi
[[ "$(id -u)" == "0" ]] && chown -R postgres "$STACK/logs"

if ! "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1; then
  log "iniciando Postgres na porta ${PG_PORT}..."
  como_pg "$PG_BIN/pg_ctl" -D "$STACK/pgdata" -l "$STACK/logs/postgres.log" \
    -o "-p ${PG_PORT} -c listen_addresses=127.0.0.1 -c timezone=UTC" -w start >/dev/null
fi

psql_q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -q "$@"; }
psql_q -f "$RAIZ/scripts/supabase-local/bootstrap.sql"

# ------------------------------------------------------------------ GoTrue ---
parar_pid() { [[ -f "$STACK/$1.pid" ]] && kill "$(cat "$STACK/$1.pid")" 2>/dev/null || true; rm -f "$STACK/$1.pid"; }
parar_pid auth
parar_pid postgrest
parar_pid gateway

log "iniciando GoTrue..."
(
  cd "$STACK/bin"
  env \
    GOTRUE_DB_DRIVER=postgres \
    DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:${PG_PORT}/postgres?search_path=auth" \
    GOTRUE_DB_MIGRATIONS_PATH="$STACK/bin/migrations" \
    GOTRUE_API_HOST=127.0.0.1 PORT=9999 \
    API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1" \
    GOTRUE_SITE_URL="http://localhost:3000" \
    GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
    GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
    GOTRUE_DISABLE_SIGNUP=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true \
    GOTRUE_EXTERNAL_PHONE_ENABLED=false GOTRUE_PASSWORD_MIN_LENGTH=10 \
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH=100000 GOTRUE_RATE_LIMIT_VERIFY=100000 \
    GOTRUE_RATE_LIMIT_OTP=100000 GOTRUE_RATE_LIMIT_EMAIL_SENT=100000 \
    GOTRUE_LOG_LEVEL=warn \
    nohup ./auth >"$STACK/logs/auth.log" 2>&1 &
  echo $! >"$STACK/auth.pid"
)

for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:9999/health >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS http://127.0.0.1:9999/health >/dev/null || { echo "GoTrue não subiu. Veja $STACK/logs/auth.log" >&2; exit 1; }

# -------------------------------------------------------------- migrations ---
log "aplicando migrations do projeto..."
psql_q -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, aplicada_em timestamptz default now());"
for arquivo in "$RAIZ"/supabase/migrations/*.sql; do
  versao="$(basename "$arquivo" | cut -d_ -f1)"
  ja="$(psql "$DB_URL" -tAc "select 1 from supabase_migrations.schema_migrations where version = '$versao'")"
  if [[ -z "$ja" ]]; then
    log "  -> $(basename "$arquivo")"
    psql_q -1 -f "$arquivo"
    psql_q -c "insert into supabase_migrations.schema_migrations (version) values ('$versao')"
  fi
done

# --------------------------------------------------------------- PostgREST ---
cat >"$STACK/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:postgres@127.0.0.1:${PG_PORT}/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "${JWT_SECRET}"
server-host = "127.0.0.1"
server-port = 3001
db-channel-enabled = true
log-level = "warn"
CONF

log "iniciando PostgREST..."
nohup "$STACK/bin/postgrest" "$STACK/postgrest.conf" >"$STACK/logs/postgrest.log" 2>&1 &
echo $! >"$STACK/postgrest.pid"

log "iniciando gateway..."
nohup node "$RAIZ/scripts/supabase-local/gateway.mjs" >"$STACK/logs/gateway.log" 2>&1 &
echo $! >"$STACK/gateway.pid"

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null http://127.0.0.1:54321/rest/v1/ 2>/dev/null && break
  sleep 0.5
done
curl -fsS -o /dev/null http://127.0.0.1:54321/rest/v1/ || { echo "PostgREST/gateway não subiu. Veja $STACK/logs" >&2; exit 1; }

log "pronto!"
log "  API:  http://127.0.0.1:54321"
log "  DB:   ${DB_URL}"
