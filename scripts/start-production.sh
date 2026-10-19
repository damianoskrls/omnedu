#!/bin/sh
set -e

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

cd "$ROOT/apps/api"

# Direct repair: add missing DB columns using @prisma/client before migrations run.
# Uses the same client/DATABASE_URL the app itself uses — more reliable than prisma db execute.
node << 'NODEREPAIR' || echo '[repair] node repair script failed'
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    await p.$executeRawUnsafe('ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT');
    console.log('[repair] school_members.notes column ensured');
  } catch(e) {
    console.error('[repair] failed:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
NODEREPAIR

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
