# Canonical Springboard Integration Testing Runbook

**Date**: 2026-01-03
**Status**: Unified, ready for execution
**Goal**: Validate migrated springboard package works with Songdrive

---

## Critical Decisions (Resolved)

1. **Songdrive Path**: `/Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor`
2. **Install Strategy**: Verdaccio (not pnpm link)
3. **Build System**: Vite multi-target (Phase 8 complete)
4. **Platform Support**: macOS primary (note Linux differences)

---

## Prerequisites Checklist

Before starting, verify these conditions are met:

```bash
# 1. Verdaccio installed
command -v verdaccio || npm install -g verdaccio

# 2. Phase 8 Vite parity complete
test -f packages/springboard/src/vite-plugin/build-runner.ts && echo "✓ Build runner exists" || echo "❌ Phase 8 incomplete"
test -f packages/springboard/src/vite-plugin/loaders.ts && echo "✓ Loaders exist" || echo "❌ Phase 8 incomplete"
test -f packages/springboard/src/vite-plugin/post_build.ts && echo "✓ Post-build exists" || echo "❌ Phase 8 incomplete"

# 3. Build scripts exist
cd packages/springboard
cat package.json | jq '.scripts | has("build:all")' | grep -q true && echo "✓ build:all exists" || echo "⚠ Need to add build:all"
cat package.json | jq '.scripts | has("publish:local")' | grep -q true && echo "✓ publish:local exists" || echo "⚠ Need to add publish:local"

# 4. Songdrive repo exists
test -d /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor && echo "✓ Songdrive repo found" || echo "❌ Path incorrect"
```

---

## Step 0: Add Build Scripts (If Missing)

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard

# Check if scripts exist
HAS_BUILD_ALL=$(cat package.json | jq '.scripts | has("build:all")')
HAS_PUBLISH_LOCAL=$(cat package.json | jq '.scripts | has("publish:local")')

if [ "$HAS_BUILD_ALL" != "true" ] || [ "$HAS_PUBLISH_LOCAL" != "true" ]; then
  echo "Adding build scripts..."

  # Backup
  cp package.json package.json.bak

  # Add scripts using jq
  cat package.json | jq '.scripts += {
    "build:all": "pnpm run prebuild && pnpm run build && pnpm run build:cli && pnpm run build:vite-plugin",
    "publish:local": "pnpm run build:all && npm publish --registry http://localhost:4873"
  }' > package.json.tmp

  mv package.json.tmp package.json
  echo "✓ Scripts added"
else
  echo "✓ Scripts already exist"
fi
```

---

## Step 1: Start Verdaccio

```bash
# Kill any existing instance
pkill verdaccio 2>/dev/null || true

# Start in background
verdaccio > /tmp/verdaccio.log 2>&1 &
VERDACCIO_PID=$!
echo $VERDACCIO_PID > /tmp/verdaccio.pid

# Wait for startup
sleep 5

# Verify
if curl -s http://localhost:4873 | grep -q "verdaccio"; then
  echo "✓ Verdaccio running (PID: $VERDACCIO_PID)"
else
  echo "❌ Verdaccio failed to start"
  cat /tmp/verdaccio.log
  exit 1
fi
```

---

## Step 2: Verify Export Map Before Publishing

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard

# Required exports for Songdrive
REQUIRED_EXPORTS=(
  "./server/register"
  "./server/hono_app"
  "./platforms/node/services/ws_server_core_dependencies"
  "./platforms/node/services/node_kvstore_service"
  "./platforms/node/services/node_local_json_rpc"
  "./platforms/node/services/node_rpc_async_local_storage"
  "./platforms/browser/services/browser_json_rpc"
  "./platforms/cloudflare-workers/entrypoints/cloudflare_entrypoint"
  "./platforms/react-native/entrypoints/rn_entrypoint"
  "./platforms/tauri/entrypoints/tauri_entrypoint"
  "./engine/engine"
  "./engine/module_api"
  "./module_registry/module_registry"
  "./data-storage/kysely_storage_service"
  "./cli"
  "./vite-plugin"
)

echo "Checking export map..."
MISSING=0

for export in "${REQUIRED_EXPORTS[@]}"; do
  if cat package.json | jq -e ".exports.\"$export\"" > /dev/null 2>&1; then
    echo "✓ $export"
  else
    echo "❌ MISSING: $export"
    MISSING=$((MISSING + 1))
  fi
done

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "❌ $MISSING required exports missing"
  echo "Run: node scripts/generate-exports.js"
  echo "Then rebuild and retry"
  exit 1
else
  echo ""
  echo "✓ All required exports present"
fi
```

---

## Step 3: Build and Publish Springboard

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard

# Clean
rm -rf dist/

# Build all (prebuild, core, cli, vite-plugin)
echo "Building all outputs..."
pnpm run build:all 2>&1 | tee /tmp/springboard-build.log

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  tail -50 /tmp/springboard-build.log
  exit 1
fi

# Verify all outputs exist
echo ""
echo "Verifying build outputs..."
DIRS=("dist/core" "dist/server" "dist/platforms" "dist/cli" "dist/vite-plugin")
for dir in "${DIRS[@]}"; do
  if [ -d "$dir" ]; then
    FILE_COUNT=$(find "$dir" -name "*.js" | wc -l | tr -d ' ')
    echo "✓ $dir ($FILE_COUNT JS files)"
  else
    echo "❌ MISSING: $dir"
    exit 1
  fi
done

# Publish to Verdaccio
echo ""
echo "Publishing to Verdaccio..."
npm publish --registry http://localhost:4873 2>&1 | tee /tmp/publish.log

if grep -qE "(published|already exists)" /tmp/publish.log; then
  VERSION=$(cat package.json | jq -r '.version')
  echo "✓ Published springboard@$VERSION"
else
  # Check if auth needed
  if grep -q "E401" /tmp/publish.log || grep -q "unauthorized" /tmp/publish.log; then
    echo "⚠ Authentication required"
    echo "Run: npm adduser --registry http://localhost:4873"
    echo "  Username: test"
    echo "  Password: test"
    echo "  Email: test@test.com"
    echo "Then retry publish"
    exit 1
  else
    echo "❌ Publish failed"
    cat /tmp/publish.log
    exit 1
  fi
fi

# Verify in registry
echo ""
echo "Verifying in Verdaccio..."
npm view springboard --registry http://localhost:4873 > /tmp/registry-view.txt 2>&1
if [ $? -eq 0 ]; then
  echo "✓ Package visible in registry"
  cat /tmp/registry-view.txt | head -20
else
  echo "❌ Package not found in registry"
  exit 1
fi
```

---

## Step 4: Prepare Songdrive

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Backup current state
echo "Creating backups..."
cp package.json package.json.backup.$(date +%Y%m%d_%H%M%S)
cp pnpm-lock.yaml pnpm-lock.yaml.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Stash any uncommitted changes
git stash push -m "Pre-migration stash $(date +%Y%m%d_%H%M%S)"

# Configure Verdaccio registry
cat > .npmrc << 'EOF'
registry=http://localhost:4873
EOF

echo "✓ Songdrive prepared"
```

---

## Step 5: Update package.json Dependencies

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Get springboard version from Verdaccio
SPRINGBOARD_VERSION=$(npm view springboard version --registry http://localhost:4873 2>/dev/null)

if [ -z "$SPRINGBOARD_VERSION" ]; then
  echo "❌ Could not get springboard version from Verdaccio"
  exit 1
fi

echo "Target version: springboard@$SPRINGBOARD_VERSION"

# Create update script
cat > /tmp/update-songdrive-deps.js << 'EOFJS'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Get version from command line
const version = process.argv[2];
if (!version) {
  console.error('Usage: node script.js <version>');
  process.exit(1);
}

// Remove old packages
const oldPackages = [
  'springboard-server',
  '@springboardjs/data-storage',
  '@springboardjs/platforms-browser',
  '@springboardjs/platforms-cf-workers',
  '@springboardjs/platforms-node',
  '@springboardjs/platforms-react-native'
];

let removed = 0;
oldPackages.forEach(name => {
  if (pkg.dependencies?.[name]) {
    delete pkg.dependencies[name];
    removed++;
  }
  if (pkg.devDependencies?.[name]) {
    delete pkg.devDependencies[name];
    removed++;
  }
});

if (pkg.devDependencies?.['springboard-cli']) {
  delete pkg.devDependencies['springboard-cli'];
  removed++;
}

// Update springboard
pkg.dependencies.springboard = version;

// Write back
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log(`✓ Updated to springboard@${version}`);
console.log(`✓ Removed ${removed} old package references`);
EOFJS

node /tmp/update-songdrive-deps.js "$SPRINGBOARD_VERSION"

# Show changes
echo ""
echo "Dependency changes:"
git diff package.json | grep -E "^\+|^-" | grep -E "springboard|@springboardjs" || echo "(no changes - may already be updated)"
```

---

## Step 6: Update ALL Import Statements

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Create comprehensive update script (cross-platform compatible)
cat > /tmp/update-imports.sh << 'EOFSH'
#!/bin/bash
set -e

# Detect OS for sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE="sed -i ''"
else
  SED_INPLACE="sed -i"
fi

# Find all TS/TSX files (including build/, apps/, tests/, db/, entrypoints/)
FILES=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -type f)

FILE_COUNT=$(echo "$FILES" | wc -l | tr -d ' ')
echo "Updating imports in $FILE_COUNT files..."

# Function to update imports
update_imports() {
  local pattern_old="$1"
  local pattern_new="$2"
  local desc="$3"

  echo "  - $desc"

  # Single quotes
  echo "$FILES" | xargs $SED_INPLACE "s|from '$pattern_old|from '$pattern_new|g"
  # Double quotes
  echo "$FILES" | xargs $SED_INPLACE "s|from \"$pattern_old|from \"$pattern_new|g"
}

# Update all old imports
update_imports "springboard-server/src/register" "springboard/server/register" "springboard-server/src/register"
update_imports "springboard-server/" "springboard/server/" "springboard-server/*"
update_imports "@springboardjs/platforms-node" "springboard/platforms/node" "@springboardjs/platforms-node"
update_imports "@springboardjs/platforms-browser" "springboard/platforms/browser" "@springboardjs/platforms-browser"
update_imports "@springboardjs/platforms-cf-workers" "springboard/platforms/cloudflare-workers" "@springboardjs/platforms-cf-workers"
update_imports "@springboardjs/platforms-react-native" "springboard/platforms/react-native" "@springboardjs/platforms-react-native"
update_imports "@springboardjs/data-storage" "springboard/data-storage" "@springboardjs/data-storage"

echo "✓ Import updates complete"
EOFSH

chmod +x /tmp/update-imports.sh
/tmp/update-imports.sh

# Verify no old imports remain
echo ""
echo "Checking for remaining old imports..."

OLD_IMPORTS=0

if rg "from ['\"]springboard-server" . --type ts --type tsx 2>/dev/null; then
  echo "❌ Found springboard-server imports"
  OLD_IMPORTS=$((OLD_IMPORTS + 1))
fi

if rg "from ['\"]@springboardjs" . --type ts --type tsx 2>/dev/null; then
  echo "❌ Found @springboardjs imports"
  OLD_IMPORTS=$((OLD_IMPORTS + 1))
fi

if [ $OLD_IMPORTS -eq 0 ]; then
  echo "✓ No old imports found"
else
  echo ""
  echo "⚠ Found old imports - manual review needed"
fi

# Show sample of changes
echo ""
echo "Sample of changes made:"
git diff | grep "^[-+].*from ['\"]" | head -20
```

---

## Step 7: Install Dependencies

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Clean install
echo "Cleaning node_modules and lockfile..."
rm -rf node_modules pnpm-lock.yaml

# Install from Verdaccio
echo "Installing dependencies..."
pnpm install 2>&1 | tee /tmp/pnpm-install.log

if [ $? -ne 0 ]; then
  echo "❌ pnpm install failed"
  tail -50 /tmp/pnpm-install.log
  exit 1
fi

# Verify springboard installed correctly
echo ""
echo "Verifying springboard installation..."

EXPECTED_DIRS=(
  "node_modules/springboard/dist/server"
  "node_modules/springboard/dist/platforms"
  "node_modules/springboard/dist/cli"
  "node_modules/springboard/dist/vite-plugin"
  "node_modules/springboard/dist/core"
  "node_modules/springboard/dist/data-storage"
)

ALL_GOOD=true
for dir in "${EXPECTED_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    FILE_COUNT=$(find "$dir" -name "*.js" | wc -l | tr -d ' ')
    echo "✓ $dir ($FILE_COUNT JS files)"
  else
    echo "❌ MISSING: $dir"
    ALL_GOOD=false
  fi
done

if [ "$ALL_GOOD" != "true" ]; then
  echo ""
  echo "❌ Springboard installation incomplete"
  echo "Check if export map is correct and package was published properly"
  exit 1
fi

echo ""
echo "✓ Dependencies installed successfully"
```

---

## Step 8: TypeScript Validation

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

echo "Running TypeScript type check..."
npm run check-types 2>&1 | tee /tmp/typecheck.log

ERROR_COUNT=$(grep -c "error TS" /tmp/typecheck.log || echo "0")

if [ "$ERROR_COUNT" -eq "0" ]; then
  echo "✓ Type check passed (0 errors)"
else
  echo "❌ Type check failed ($ERROR_COUNT errors)"
  echo ""
  echo "First 20 errors:"
  grep "error TS" /tmp/typecheck.log | head -20
  echo ""
  echo "Common fixes:"
  echo "  1. Missing export in springboard package.json"
  echo "  2. Type definition not generated (.d.ts file missing)"
  echo "  3. Import path still using old pattern"
  echo "  4. Type changed in migration (review manually)"
  exit 1
fi
```

---

## Step 9: Build Validation

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

echo "Cleaning previous build..."
rm -rf dist/

echo "Building all platforms..."
npm run build 2>&1 | tee /tmp/songdrive-build.log

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  echo ""
  echo "Last 50 lines:"
  tail -50 /tmp/songdrive-build.log
  exit 1
fi

# Verify outputs
echo ""
echo "Verifying build outputs..."

EXPECTED_BUILDS=(
  "dist/browser"
  "dist/node"
)

for build in "${EXPECTED_BUILDS[@]}"; do
  if [ -d "$build" ]; then
    SIZE=$(du -sh "$build" | cut -f1)
    echo "✓ $build ($SIZE)"
  else
    echo "⚠ Missing: $build (may be optional)"
  fi
done

# Check critical files
CRITICAL_FILES=(
  "dist/browser/index.html"
  "dist/node/dist/index.js"
)

for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "❌ MISSING: $file"
    exit 1
  fi
done

echo ""
echo "✓ Build completed successfully"
```

---

## Step 10: Runtime Validation

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Ensure .env exists
touch .env
source .env

echo "Starting server..."
npm run run-ws-server > /tmp/songdrive-server.log 2>&1 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting for startup (10s)..."
sleep 10

# Check if still running
if ! ps -p $SERVER_PID > /dev/null; then
  echo "❌ Server failed to start"
  echo ""
  cat /tmp/songdrive-server.log
  exit 1
fi

echo "✓ Server started"

# Determine port
PORT=${PORT:-3000}

# Test endpoints
echo ""
echo "Testing endpoints on port $PORT..."

# KV endpoint
if curl -sf http://localhost:$PORT/kv/get-all > /dev/null; then
  echo "✓ KV endpoint (/kv/get-all)"
else
  echo "❌ KV endpoint failed"
fi

# RPC endpoint
if curl -sf -X POST http://localhost:$PORT/rpc/test \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}' > /dev/null; then
  echo "✓ RPC endpoint (/rpc/test)"
else
  echo "⚠ RPC endpoint (may require specific method)"
fi

# Stop server
echo ""
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null || true
sleep 2

# Check for crashes in log
if grep -qi "error" /tmp/songdrive-server.log | head -5; then
  echo "⚠ Errors found in server log:"
  grep -i "error" /tmp/songdrive-server.log | head -5
fi

echo "✓ Runtime validation complete"
```

---

## Step 11: Unit Tests

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

echo "Running unit tests..."
npm test 2>&1 | tee /tmp/test.log

# Parse results
PASSED=$(grep -oE "[0-9]+ passed" /tmp/test.log | grep -oE "[0-9]+" || echo "0")
FAILED=$(grep -oE "[0-9]+ failed" /tmp/test.log | grep -oE "[0-9]+" || echo "0")

echo ""
if [ "$FAILED" -eq "0" ]; then
  echo "✓ All tests passed ($PASSED passed)"
else
  echo "❌ Tests failed ($FAILED failed, $PASSED passed)"
  echo ""
  echo "Failed tests:"
  grep -A3 "FAIL" /tmp/test.log | head -30
  exit 1
fi
```

---

## Step 12: Full CI Pipeline

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

echo "Running full CI pipeline..."
echo "This includes: build all platforms, type check, tests, docker build"
echo ""

npm run ci 2>&1 | tee /tmp/ci.log

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================="
  echo "✓ CI PASSED"
  echo "========================================="
else
  echo ""
  echo "========================================="
  echo "❌ CI FAILED"
  echo "========================================="
  echo ""
  echo "Last 100 lines:"
  tail -100 /tmp/ci.log
  exit 1
fi
```

---

## Cleanup

### If All Tests Pass

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

echo "Committing changes..."

# Stage all changes
git add package.json .npmrc pnpm-lock.yaml
git add src/ apps/ build/ tests/ db/ entrypoints/ modules/

# Commit
git commit -m "Migrate to single-package springboard

- Remove springboard-server, @springboardjs/platforms-*, springboard-cli
- Update all imports to use springboard/* paths
- Install from Verdaccio local registry
- All tests passing"

echo "✓ Changes committed"

# Clean up backups (keep one recent)
ls -t package.json.backup.* | tail -n +2 | xargs rm -f 2>/dev/null || true
ls -t pnpm-lock.yaml.backup.* | tail -n +2 | xargs rm -f 2>/dev/null || true

echo "✓ Old backups cleaned"
```

### If Tests Fail

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

echo "Restoring from backup..."

# Find most recent backup
BACKUP=$(ls -t package.json.backup.* | head -1)
LOCKFILE_BACKUP=$(ls -t pnpm-lock.yaml.backup.* | head -1)

if [ -f "$BACKUP" ]; then
  cp "$BACKUP" package.json
  echo "✓ Restored package.json"
fi

if [ -f "$LOCKFILE_BACKUP" ]; then
  cp "$LOCKFILE_BACKUP" pnpm-lock.yaml
  echo "✓ Restored pnpm-lock.yaml"
fi

# Remove .npmrc
rm .npmrc

# Restore imports
git checkout src/ apps/ build/ tests/ db/ entrypoints/ modules/

# Reinstall original deps
pnpm install

echo "✓ Restored to pre-migration state"
```

### Stop Verdaccio

```bash
if [ -f /tmp/verdaccio.pid ]; then
  VERDACCIO_PID=$(cat /tmp/verdaccio.pid)
  kill $VERDACCIO_PID 2>/dev/null || true
  rm /tmp/verdaccio.pid
  echo "✓ Verdaccio stopped"
fi

# Or forcefully
pkill verdaccio
```

---

## Complete Automated Script

Run everything with one command:

```bash
cat > /tmp/run-integration-test.sh << 'EOFSCRIPT'
#!/bin/bash
set -e

SPRINGBOARD_DIR="/private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard"
SONGDRIVE_DIR="/Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor"

echo "========================================="
echo "Springboard Integration Test"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v verdaccio &> /dev/null; then
  echo "❌ Verdaccio not installed"
  echo "Run: npm install -g verdaccio"
  exit 1
fi

if [ ! -f "$SPRINGBOARD_DIR/src/vite-plugin/build-runner.ts" ]; then
  echo "❌ Phase 8 incomplete (build-runner.ts missing)"
  exit 1
fi

if [ ! -d "$SONGDRIVE_DIR" ]; then
  echo "❌ Songdrive repo not found at $SONGDRIVE_DIR"
  exit 1
fi

echo "✓ Prerequisites met"

# Run each step
cd "$(dirname "$0")"

bash /tmp/test-springboard-integration.sh

EOFSCRIPT

chmod +x /tmp/run-integration-test.sh

# To execute:
# /tmp/run-integration-test.sh
```

---

## Troubleshooting

### Export not found

**Symptom**: `Cannot find module 'springboard/server/register'`

**Fix**:
```bash
cd packages/springboard

# Regenerate exports
node scripts/generate-exports.js

# Check specific export
cat package.json | jq '.exports."./server/register"'

# Rebuild and republish
pnpm run build:all
npm publish --registry http://localhost:4873
```

### Type errors after migration

**Symptom**: TypeScript errors in Songdrive

**Common causes**:
1. Export missing from package.json
2. `.d.ts` file not generated
3. Type changed in migration

**Fix**:
```bash
# Check what's exported
cat node_modules/springboard/package.json | jq '.exports | keys'

# Check if .d.ts exists
ls node_modules/springboard/dist/server/*.d.ts

# If missing, check springboard build
cd packages/springboard
pnpm run build:all
ls -la dist/server/*.d.ts
```

### Build fails with module error

**Symptom**: Songdrive build fails finding module

**Fix**:
```bash
# Test import resolution
node -e "console.log(require.resolve('springboard/server/register'))"

# Check node_modules structure
ls -la node_modules/springboard/dist/

# Reinstall if structure wrong
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor
rm -rf node_modules/springboard
pnpm install
```

---

## Success Criteria

All of these must pass:

- [x] Verdaccio starts
- [x] Springboard builds (core, server, platforms, cli, vite-plugin)
- [x] Export map contains all required paths
- [x] Package publishes to Verdaccio
- [x] Songdrive dependencies update
- [x] All imports rewritten (no old patterns remain)
- [x] TypeScript compiles with 0 errors
- [x] Songdrive builds all platforms
- [x] Node server starts and responds
- [x] Unit tests pass
- [x] Full CI pipeline passes

---

**Document Version**: 1.0 (Canonical, unified)
**Last Updated**: 2026-01-03
**Estimated Time**: 45-60 minutes
**OS**: macOS (notes for Linux included)
