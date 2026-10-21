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
    console.error('[repair] school_members.notes failed:', e.message);
  }
  try {
    await p.$executeRawUnsafe('ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "due_date" DATE');
    console.log('[repair] class_assignments.due_date column ensured');
  } catch(e) {
    console.error('[repair] class_assignments.due_date failed:', e.message);
  }
  try {
    await p.$executeRawUnsafe('ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billing_due_day" INTEGER');
    console.log('[repair] schools.billing_due_day column ensured');
  } catch(e) {
    console.error('[repair] schools.billing_due_day failed:', e.message);
  }
  try {
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "party_invitations" (
        "id" TEXT NOT NULL,
        "school_id" TEXT NOT NULL,
        "birthday_student_id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "body" TEXT,
        "image_url" TEXT,
        "event_date" TEXT,
        "recipient_student_ids" JSONB NOT NULL DEFAULT '[]',
        "sent_at" TIMESTAMP(3),
        "reminder_sent_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "party_invitations_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('[repair] party_invitations table ensured');
  } catch(e) {
    console.error('[repair] party_invitations failed:', e.message);
  } finally {
    await p.$disconnect();
  }
})().then(() => process.exit(0)).catch(e => { console.error('[repair] fatal:', e.message); process.exit(1); });
NODEREPAIR

(node_modules/.bin/prisma migrate deploy || {
  node_modules/.bin/prisma migrate resolve --applied 20261008160000_conversation_delete || true
  node_modules/.bin/prisma migrate resolve --applied 20261008170000_owner_role || true
  node_modules/.bin/prisma migrate resolve --applied 20261019120000_add_parent_notes || true
  node_modules/.bin/prisma migrate resolve --applied 20261020120000_assignment_due_date_billing_due_day || true
  node_modules/.bin/prisma migrate resolve --applied 20261020200000_party_invitations || true
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
