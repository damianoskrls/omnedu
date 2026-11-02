#!/bin/sh
# Called by: Xcode Cloud after clone (apps/mobile/ios/ci_scripts).
# Pods/ is gitignored — without this, Archive fails loading
# Pods-Runner-frameworks-Release-*.xcfilelist (${PODS_ROOT} empty).
# User: Xcode Cloud email «Unable to load contents of file list: '/Target Support Files/Pods-Runner/...'»
set -e

ROOT="${CI_PRIMARY_REPOSITORY_PATH:-}"
if [ -z "$ROOT" ]; then
  ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
fi

MOBILE="$ROOT/apps/mobile"
if [ ! -d "$MOBILE" ]; then
  echo "error: expected Flutter app at $MOBILE" >&2
  exit 1
fi

cd "$MOBILE"

if ! command -v flutter >/dev/null 2>&1; then
  git clone https://github.com/flutter/flutter.git --depth 1 -b stable "$HOME/flutter"
  export PATH="$PATH:$HOME/flutter/bin"
fi

flutter precache --ios
flutter pub get

HOMEBREW_NO_AUTO_UPDATE=1
if ! command -v pod >/dev/null 2>&1; then
  brew install cocoapods
fi

cd ios
pod install

exit 0
