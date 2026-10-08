#!/bin/sh
set -e

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

cd "$ROOT/apps/api"
(node_modules/.bin/prisma migrate deploy || {
  node_modules/.bin/prisma migrate resolve --rolled-back 20261008160000_conversation_delete || true
  node_modules/.bin/prisma migrate resolve --rolled-back 20261008170000_owner_role || true
  node_modules/.bin/prisma migrate deploy || echo 'migration failed, starting api anyway'
})
cd "$ROOT"

if [ ! -d "$ROOT/apps/web/.next" ]; then
  echo 'web build missing, starting the API only'
  exec node "$ROOT/apps/api/dist/main"
fi

PUBLIC_PORT="${PORT:-${API_PORT:-3001}}"
export API_PORT=3011
export PUBLIC_PORT
export API_UPSTREAM=3011
export WEB_UPSTREAM=3012

node "$ROOT/apps/api/dist/main" &
API_PID=$!
(cd "$ROOT/apps/web" && pnpm exec next start -p 3012 -H 127.0.0.1) &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup TERM INT

node "$ROOT/scripts/web-front.mjs" &
FRONT_PID=$!
wait "$FRONT_PID"
STATUS=$?
cleanup
exit "$STATUS"
