#!/bin/bash
set -e

# Parse SPRINGBOARD_PLATFORM env var
PLATFORMS="${SPRINGBOARD_PLATFORM:-node,web}"

echo "Building platforms: $PLATFORMS"

# Clean dist directory
rm -rf dist

# Build each platform
if echo "$PLATFORMS" | grep -q "web"; then
  echo ""
  echo "Building web platform..."
  SPRINGBOARD_PLATFORM=web pnpm vite build
fi

if echo "$PLATFORMS" | grep -q "node"; then
  echo ""
  echo "Building node platform..."
  SPRINGBOARD_PLATFORM=node pnpm vite build --outDir dist/node
fi

echo ""
echo "Build complete!"
echo "Output:"
if echo "$PLATFORMS" | grep -q "web"; then
  echo "  Web: dist/"
fi
if echo "$PLATFORMS" | grep -q "node"; then
  echo "  Node: dist/node/"
fi
