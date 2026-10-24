#!/bin/sh
set -e

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

cd "$ROOT/apps/api"

# Regenerate Prisma client so it always matches the current schema.
node_modules/.bin/prisma generate || echo '[prisma] generate failed, continuing anyway'

# Direct repair: add missing DB columns using PrismaClient (reliable on Render).
node repair.js || echo '[repair] repair.js failed, continuing anyway'


(node_modules/.bin/prisma migrate deploy || {
  node_modules/.bin/prisma migrate resolve --applied 20261008160000_conversation_delete || true
  node_modules/.bin/prisma migrate resolve --applied 20261008170000_owner_role || true
  node_modules/.bin/prisma migrate resolve --applied 20261019120000_add_parent_notes || true
  node_modules/.bin/prisma migrate resolve --applied 20261020120000_assignment_due_date_billing_due_day || true
  node_modules/.bin/prisma migrate resolve --applied 20261020200000_party_invitations || true
  node_modules/.bin/prisma migrate resolve --applied 20261021000000_repair_billing_due_day_and_assignment_date || true
  node_modules/.bin/prisma migrate resolve --applied 20261022000000_add_student_gender || true
  node_modules/.bin/prisma migrate resolve --applied 20261023000000_add_sibling_discount || true
  node_modules/.bin/prisma migrate resolve --applied 20261023100000_add_student_siblings_table || true
  node_modules/.bin/prisma migrate resolve --applied 20261023200000_add_party_invitation_pdf_url || true
  node_modules/.bin/prisma migrate resolve --applied 20261023300000_add_route_completions || true
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
