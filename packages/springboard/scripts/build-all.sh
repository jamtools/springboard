#!/usr/bin/env bash
set -e

# Build script for springboard package
# Builds both the main package and the vite-plugin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building springboard package..."
echo "================================"
echo ""

# Build main package
echo "1. Building main package..."
cd "$PACKAGE_DIR"
pnpm build

echo ""
echo "2. Building CLI..."
cd "$PACKAGE_DIR/cli"
pnpm build

echo ""
echo "3. Building vite-plugin..."
cd "$PACKAGE_DIR/vite-plugin"
pnpm build

echo ""
echo "================================"
echo "✓ Build complete!"
echo ""
echo "Outputs:"
echo "  - Main package: $PACKAGE_DIR/dist/"
echo "  - CLI: $PACKAGE_DIR/cli/dist/"
echo "  - Vite plugin: $PACKAGE_DIR/vite-plugin/dist/"
