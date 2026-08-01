#!/usr/bin/env bash
set -eo pipefail

# Publish script for springboard package to local Verdaccio registry
# Usage: ./scripts/publish-local.sh [registry-url]
# Default registry: http://localhost:4873

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REGISTRY_URL="${1:-http://localhost:4873}"
PUBLISH_VERSION="${PUBLISH_VERSION:-}"
PUBLISH_DIR="$PACKAGE_DIR"
TEMP_PUBLISH_DIR=""
TEMP_NPMRC=""

cleanup() {
  if [ -n "$TEMP_PUBLISH_DIR" ] && [ -d "$TEMP_PUBLISH_DIR" ]; then
    rm -rf "$TEMP_PUBLISH_DIR"
  fi
  if [ -n "$TEMP_NPMRC" ] && [ -f "$TEMP_NPMRC" ] && [[ "$TEMP_NPMRC" != "$PACKAGE_DIR/.npmrc" ]]; then
    rm -f "$TEMP_NPMRC"
  fi
}

trap cleanup EXIT

echo "Publishing springboard to local registry..."
echo "==========================================="
echo "Registry: $REGISTRY_URL"
echo ""

# Check if Verdaccio is running
if ! curl -s "$REGISTRY_URL" > /dev/null 2>&1; then
  echo "❌ Error: Verdaccio is not running at $REGISTRY_URL"
  echo ""
  echo "Start Verdaccio with:"
  echo "  verdaccio"
  echo ""
  exit 1
fi

echo "✓ Verdaccio is running"
echo ""

# Build first
echo "Building package..."
"$SCRIPT_DIR/build-all.sh"
echo ""

# Verify build outputs exist
echo "Verifying build outputs..."
if [ ! -d "$PACKAGE_DIR/dist" ]; then
  echo "❌ Error: dist/ directory not found"
  exit 1
fi

if [ ! -d "$PACKAGE_DIR/vite-plugin/dist" ]; then
  echo "❌ Error: vite-plugin/dist/ directory not found"
  exit 1
fi

echo "✓ Build outputs verified"
echo ""

if [ -n "$PUBLISH_VERSION" ]; then
  TEMP_PUBLISH_DIR="$(mktemp -d)"
  cp -R "$PACKAGE_DIR"/. "$TEMP_PUBLISH_DIR"/
  node -e "const fs=require('fs'); const packageJsonPath=process.argv[1]; const nextVersion=process.argv[2]; const packageJson=JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')); packageJson.version=nextVersion; fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');" "$TEMP_PUBLISH_DIR/package.json" "$PUBLISH_VERSION"
  PUBLISH_DIR="$TEMP_PUBLISH_DIR"
fi

# Get package name and version
PACKAGE_NAME=$(node -p "require('$PUBLISH_DIR/package.json').name")
PACKAGE_VERSION=$(node -p "require('$PUBLISH_DIR/package.json').version")

echo "Publishing $PACKAGE_NAME@$PACKAGE_VERSION..."
echo ""

REGISTRY_HOST=$(echo "$REGISTRY_URL" | sed -E 's#^https?://##; s#/$##')
if [ "$PUBLISH_DIR" = "$PACKAGE_DIR" ]; then
  TEMP_NPMRC="$(mktemp)"
else
  TEMP_NPMRC="$PUBLISH_DIR/.npmrc"
fi
cat > "$TEMP_NPMRC" <<EOF
registry=$REGISTRY_URL
//$REGISTRY_HOST/:_authToken="dummy-token"
EOF

if [[ "$REGISTRY_HOST" == localhost:* || "$REGISTRY_HOST" == 127.0.0.1:* ]]; then
  if NPM_CONFIG_USERCONFIG="$TEMP_NPMRC" npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version --registry "$REGISTRY_URL" > /dev/null 2>&1; then
    echo "Removing existing $PACKAGE_NAME@$PACKAGE_VERSION from local registry..."
    NPM_CONFIG_USERCONFIG="$TEMP_NPMRC" npm unpublish "$PACKAGE_NAME@$PACKAGE_VERSION" --registry "$REGISTRY_URL" --force > /dev/null
    echo "✓ Removed existing local package version"
    echo ""
  fi
fi

# Check if we need to authenticate
# Try publishing, and if it fails with auth error, provide instructions
cd "$PUBLISH_DIR"
if ! NPM_CONFIG_USERCONFIG="$TEMP_NPMRC" npm publish --registry "$REGISTRY_URL" --ignore-scripts 2>&1 | tee /tmp/publish-output.log; then
  if grep -q "E401\|authentication" /tmp/publish-output.log; then
    echo ""
    echo "⚠️  Authentication required!"
    echo ""
    echo "Run this command to create a user (use any credentials for local testing):"
    echo "  npm adduser --registry $REGISTRY_URL"
    echo ""
    echo "Then run this script again:"
    echo "  pnpm run publish:local"
    exit 1
  else
    # Some other error
    exit 1
  fi
fi

echo ""
echo "==========================================="
echo "✓ Published successfully!"
echo ""
echo "To install in another project:"
echo "  echo 'registry=$REGISTRY_URL' > .npmrc"
echo "  pnpm install $PACKAGE_NAME@$PACKAGE_VERSION"
echo ""
echo "To view in Verdaccio web UI:"
echo "  open $REGISTRY_URL"
