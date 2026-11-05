#!/bin/sh
# Called by: Xcode Cloud after clone (apps/mobile/ios/ci_scripts).
# Use CocoaPods only — Flutter 3.47+ tries SwiftPM for file_picker's
# DKImagePickerController and fails without Package.resolved.
# User Build 9: «Could not resolve package dependencies… dkimagepickercontroller»
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
# Must run after Flutter install — keeps plugins on CocoaPods (not SwiftPM).
flutter config --no-enable-swift-package-manager
flutter precache --ios
flutter pub get

echo "ci_post_clone: flutter build ios --config-only…"
flutter build ios --config-only --release --no-codesign

# Keep iOS CFBundleVersion above prior TestFlight uploads (YYYYMMDDHHMM).
# Android keeps the shorter pubspec build; this override is iOS/Xcode Cloud only.
IOS_BUILD_NUMBER="$(date -u +%Y%m%d%H%M)"
if [ -f "ios/Flutter/Generated.xcconfig" ]; then
  if grep -q '^FLUTTER_BUILD_NUMBER=' ios/Flutter/Generated.xcconfig; then
    sed -i '' "s/^FLUTTER_BUILD_NUMBER=.*/FLUTTER_BUILD_NUMBER=$IOS_BUILD_NUMBER/" ios/Flutter/Generated.xcconfig
  else
    echo "FLUTTER_BUILD_NUMBER=$IOS_BUILD_NUMBER" >> ios/Flutter/Generated.xcconfig
  fi
  echo "ci_post_clone: FLUTTER_BUILD_NUMBER=$IOS_BUILD_NUMBER"
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
