#!/usr/bin/env bash
# =====================================================================
# START THE CLUSTER THE IMAGE ALREADY BUILT, AND PROVE IT ANSWERS.
#
# Installed as `/usr/local/bin/reconcile-pg-start`. The gate's `pre_build` calls
# this and nothing else; `npm run check` stays the only thing in `build`.
#
# 🛑 IT EXITS NON-ZERO WHEN THE SERVER IS NOT REACHABLE OVER TCP AS THE IDENTITY
# THE SUITE WILL USE. That is the whole point of the file. `systemctl is-active`
# and a zero exit from `pg_ctl` both prove a process exists;
# `docs/runner-image-provisioning.md` §6 lists each of them, by name, as
# something that "does not count as evidence". The check here is a real
# connection over 127.0.0.1 with no password — the same path `db/env.ts`'s
# `probeDatabase()` takes — because that, and only that, is what the gate needs.
#
# It creates no database and no role. `db/provision.ts` does: `provision()`
# calls `createRoles()`, `createDatabase()` and `giveSchemaToOwner()`, and
# `resetSchema()` calls `provision()` before rebuilding from `db/migrations/`.
# The suite stands up everything it depends on, across all ten test databases.
# What the machine owes it is a running server and one identity that may do that
# work — G100's three roles are the suite's to create, not the image's.
# =====================================================================
set -euo pipefail

PGDATA="${PGDATA:-/var/lib/pgsql/17/data}"
PGBIN="${PGBIN:-/usr/bin}"
PGHOST_TCP='127.0.0.1'
PGPORT_TCP="${RECONCILE_DB_PORT:-5432}"
PGUSER_ADMIN="${RECONCILE_DB_ADMIN:-postgres}"
LOGFILE='/var/log/postgresql/server.log'
DEADLINE_SECONDS=60

say() { printf '  %s\n' "$*"; }

if [ ! -s "${PGDATA}/PG_VERSION" ]; then
  cat >&2 <<EOF
🛑 NO CLUSTER AT ${PGDATA}.

   This image initdb's the cluster at build time (infra/ci-image/Dockerfile
   step 4), so an empty PGDATA means the directory was mounted over, or PGDATA
   points somewhere this image did not build.

   This script will NOT initdb one for you. A cluster created here would have
   neither the loopback \`trust\` lines nor the build-time connection proof, and
   it would fail later, further from the cause.
EOF
  exit 1
fi

if "${PGBIN}/pg_isready" -h "${PGHOST_TCP}" -p "${PGPORT_TCP}" -q; then
  say "PostgreSQL already answering on ${PGHOST_TCP}:${PGPORT_TCP}"
else
  say "starting PostgreSQL from ${PGDATA}"
  runuser -u postgres -- "${PGBIN}/pg_ctl" \
    --pgdata="${PGDATA}" \
    --log="${LOGFILE}" \
    --options="-c listen_addresses=${PGHOST_TCP} -c port=${PGPORT_TCP}" \
    --wait --timeout="${DEADLINE_SECONDS}" start \
    || { echo "🛑 pg_ctl start failed. Server log:" >&2; tail -n 50 "${LOGFILE}" >&2 || true; exit 1; }
fi

# THE EVIDENCE. A TCP connection, as the admin identity `db/env.ts` resolves,
# with NO password — exactly what `db/provision.ts`'s `adminClient()` does.
if ! "${PGBIN}/psql" -h "${PGHOST_TCP}" -p "${PGPORT_TCP}" -U "${PGUSER_ADMIN}" \
       -d postgres -v ON_ERROR_STOP=1 -tAc 'SELECT 1' >/dev/null; then
  cat >&2 <<EOF
🛑 THE SERVER IS UP AND THE GATE STILL CANNOT USE IT.

   A TCP connection to ${PGHOST_TCP}:${PGPORT_TCP} as "${PGUSER_ADMIN}" with no
   password failed. That is the connection every database-dependent suite makes;
   a running process that refuses it is worth exactly nothing to this gate, and
   under CI \`databaseRequiredUnderCi()\` will now fail the run rather than let
   ten suites stand down quietly.

   Look at pg_hba.conf first — \`docs/runner-image-provisioning.md\` §3 names it
   as the step most likely to have silently done nothing.
EOF
  tail -n 50 "${LOGFILE}" >&2 || true
  exit 1
fi

say "$("${PGBIN}/psql" -h "${PGHOST_TCP}" -p "${PGPORT_TCP}" -U "${PGUSER_ADMIN}" -d postgres -tAc 'SELECT version()')"
say "reachable as ${PGUSER_ADMIN}@${PGHOST_TCP}:${PGPORT_TCP}, no password — the gate can provision."
