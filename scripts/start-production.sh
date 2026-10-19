#!/bin/sh
set -e

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

cd "$ROOT/apps/api"

# Direct repair: ensure missing columns exist before Prisma migration tracking runs.
# This is belt-and-suspenders — if prisma migrate deploy has a stuck/failed migration
# that blocks the chain, this guarantees the columns exist regardless.
cat > /tmp/omnedu_repair.sql << 'EOSQL'
ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT;
EOSQL
node_modules/.bin/prisma db execute --file /tmp/omnedu_repair.sql || \
  echo '[repair] prisma db execute failed — will rely on migration chain'
rm -f /tmp/omnedu_repair.sql

(node_modules/.bin/prisma migrate deploy || {
  node_modules/.bin/prisma migrate resolve --rolled-back 20261008160000_conversation_delete || true
  node_modules/.bin/prisma migrate resolve --rolled-back 20261008170000_owner_role || true
  node_modules/.bin/prisma migrate resolve --rolled-back 20261019120000_add_parent_notes || true
  node_modules/.bin/prisma migrate deploy || echo 'migration failed, starting api anyway'
})
cd "$ROOT"

if [ ! -d "$ROOT/apps/web/.next" ]; then
  echo 'web build missing, starting the API only'
  printf 'web-missing\n' > "$ROOT/apps/api/web-build-status.txt"
else
  echo 'web build found, the API will open the school site'
fi

export API_PORT="${PORT:-${API_PORT:-3001}}"
exec node "$ROOT/apps/api/dist/main"
