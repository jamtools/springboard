#!/bin/bash

set -e

# Path to the build.gradle file
BUILD_GRADLE_PATH="android/build.gradle"

# Line to add
LINE_TO_ADD="        maven { url \"\$rootDir/../../../node_modules/@notifee/react-native/android/libs\" }"

# Check if the file exists
if [[ ! -f "$BUILD_GRADLE_PATH" ]]; then
    echo "$BUILD_GRADLE_PATH not found. Skipping notifee patch"
    exit 0
fi

# Check if the line already exists
if grep -qF "$LINE_TO_ADD" "$BUILD_GRADLE_PATH"; then
    exit 0
fi

# Insert the line below the line containing 'jitpack.io'
awk -v line="$LINE_TO_ADD" '
/jitpack.io/ {
    print $0
    print line
    next
}
{ print }
' "$BUILD_GRADLE_PATH" > "${BUILD_GRADLE_PATH}.tmp" && mv "${BUILD_GRADLE_PATH}.tmp" "$BUILD_GRADLE_PATH"

echo "Notifee Android gradle config modification complete. The file is now patched."
