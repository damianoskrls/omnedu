#!/bin/sh
set -e

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

cd "$ROOT/apps/api"

# Direct repair: add missing DB columns via prisma db execute (synchronous, no async issues).
cat > /tmp/omnedu_repair.sql << 'REPAIRSQL'
ALTER TABLE "school_members" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "class_assignments" ADD COLUMN IF NOT EXISTS "due_date" DATE;
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "billing_due_day" INTEGER;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "gender" TEXT;
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
);
REPAIRSQL
node_modules/.bin/prisma db execute --file /tmp/omnedu_repair.sql && echo '[repair] all columns ensured' || echo '[repair] prisma db execute failed, continuing anyway'

(node_modules/.bin/prisma migrate deploy || {
  node_modules/.bin/prisma migrate resolve --applied 20261008160000_conversation_delete || true
  node_modules/.bin/prisma migrate resolve --applied 20261008170000_owner_role || true
  node_modules/.bin/prisma migrate resolve --applied 20261019120000_add_parent_notes || true
  node_modules/.bin/prisma migrate resolve --applied 20261020120000_assignment_due_date_billing_due_day || true
  node_modules/.bin/prisma migrate resolve --applied 20261020200000_party_invitations || true
  node_modules/.bin/prisma migrate resolve --applied 20261021000000_repair_billing_due_day_and_assignment_date || true
  node_modules/.bin/prisma migrate resolve --applied 20261022000000_add_student_gender || true
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
