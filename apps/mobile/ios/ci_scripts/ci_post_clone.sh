#!/bin/sh
# Called by: Xcode Cloud after clone (apps/mobile/ios/ci_scripts).
# Install Flutter + CocoaPods for the monorepo app at apps/mobile.
# Keep checks simple — avoid `find | head` under `set -e` (SIGPIPE → exit 1).
# User: Build 7 «Running ci_post_clone.sh script failed (exited with code 1)»
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

# Plugin symlinks live under ios/.symlinks after pub get
if [ ! -d "$IOS_DIR/.symlinks/plugins" ]; then
  echo "error: ios/.symlinks/plugins missing after flutter pub get" >&2
  ls -la "$IOS_DIR" >&2 || true
  exit 1
fi

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
  ls -la "Pods/Target Support Files/Pods-Runner" >&2 || ls -la Pods >&2 || true
  exit 1
}

# file_picker is a path pod; confirm lockfile + symlink (no find|head)
if ! grep -q "file_picker" Podfile.lock; then
  echo "error: file_picker not listed in Podfile.lock" >&2
  exit 1
fi
if [ ! -e ".symlinks/plugins/file_picker" ]; then
  echo "error: .symlinks/plugins/file_picker missing" >&2
  ls -la .symlinks/plugins >&2 || true
  exit 1
fi

# So both ../Pods and Flutter/Pods includes resolve
rm -f Flutter/Pods
ln -s ../Pods Flutter/Pods

echo "ci_post_clone: ready"
echo "ci_post_clone: Release pods xcconfig OK"
echo "ci_post_clone: file_picker symlink OK"
exit 0
