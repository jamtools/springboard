#!/usr/bin/env bash
set -e

# Publish script for springboard package to local Verdaccio registry
# Usage: ./scripts/publish-local.sh [registry-url]
# Default registry: http://localhost:4873

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REGISTRY_URL="${1:-http://localhost:4873}"

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

# Get package name and version
PACKAGE_NAME=$(node -p "require('$PACKAGE_DIR/package.json').name")
PACKAGE_VERSION=$(node -p "require('$PACKAGE_DIR/package.json').version")

echo "Publishing $PACKAGE_NAME@$PACKAGE_VERSION..."
echo ""

# Check if we need to authenticate
# Try publishing, and if it fails with auth error, provide instructions
cd "$PACKAGE_DIR"
if ! npm publish --registry "$REGISTRY_URL" 2>&1 | tee /tmp/publish-output.log; then
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
