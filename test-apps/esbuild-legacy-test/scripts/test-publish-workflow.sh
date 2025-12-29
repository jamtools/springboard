#!/bin/bash

# Test the complete publish and build workflow for the legacy esbuild test app
# This script:
# 1. Publishes springboard to local Verdaccio registry
# 2. Updates the test app to use the new version
# 3. Rebuilds better-sqlite3 native bindings
# 4. Builds the test app
# 5. Tests running the node bundle

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEST_APP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$TEST_APP_DIR/../.." && pwd)"
SPRINGBOARD_DIR="$PROJECT_ROOT/packages/springboard"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Legacy esbuild Test - Publish Workflow${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Publish springboard to Verdaccio
echo -e "${YELLOW}Step 1: Publishing springboard to Verdaccio...${NC}"
cd "$SPRINGBOARD_DIR"

# Bump patch version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

npm version patch --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Publish to local registry
echo "Publishing to http://localhost:4873..."
npm publish --registry http://localhost:4873

echo -e "${GREEN}✓ Published springboard@${NEW_VERSION}${NC}"
echo ""

# Step 2: Update test app dependencies
echo -e "${YELLOW}Step 2: Updating test app to springboard@${NEW_VERSION}...${NC}"
cd "$TEST_APP_DIR"

# Update to latest version from Verdaccio
pnpm update springboard@latest

echo -e "${GREEN}✓ Updated dependencies${NC}"
echo ""

# Step 3: Rebuild better-sqlite3
echo -e "${YELLOW}Step 3: Rebuilding better-sqlite3 native bindings...${NC}"
pnpm rebuild better-sqlite3

echo -e "${GREEN}✓ Rebuilt better-sqlite3${NC}"
echo ""

# Step 4: Build the test app
echo -e "${YELLOW}Step 4: Building test app...${NC}"
pnpm build

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 5: Test node bundle
echo -e "${YELLOW}Step 5: Testing node bundle...${NC}"
echo "Starting server in background..."

# Start the server in background
node dist/node/dist/index.cjs &
NODE_PID=$!

# Wait for server to start
sleep 3

# Check if process is running
if ps -p $NODE_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server started successfully (PID: $NODE_PID)${NC}"

    # Test shutdown
    echo "Testing graceful shutdown..."
    kill -INT $NODE_PID

    # Wait for shutdown
    sleep 2

    # Check if process exited
    if ps -p $NODE_PID > /dev/null 2>&1; then
        echo -e "${RED}✗ Server failed to shut down gracefully${NC}"
        kill -9 $NODE_PID 2>/dev/null || true
        exit 1
    else
        echo -e "${GREEN}✓ Server shut down gracefully${NC}"
    fi
else
    echo -e "${RED}✗ Server failed to start${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All Tests Passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "  • Published: springboard@${NEW_VERSION}"
echo "  • Browser build: dist/browser/dist/index.js"
echo "  • Node build: dist/node/dist/index.cjs"
echo "  • Server startup: ✓"
echo "  • Graceful shutdown: ✓"
echo ""
