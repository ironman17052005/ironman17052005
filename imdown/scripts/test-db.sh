#!/usr/bin/env bash
# Runs schema.sql against a real Postgres and checks the rules actually hold.
#
# The rules that matter live in the database, not the app, so testing them in
# JavaScript would prove nothing. This spins up a throwaway cluster, applies the
# real schema, and exercises each rule as a different signed-in user.
#
#   ./scripts/test-db.sh
#
# Needs postgres 14+ on PATH (Ubuntu: apt-get install postgresql).
# Set PGBIN if initdb and pg_ctl are not on PATH, e.g. /usr/lib/postgresql/16/bin.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-}"
if [ -z "$PGBIN" ]; then
  PGBIN="$(dirname "$(command -v initdb 2>/dev/null || command -v pg_ctl 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")"
fi
export PATH="$PGBIN:$PATH"

DATA="$(mktemp -d)/data"
SOCK="$(mktemp -d)"
PORT="${PGPORT:-5455}"
# Postgres refuses to run as root, so drop to the postgres user when we are root.
RUNAS=""
if [ "$(id -u)" = "0" ]; then
  RUNAS="postgres"
  chmod 777 "$(dirname "$DATA")" "$SOCK"
fi

run() { if [ -n "$RUNAS" ]; then su "$RUNAS" -c "PATH=$PATH $1"; else bash -c "$1"; fi; }

cleanup() {
  run "pg_ctl -D $DATA stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$DATA" "$SOCK"
}
trap cleanup EXIT

echo "starting a throwaway postgres on port $PORT"
mkdir -p "$DATA"
[ -n "$RUNAS" ] && chown -R "$RUNAS" "$DATA" "$SOCK"
run "initdb -D $DATA -A trust -U postgres" >/dev/null
run "pg_ctl -D $DATA -o '-k $SOCK -p $PORT -c listen_addresses=' -l $DATA/log start -w" >/dev/null

PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
run "$PSQL -c 'create database imdown_test'" >/dev/null

echo "applying the harness that stands in for Supabase"
run "$PSQL -d imdown_test -f $HERE/supabase/test/harness.sql" 2>&1 | grep -v 'wal_level' || true

echo "applying schema.sql"
run "$PSQL -d imdown_test -f $HERE/supabase/schema.sql" 2>&1 | grep -vi 'does not exist, skipping' || true

echo "applying seed.sql"
run "$PSQL -d imdown_test -f $HERE/supabase/seed.sql" >/dev/null

echo "checking the rules"
run "$PSQL -d imdown_test -f $HERE/supabase/test/rules.test.sql" 2>&1 \
  | sed -E 's#^psql:[^ ]+: ##; s/^NOTICE:  //'
