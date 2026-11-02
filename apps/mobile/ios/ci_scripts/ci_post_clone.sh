#!/bin/sh
# Called by: Xcode Cloud after clone (apps/mobile/ios/ci_scripts).
# Flutter 3.47+ may not create ios/.symlinks on `pub get` alone — use
# `flutter build ios --config-only` then `pod install`.
# User Build 8 log: «error: ios/.symlinks/plugins missing after flutter pub get»
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE="$(cd "$IOS_DIR/.." && pwd)"

echo "ci_post_clone: MOBILE=$MOBILE"
echo "ci_post_clone: IOS_DIR=$IOS_DIR"
echo "ci_post_clone: CI_PRIMARY_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-}"

if [ ! -f "$MOBILE/pubspec.yaml" ]; then
  echo "error: pubspec.yaml not found at $MOBILE" >&2
  exit 1
fi

cd "$MOBILE"

if [ ! -x "$HOME/flutter/bin/flutter" ]; then
  echo "ci_post_clone: cloning Flutter stable into \$HOME/flutter…"
  rm -rf "$HOME/flutter"
  git clone https://github.com/flutter/flutter.git --depth 1 -b stable "$HOME/flutter"
fi
export PATH="$HOME/flutter/bin:$PATH"
export FLUTTER_ROOT="$HOME/flutter"
export PUB_CACHE="${PUB_CACHE:-$HOME/.pub-cache}"

flutter --version
flutter precache --ios
flutter pub get

# Creates Flutter/Generated.xcconfig + plugin registrant / symlinks used by CocoaPods.
echo "ci_post_clone: flutter build ios --config-only…"
flutter build ios --config-only --release --no-codesign

HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_AUTO_UPDATE
if ! command -v pod >/dev/null 2>&1; then
  echo "ci_post_clone: brew install cocoapods…"
  brew install cocoapods
fi
pod --version

cd "$IOS_DIR"
echo "ci_post_clone: pod install…"
pod install

test -f "Flutter/Generated.xcconfig" || {
  echo "error: missing Flutter/Generated.xcconfig" >&2
  exit 1
}
test -f "Pods/Target Support Files/Pods-Runner/Pods-Runner.release.xcconfig" || {
  echo "error: missing Pods-Runner.release.xcconfig" >&2
  ls -la "Pods/Target Support Files" >&2 || ls -la Pods >&2 || true
  exit 1
}
if ! grep -q "file_picker" Podfile.lock; then
  echo "error: file_picker not listed in Podfile.lock after pod install" >&2
  exit 1
fi

rm -f Flutter/Pods
ln -s ../Pods Flutter/Pods

echo "ci_post_clone: ready"
exit 0
