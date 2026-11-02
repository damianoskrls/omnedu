#!/bin/sh
# Called by: Xcode Cloud immediately before xcodebuild.
# Re-assert Flutter env + pod install so plugin modules are on HEADER/FRAMEWORK paths.
# User: recurring «Module 'file_picker' not found» on Archive.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE="$(cd "$IOS_DIR/.." && pwd)"

export PATH="$HOME/flutter/bin:$PATH"
export FLUTTER_ROOT="${FLUTTER_ROOT:-$HOME/flutter}"

echo "ci_pre_xcodebuild: MOBILE=$MOBILE"
echo "ci_pre_xcodebuild: FLUTTER_ROOT=$FLUTTER_ROOT"

cd "$MOBILE"
flutter pub get

cd "$IOS_DIR"
pod install

test -f "Pods/Target Support Files/Pods-Runner/Pods-Runner.release.xcconfig"
test -f "Flutter/Generated.xcconfig"
test -f "Flutter/Release.xcconfig"

# Prove the fixed include path resolves
REL_PODS_XCCONFIG="$IOS_DIR/Pods/Target Support Files/Pods-Runner/Pods-Runner.release.xcconfig"
test -f "$REL_PODS_XCCONFIG"
echo "ci_pre_xcodebuild: Release.xcconfig include target exists: $REL_PODS_XCCONFIG"

if [ ! -e "Flutter/Pods" ]; then
  ln -s ../Pods "Flutter/Pods"
fi

echo "ci_pre_xcodebuild: ready"
exit 0
