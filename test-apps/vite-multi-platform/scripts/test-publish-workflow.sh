#!/bin/bash

# Test the complete publish and build workflow for the vite multi-platform test app
# This script:
# 1. Publishes springboard to local Verdaccio registry
# 2. Updates the test app to use the new version
# 3. Builds all platform targets
# 4. Reports success/failure for each

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
VITE_PLUGIN_DIR="$SPRINGBOARD_DIR/vite-plugin"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Vite Multi-Platform Test - Publish Workflow${NC}"
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

# Build TypeScript
echo "Building TypeScript..."
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

# Build vite-plugin
echo "Building vite-plugin..."
cd "$VITE_PLUGIN_DIR"
npm run build
echo -e "${GREEN}✓ Vite plugin build complete${NC}"
cd "$SPRINGBOARD_DIR"

# Publish to local registry
echo "Publishing to http://localhost:4873..."
pnpm publish --registry http://localhost:4873 --no-git-checks

echo -e "${GREEN}✓ Published springboard@${NEW_VERSION}${NC}"
echo ""

# Step 2: Update test app dependencies
echo -e "${YELLOW}Step 2: Updating test app to springboard@${NEW_VERSION}...${NC}"
cd "$TEST_APP_DIR"

# Update to latest version from Verdaccio
pnpm update springboard@latest

echo -e "${GREEN}✓ Updated dependencies${NC}"
echo ""

# Step 3: Build all platform targets
echo -e "${YELLOW}Step 3: Building all platform targets...${NC}"

declare -a PLATFORMS=("browser_online" "browser_offline" "node_maestro" "tauri" "rn_webview" "rn_main")
declare -a FAILED_BUILDS=()

for platform in "${PLATFORMS[@]}"; do
  echo -e "${BLUE}Building ${platform}...${NC}"
  if npm run build:${platform} 2>&1; then
    echo -e "${GREEN}✓ ${platform} build succeeded${NC}"
  else
    echo -e "${RED}✗ ${platform} build failed${NC}"
    FAILED_BUILDS+=("$platform")
  fi
  echo ""
done

# Summary
echo -e "${BLUE}========================================${NC}"
if [ ${#FAILED_BUILDS[@]} -eq 0 ]; then
  echo -e "${GREEN}All platform builds succeeded!${NC}"
else
  echo -e "${RED}Failed builds: ${FAILED_BUILDS[*]}${NC}"
  exit 1
fi
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Summary:"
echo "  • Published: springboard@${NEW_VERSION}"
echo "  • Built platforms: ${PLATFORMS[*]}"
echo ""
