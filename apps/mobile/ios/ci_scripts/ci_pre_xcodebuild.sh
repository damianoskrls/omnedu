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
# App Store Connect requires CFBundleVersion to increase vs previous uploads.
# Older TestFlight builds used YYYYMMDDHHMM (e.g. 202611041506). Android uses a
# shorter YYMMDDHH from pubspec (+26110517) which is LOWER — ASC rejects upload.
# Override iOS build number only; marketing version still comes from pubspec.
IOS_BUILD_NUMBER="$(date -u +%Y%m%d%H%M)"
if [ -f "Flutter/Generated.xcconfig" ]; then
  if grep -q '^FLUTTER_BUILD_NUMBER=' Flutter/Generated.xcconfig; then
    sed -i '' "s/^FLUTTER_BUILD_NUMBER=.*/FLUTTER_BUILD_NUMBER=$IOS_BUILD_NUMBER/" Flutter/Generated.xcconfig
  else
    echo "FLUTTER_BUILD_NUMBER=$IOS_BUILD_NUMBER" >> Flutter/Generated.xcconfig
  fi
  echo "ci_pre_xcodebuild: FLUTTER_BUILD_NUMBER=$IOS_BUILD_NUMBER"
  grep '^FLUTTER_BUILD_' Flutter/Generated.xcconfig || true
fi

pod install

test -f "Pods/Target Support Files/Pods-Runner/Pods-Runner.release.xcconfig"
test -f "Flutter/Generated.xcconfig"
rm -f Flutter/Pods
ln -s ../Pods Flutter/Pods

echo "ci_pre_xcodebuild: ready"
exit 0
