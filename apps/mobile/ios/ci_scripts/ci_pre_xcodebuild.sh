#!/bin/sh
# Called by: Xcode Cloud immediately before xcodebuild.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE="$(cd "$IOS_DIR/.." && pwd)"

export PATH="$HOME/flutter/bin:$PATH"
export FLUTTER_ROOT="${FLUTTER_ROOT:-$HOME/flutter}"

if [ ! -x "$FLUTTER_ROOT/bin/flutter" ]; then
  echo "error: Flutter missing at $FLUTTER_ROOT" >&2
  exit 1
fi

flutter config --no-enable-swift-package-manager

cd "$MOBILE"
flutter pub get
flutter build ios --config-only --release --no-codesign

cd "$IOS_DIR"
pod install

test -f "Pods/Target Support Files/Pods-Runner/Pods-Runner.release.xcconfig"
test -f "Flutter/Generated.xcconfig"
rm -f Flutter/Pods
ln -s ../Pods Flutter/Pods

echo "ci_pre_xcodebuild: ready"
exit 0
