#!/bin/bash
# Installs the current main branch on the connected iPhone, not a simulator
# and not whatever branch was checked out before.
set -euo pipefail

cd "$(dirname "$0")"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if ! command -v flutter >/dev/null 2>&1; then
  echo "Το flutter δεν βρίσκεται στο terminal. Άνοιξε το Terminal, όχι το Xcode, και τρέξε αυτό το αρχείο."
  exit 1
fi

echo "Φέρνω την τελευταία έκδοση από το main..."
git fetch origin main
# Xcode and Flutter rewrite the iOS project locally. Those edits block the update.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Αποθηκεύω προσωρινά τις τοπικές αλλαγές ώστε να περάσει η ενημέρωση..."
  git stash push -m "run_iphone πριν την εγκατάσταση"
fi
git checkout main
if ! git diff --quiet || ! git diff --cached --quiet; then
  git stash push -m "run_iphone πριν την εγκατάσταση"
fi
git pull --ff-only origin main

cd "$ROOT/apps/mobile"
echo "Καθαρίζω το παλιό build..."
flutter clean
flutter pub get

DEVICE="$(python3 - <<'PY'
import json, subprocess, sys
raw = subprocess.check_output(["flutter", "devices", "--machine"], text=True)
try:
    devices = json.loads(raw)
except json.JSONDecodeError:
    sys.exit(1)
for device in devices:
    platform = str(device.get("targetPlatform", ""))
    if platform.startswith("ios") and not device.get("emulator"):
        print(device.get("id", ""))
        sys.exit(0)
sys.exit(1)
PY
)" || true

if [ -z "${DEVICE}" ]; then
  echo "Δεν βλέπω iPhone στο καλώδιο. Ξεκλείδωσέ το, πάτα Trust, και τρέξε ξανά:"
  echo "  bash run_iphone.sh"
  flutter devices || true
  exit 1
fi

echo "Σβήνω την παλιά εγκατάσταση από το iPhone..."
xcrun devicectl device uninstall app --device "$DEVICE" com.omnedu.omnedu >/dev/null 2>&1 || true

echo "Εγκαθιστώ το omnedu v. 1.05 στο iPhone ($DEVICE)..."
echo "Όταν ανοίξει, κάτω από το λογότυπο πρέπει να γράφει: omnedu v. 1.05"
flutter run --release -d "$DEVICE"
