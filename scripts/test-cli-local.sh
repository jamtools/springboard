#!/bin/bash

# Local CLI Test Script
# Assumes Verdaccio is already running at http://localhost:4873
#
# Usage: ./scripts/test-cli-local.sh [version]
# Example: ./scripts/test-cli-local.sh 0.2.0

set -e

VERSION="${1:-0.2.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="${ROOT_DIR}/test-cli-output"

echo "========================================"
echo "Local CLI Test"
echo "========================================"
echo "Version: $VERSION"
echo "Root dir: $ROOT_DIR"
echo "Test dir: $TEST_DIR"
echo ""

# Check if Verdaccio is running
echo "Step 1: Checking Verdaccio..."
if ! curl -s http://localhost:4873/-/ping > /dev/null; then
    echo "ERROR: Verdaccio is not running at http://localhost:4873"
    echo "Please start Verdaccio first with: verdaccio --config ./verdaccio/config/config.yaml"
    exit 1
fi
echo "Verdaccio is running"
echo ""

# Install dependencies
echo "Step 2: Installing dependencies..."
cd "$ROOT_DIR"
pnpm i
echo ""

# Build create-springboard-app CLI
echo "Step 3: Building create-springboard-app CLI..."
cd "$ROOT_DIR/packages/springboard/create-springboard-app"
npm run prepublishOnly
echo ""

# Set npm registry to Verdaccio
echo "Step 4: Configuring npm to use Verdaccio..."
npm config set registry http://localhost:4873
echo ""

# Publish all packages to Verdaccio
echo "Step 5: Publishing packages to Verdaccio..."
cd "$ROOT_DIR"
./scripts/run-all-folders.sh "$VERSION" --mode verdaccio
echo ""

# Install create-springboard-app CLI globally
echo "Step 6: Installing create-springboard-app globally..."
NPM_CONFIG_REGISTRY=http://localhost:4873 npm install -g create-springboard-app
echo ""

# Verify version
echo "Step 7: Verifying version..."
INSTALLED_VERSION=$(create-springboard-app --version)
if [ "$INSTALLED_VERSION" != "$VERSION" ]; then
    echo "ERROR: Version mismatch!"
    echo "Expected: $VERSION"
    echo "Got: $INSTALLED_VERSION"
    exit 1
fi
echo "Version verified: $INSTALLED_VERSION"
echo ""

# Clean up previous test directory
echo "Step 8: Setting up test directory..."
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
echo ""

# Create a new app
echo "Step 9: Creating new app with create-springboard-app..."
cd "$TEST_DIR"
NPM_CONFIG_REGISTRY=http://localhost:4873 create-springboard-app
echo ""

# Build the app
echo "Step 10: Building the app..."
npm run build
echo ""

echo "========================================"
echo "SUCCESS! CLI test passed."
echo "========================================"
echo "Test app created at: $TEST_DIR"
echo ""

# Reset npm registry
echo "Resetting npm registry to default..."
npm config delete registry
