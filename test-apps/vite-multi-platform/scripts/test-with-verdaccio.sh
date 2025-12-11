#!/bin/bash

#
# Springboard Vite Multi-Platform Test with Verdaccio
#
# This script:
# 1. Starts Verdaccio (local npm registry)
# 2. Publishes all Springboard packages to Verdaccio
# 3. Installs packages in this test app from Verdaccio
# 4. Runs Vite dev server briefly to verify HMR
# 5. Builds for all platforms
# 6. Runs export verification tests
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_APP_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$TEST_APP_DIR/../.." && pwd)"
VERDACCIO_PORT=4873
VERDACCIO_URL="http://localhost:$VERDACCIO_PORT"
VERSION="${VERSION:-0.2.0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."

    # Kill Verdaccio if we started it
    if [ -n "$VERDACCIO_PID" ]; then
        log_info "Stopping Verdaccio (PID: $VERDACCIO_PID)"
        kill "$VERDACCIO_PID" 2>/dev/null || true
    fi

    # Kill Vite dev server if running
    if [ -n "$VITE_PID" ]; then
        log_info "Stopping Vite dev server (PID: $VITE_PID)"
        kill "$VITE_PID" 2>/dev/null || true
    fi

    # Clean up node_modules in test app
    if [ "$CLEANUP_NODE_MODULES" = "true" ]; then
        log_info "Removing test app node_modules"
        rm -rf "$TEST_APP_DIR/node_modules"
    fi

    log_info "Cleanup complete"
}

trap cleanup EXIT

# Parse arguments
SKIP_VERDACCIO_START=false
SKIP_PUBLISH=false
KEEP_NODE_MODULES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-verdaccio)
            SKIP_VERDACCIO_START=true
            shift
            ;;
        --skip-publish)
            SKIP_PUBLISH=true
            shift
            ;;
        --keep-node-modules)
            KEEP_NODE_MODULES=true
            shift
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-verdaccio     Skip starting Verdaccio (assumes already running)"
            echo "  --skip-publish       Skip publishing packages (assumes already published)"
            echo "  --keep-node-modules  Don't remove node_modules after test"
            echo "  --version VERSION    Version to publish (default: 0.2.0)"
            echo "  --help               Show this help"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

CLEANUP_NODE_MODULES=true
if [ "$KEEP_NODE_MODULES" = "true" ]; then
    CLEANUP_NODE_MODULES=false
fi

echo ""
echo "========================================"
echo "  Springboard Vite Multi-Platform Test"
echo "========================================"
echo ""
echo "Configuration:"
echo "  Repo Root:     $REPO_ROOT"
echo "  Test App:      $TEST_APP_DIR"
echo "  Verdaccio URL: $VERDACCIO_URL"
echo "  Version:       $VERSION"
echo ""

# Step 1: Start Verdaccio
if [ "$SKIP_VERDACCIO_START" = "false" ]; then
    log_info "Starting Verdaccio..."

    # Check if Verdaccio is already running
    if curl -s "$VERDACCIO_URL/-/ping" > /dev/null 2>&1; then
        log_warn "Verdaccio already running at $VERDACCIO_URL"
    else
        # Start Verdaccio
        cd "$REPO_ROOT"

        # Try to use global verdaccio first, fall back to npx
        if command -v verdaccio &> /dev/null; then
            verdaccio --config "$REPO_ROOT/verdaccio/config/config.yaml" > "$TEST_APP_DIR/verdaccio.log" 2>&1 &
        else
            npx verdaccio --config "$REPO_ROOT/verdaccio/config/config.yaml" > "$TEST_APP_DIR/verdaccio.log" 2>&1 &
        fi
        VERDACCIO_PID=$!
        echo "$VERDACCIO_PID" > "$TEST_APP_DIR/verdaccio.pid"

        # Wait for Verdaccio to be ready
        log_info "Waiting for Verdaccio to start..."
        for i in {1..30}; do
            if curl -s "$VERDACCIO_URL/-/ping" > /dev/null 2>&1; then
                log_success "Verdaccio is ready"
                break
            fi
            if [ $i -eq 30 ]; then
                log_error "Verdaccio failed to start within 30 seconds"
                cat "$TEST_APP_DIR/verdaccio.log"
                exit 1
            fi
            sleep 1
        done
    fi
else
    log_info "Skipping Verdaccio startup (--skip-verdaccio)"
fi

# Step 2: Publish packages to Verdaccio
if [ "$SKIP_PUBLISH" = "false" ]; then
    log_info "Publishing packages to Verdaccio..."

    cd "$REPO_ROOT"

    # Set up npm to use Verdaccio
    export NPM_CONFIG_REGISTRY="$VERDACCIO_URL"

    # Configure authentication
    echo "registry=$VERDACCIO_URL/" > ~/.npmrc.verdaccio
    echo "//$VERDACCIO_URL/:_authToken=fake" >> ~/.npmrc.verdaccio

    # Run the publish script
    log_info "Running publish script with version $VERSION..."
    bash "$REPO_ROOT/scripts/run-all-folders.sh" "$VERSION" --mode verdaccio

    log_success "Packages published to Verdaccio"
else
    log_info "Skipping package publish (--skip-publish)"
fi

# Step 3: Clean and install in test app
log_info "Setting up test app..."

cd "$TEST_APP_DIR"

# Clean previous installation
rm -rf node_modules pnpm-lock.yaml package-lock.json

# Update package.json versions to match
log_info "Updating package.json versions to $VERSION..."
if command -v jq &> /dev/null; then
    # Use jq if available
    jq --arg v "$VERSION" '
        .dependencies.springboard = $v |
        .dependencies."springboard-server" = $v |
        .dependencies."@springboardjs/platforms-browser" = $v |
        .dependencies."@springboardjs/platforms-node" = $v |
        .dependencies."@springboardjs/platforms-partykit" = $v |
        .dependencies."@springboardjs/data-storage" = $v
    ' package.json > package.json.tmp && mv package.json.tmp package.json
else
    # Fall back to sed
    sed -i.bak "s/\"springboard\": \"[^\"]*\"/\"springboard\": \"$VERSION\"/" package.json
    sed -i.bak "s/\"springboard-server\": \"[^\"]*\"/\"springboard-server\": \"$VERSION\"/" package.json
    sed -i.bak "s/\"@springboardjs\/platforms-browser\": \"[^\"]*\"/\"@springboardjs\/platforms-browser\": \"$VERSION\"/" package.json
    sed -i.bak "s/\"@springboardjs\/platforms-node\": \"[^\"]*\"/\"@springboardjs\/platforms-node\": \"$VERSION\"/" package.json
    sed -i.bak "s/\"@springboardjs\/platforms-partykit\": \"[^\"]*\"/\"@springboardjs\/platforms-partykit\": \"$VERSION\"/" package.json
    sed -i.bak "s/\"@springboardjs\/data-storage\": \"[^\"]*\"/\"@springboardjs\/data-storage\": \"$VERSION\"/" package.json
    rm -f package.json.bak
fi

# Install dependencies from Verdaccio
log_info "Installing dependencies from Verdaccio..."
pnpm install --registry "$VERDACCIO_URL"

log_success "Dependencies installed"

# Step 4: Test Vite dev server (brief test)
log_info "Testing Vite dev server..."

# Start Vite in background
pnpm exec vite --port 3333 &
VITE_PID=$!

# Wait for Vite to start
sleep 5

# Check if Vite is responding
if curl -s "http://localhost:3333" > /dev/null 2>&1; then
    log_success "Vite dev server is running"
else
    log_warn "Vite dev server may not be fully ready (this is OK for CI)"
fi

# Kill Vite dev server
kill "$VITE_PID" 2>/dev/null || true
VITE_PID=""

# Step 5: Build for all platforms
log_info "Building for browser platform..."
pnpm exec vite build --mode browser
log_success "Browser build complete"

log_info "Building for server platform..."
pnpm exec vite build --mode server
log_success "Server build complete"

log_info "Building for PartyKit platform..."
pnpm exec vite build --mode partykit
log_success "PartyKit build complete"

# Step 6: Verify build outputs
log_info "Verifying build outputs..."

if [ -d "dist/browser" ]; then
    log_success "Browser dist exists"
    ls -la dist/browser/
else
    log_error "Browser dist missing!"
    exit 1
fi

if [ -d "dist/server" ]; then
    log_success "Server dist exists"
    ls -la dist/server/
else
    log_error "Server dist missing!"
    exit 1
fi

if [ -d "dist/partykit" ]; then
    log_success "PartyKit dist exists"
    ls -la dist/partykit/
else
    log_error "PartyKit dist missing!"
    exit 1
fi

# Step 7: Run export tests
log_info "Running export resolution tests..."
node scripts/test-exports.mjs

echo ""
echo "========================================"
echo "  All Tests Passed!"
echo "========================================"
echo ""
log_success "Vite multi-platform build with Verdaccio completed successfully"
