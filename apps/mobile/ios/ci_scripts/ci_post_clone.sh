#!/bin/sh
# Called by: Xcode Cloud after clone (lives next to Runner.xcodeproj).
# Resolve paths from this script location so monorepo layout always works
# even when CI_PRIMARY_REPOSITORY_PATH is unexpected.
# User: Xcode Cloud Archive failures (missing Pods / Firebase modules).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE="$(cd "$IOS_DIR/.." && pwd)"

echo "ci_post_clone: SCRIPT_DIR=$SCRIPT_DIR"
echo "ci_post_clone: IOS_DIR=$IOS_DIR"
echo "ci_post_clone: MOBILE=$MOBILE"
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

if [ ! -f "Flutter/Generated.xcconfig" ]; then
  echo "error: Flutter/Generated.xcconfig missing after pub get" >&2
  exit 1
fi
if [ ! -d "Pods" ]; then
  echo "error: ios/Pods missing after pod install" >&2
  exit 1
fi

echo "ci_post_clone: ready"
exit 0
