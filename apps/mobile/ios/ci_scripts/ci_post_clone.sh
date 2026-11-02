#!/bin/sh
# Called by: Xcode Cloud after clone (apps/mobile/ios/ci_scripts).
# Pods/ is gitignored — must flutter pub get + pod install before Archive.
# Also prepares Flutter so AppDelegate Firebase modules resolve via CocoaPods.
# User: Xcode Cloud «Unable to resolve module dependency: 'FirebaseCore' / 'FirebaseMessaging'»
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

if [ ! -x "$HOME/flutter/bin/flutter" ]; then
  git clone https://github.com/flutter/flutter.git --depth 1 -b stable "$HOME/flutter"
fi
export PATH="$HOME/flutter/bin:$PATH"
export FLUTTER_ROOT="$HOME/flutter"

flutter --version
flutter precache --ios
flutter pub get
# Generates ios/Flutter/Generated.xcconfig + plugin registrant used by pod install / Archive.
flutter build ios --config-only --release --no-codesign

HOMEBREW_NO_AUTO_UPDATE=1
if ! command -v pod >/dev/null 2>&1; then
  brew install cocoapods
fi

cd ios
pod install

# Fail fast if Firebase pods did not land (same error AppDelegate would hit later).
test -d "Pods/FirebaseCore" || {
  echo "error: Pods/FirebaseCore missing after pod install" >&2
  exit 1
}
test -d "Pods/FirebaseMessaging" || {
  echo "error: Pods/FirebaseMessaging missing after pod install" >&2
  exit 1
}

echo "ci_post_clone: Flutter + CocoaPods ready (FirebaseCore/Messaging present)"
exit 0
