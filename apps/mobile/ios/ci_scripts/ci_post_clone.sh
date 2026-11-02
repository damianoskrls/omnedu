#!/bin/sh
# Called by: Xcode Cloud after clone (apps/mobile/ios/ci_scripts).
# Ensures Flutter + CocoaPods so Runner links plugin modules (file_picker, etc.).
# User: Xcode Cloud «Module 'file_picker' not found» in GeneratedPluginRegistrant.m
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE="$(cd "$IOS_DIR/.." && pwd)"

echo "ci_post_clone: MOBILE=$MOBILE IOS_DIR=$IOS_DIR"
echo "ci_post_clone: CI_PRIMARY_REPOSITORY_PATH=${CI_PRIMARY_REPOSITORY_PATH:-}"

if [ ! -f "$MOBILE/pubspec.yaml" ]; then
  echo "error: pubspec.yaml not found at $MOBILE" >&2
  exit 1
fi

cd "$MOBILE"

if [ ! -x "$HOME/flutter/bin/flutter" ]; then
  echo "ci_post_clone: cloning Flutter stable…"
  git clone https://github.com/flutter/flutter.git --depth 1 -b stable "$HOME/flutter"
fi
export PATH="$HOME/flutter/bin:$PATH"
export FLUTTER_ROOT="$HOME/flutter"

flutter --version
flutter precache --ios
flutter pub get

HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_AUTO_UPDATE
if ! command -v pod >/dev/null 2>&1; then
  echo "ci_post_clone: installing CocoaPods…"
  brew install cocoapods
fi

cd "$IOS_DIR"
pod install

# Required artifacts for Archive
test -f "Flutter/Generated.xcconfig" || { echo "error: missing Flutter/Generated.xcconfig" >&2; exit 1; }
test -f "Pods/Target Support Files/Pods-Runner/Pods-Runner.release.xcconfig" || {
  echo "error: missing Pods-Runner.release.xcconfig after pod install" >&2
  exit 1
}
test -d ".symlinks/plugins/file_picker" || {
  echo "error: file_picker symlink missing — flutter pub get did not link plugins" >&2
  ls -la .symlinks/plugins 2>/dev/null || true
  exit 1
}
test -d "Pods/file_picker" -o -d "Pods/Headers/Public/file_picker" -o -n "$(find Pods -maxdepth 3 -type d -name 'file_picker' 2>/dev/null | head -1)" || {
  echo "error: file_picker pod not present under Pods/" >&2
  ls Pods | head -50
  exit 1
}

# Compatibility symlink if any tool still resolves Pods under Flutter/
if [ ! -e "Flutter/Pods" ]; then
  ln -s ../Pods "Flutter/Pods"
fi

echo "ci_post_clone: ready (Pods-Runner.release.xcconfig + file_picker present)"
exit 0
