# Verdaccio Testing Procedure for Songdrive Integration

**Date**: 2026-01-03
**Goal**: Test migrated springboard package with Songdrive using local Verdaccio registry

---

## Prerequisites

1. **Verdaccio installed**: `npm install -g verdaccio`
2. **Clean build environment**: No stale builds or links
3. **Songdrive repo**: Available at `_debug/songdrive`

---

## Step 1: Start Verdaccio Registry

```bash
# Start Verdaccio (will run on http://localhost:4873)
verdaccio
```

**Keep this terminal open** - Verdaccio needs to run during testing.

Open a new terminal for the remaining steps.

---

## Step 2: Configure npm/pnpm for Verdaccio

### Option A: Temporary (recommended for testing)

```bash
# Set registry for this session
export npm_config_registry=http://localhost:4873

# Or for pnpm
pnpm config set registry http://localhost:4873
```

### Option B: Project-specific

Create `.npmrc` in springboard package:
```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard

cat > .npmrc << 'EOF'
registry=http://localhost:4873
EOF
```

---

## Step 3: Build Springboard Package

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree

# Clean any previous builds
rm -rf packages/springboard/dist

# Build package
pnpm -C packages/springboard build

# Verify build outputs
ls -la packages/springboard/dist/
ls -la packages/springboard/dist/server/
ls -la packages/springboard/dist/platforms/
ls -la packages/springboard/dist/cli/
ls -la packages/springboard/dist/vite-plugin/
```

**Expected**: All directories exist with `.js` and `.d.ts` files

---

## Step 4: Verify Package Configuration

```bash
cd packages/springboard

# Check package.json essentials
cat package.json | jq '{name, version, main, types, exports: .exports | keys}'

# Verify export map has required paths
cat package.json | jq '.exports | keys' | grep -E "(server|platforms|cli|vite-plugin)"
```

**Expected**:
- Name: `springboard`
- Version: Current version number
- Exports include: `./server/*`, `./platforms/*`, `./cli`, `./vite-plugin`

---

## Step 5: Create Temporary tarball (for debugging)

```bash
cd packages/springboard

# Create tarball
npm pack

# This creates: springboard-<version>.tgz
ls -lh *.tgz

# Inspect contents (optional)
tar -tzf springboard-*.tgz | head -20
```

**Expected**: Tarball contains `package/dist/` with all built files

---

## Step 6: Publish to Verdaccio

```bash
cd packages/springboard

# Publish to local registry
npm publish --registry http://localhost:4873

# Should see output like:
# + springboard@0.15.40
```

**Expected**: Success message with version number

### Troubleshooting

If publish fails with authentication error:
```bash
# Create a Verdaccio user
npm adduser --registry http://localhost:4873

# Username: test
# Password: test
# Email: test@test.com

# Then retry publish
npm publish --registry http://localhost:4873
```

---

## Step 7: Verify Package in Verdaccio

```bash
# Check package info
npm view springboard --registry http://localhost:4873

# Should show:
# - Latest version
# - Dist files
# - Dependencies

# Check specific export paths
npm view springboard exports --registry http://localhost:4873
```

**Expected**: Package info displays correctly

---

## Step 8: Update Songdrive Dependencies

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/_debug/songdrive

# Backup current package.json
cp package.json package.json.backup
```

### 8.1 Edit package.json

Remove these dependencies:
```json
{
  "dependencies": {
    // REMOVE:
    "springboard-server": "catalog:",
    "@springboardjs/data-storage": "catalog:",
    "@springboardjs/platforms-browser": "catalog:",
    "@springboardjs/platforms-cf-workers": "catalog:",
    "@springboardjs/platforms-node": "catalog:",
    "@springboardjs/platforms-react-native": "catalog:"
  },
  "devDependencies": {
    // REMOVE:
    "springboard-cli": "catalog:"
  }
}
```

Keep only:
```json
{
  "dependencies": {
    "springboard": "^0.15.40"  // Use actual version from Step 6
  }
}
```

### 8.2 Configure Verdaccio Registry for Songdrive

Create `.npmrc` in Songdrive root:
```bash
cd _debug/songdrive

cat > .npmrc << 'EOF'
registry=http://localhost:4873
EOF
```

### 8.3 Install Dependencies

```bash
# Clear node_modules and lockfile (fresh install)
rm -rf node_modules pnpm-lock.yaml

# Install from Verdaccio
pnpm install

# Verify springboard was installed from local registry
ls -la node_modules/springboard/dist/
```

**Expected**:
- `node_modules/springboard/` exists
- Contains `dist/` with server, platforms, cli, vite-plugin

---

## Step 9: Update Import Statements

### 9.1 Automated Replacement

```bash
cd _debug/songdrive

# springboard-server → springboard/server
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  "s|from 'springboard-server/src/register'|from 'springboard/server/register'|g" {} +

# @springboardjs/platforms-node → springboard/platforms/node
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  "s|from '@springboardjs/platforms-node|from 'springboard/platforms/node|g" {} +

# @springboardjs/platforms-browser → springboard/platforms/browser
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  "s|from '@springboardjs/platforms-browser|from 'springboard/platforms/browser|g" {} +

# @springboardjs/platforms-cf-workers → springboard/platforms/cloudflare-workers
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  "s|from '@springboardjs/platforms-cf-workers|from 'springboard/platforms/cloudflare-workers|g" {} +

# @springboardjs/platforms-react-native → springboard/platforms/react-native
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  "s|from '@springboardjs/platforms-react-native|from 'springboard/platforms/react-native|g" {} +

# @springboardjs/data-storage → springboard/data-storage
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  "s|from '@springboardjs/data-storage|from 'springboard/data-storage|g" {} +
```

### 9.2 Verify Changes

```bash
# Check for remaining old imports
echo "Checking for springboard-server imports:"
rg "from ['\"]springboard-server" src/ || echo "✓ None found"

echo "Checking for @springboardjs imports:"
rg "from ['\"]@springboardjs" src/ || echo "✓ None found"

# Show what was changed
git diff src/ | grep "from '" | head -20
```

**Expected**: No old import patterns remain

---

## Step 10: TypeScript Validation

```bash
cd _debug/songdrive

# Run type checker
npm run check-types 2>&1 | tee typecheck.log

# Check for errors
if grep -q "error TS" typecheck.log; then
  echo "❌ Type errors found"
  grep "error TS" typecheck.log | head -10
else
  echo "✓ No type errors"
fi
```

**Expected**: Zero TypeScript errors

### Common Issues

**Issue**: Cannot find module 'springboard/server/register'

**Fix**:
```bash
# Check if path exists in node_modules
ls -la node_modules/springboard/dist/server/register.js
ls -la node_modules/springboard/dist/server/register.d.ts

# Check package.json exports
cat node_modules/springboard/package.json | jq '.exports."./server/register"'

# If missing, republish springboard with correct exports
```

---

## Step 11: Build Validation

```bash
cd _debug/songdrive

# Clean previous builds
rm -rf dist/

# Build all platforms
npm run build 2>&1 | tee build.log

# Check exit code
if [ $? -eq 0 ]; then
  echo "✓ Build succeeded"
else
  echo "❌ Build failed"
  tail -50 build.log
fi
```

**Expected**: Build succeeds, all platform outputs created

### Verify Outputs

```bash
# Check dist structure
ls -la dist/
ls -la dist/browser/
ls -la dist/node/
ls -la dist/server/ 2>/dev/null || echo "(server build may be optional)"

# Verify key files
test -f dist/browser/index.html && echo "✓ Browser index.html"
test -f dist/node/dist/index.js && echo "✓ Node server"
```

---

## Step 12: Runtime Testing

### 12.1 Start Node Server

```bash
cd _debug/songdrive

# Set environment
touch .env
source .env

# Start server
npm run run-ws-server &
SERVER_PID=$!

# Wait for startup
sleep 5

# Check if running
if ps -p $SERVER_PID > /dev/null; then
  echo "✓ Server started (PID: $SERVER_PID)"
else
  echo "❌ Server failed to start"
fi
```

### 12.2 Test Endpoints

```bash
# Test KV endpoint
curl -s http://localhost:3000/kv/get-all | jq '.' || echo "❌ KV endpoint failed"

# Test RPC endpoint
curl -s -X POST http://localhost:3000/rpc/test \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}' \
  | jq '.' || echo "❌ RPC endpoint failed"

# Stop server
kill $SERVER_PID
```

**Expected**: Both endpoints return valid JSON

---

## Step 13: Test Suite

```bash
cd _debug/songdrive

# Run unit tests
npm test 2>&1 | tee test.log

# Check results
if grep -q "FAIL" test.log; then
  echo "❌ Some tests failed"
  grep "FAIL" test.log
else
  echo "✓ All tests passed"
fi
```

**Expected**: All tests pass

---

## Step 14: Full CI Validation

```bash
cd _debug/songdrive

# Run full CI pipeline
npm run ci 2>&1 | tee ci.log

# This runs:
# - Build all platforms
# - Type checking
# - Unit tests
# - Docker build

# Check overall result
if [ $? -eq 0 ]; then
  echo "✓ CI passed"
else
  echo "❌ CI failed"
  tail -100 ci.log
fi
```

**Expected**: CI passes completely

---

## Step 15: Cleanup and Reset

### If Testing Succeeds

```bash
# Keep changes, commit
cd _debug/songdrive
git add package.json .npmrc src/
git commit -m "Migrate to single-package springboard"
```

### If Testing Fails

```bash
# Restore backup
cd _debug/songdrive
cp package.json.backup package.json
rm .npmrc

# Reinstall original dependencies
pnpm install

# Reset imports
git checkout src/
```

### Stop Verdaccio

```bash
# In the Verdaccio terminal, press Ctrl+C

# Or if running as background process
pkill verdaccio
```

### Clear Verdaccio Storage (optional)

```bash
# Remove Verdaccio data
rm -rf ~/.local/share/verdaccio/storage/springboard
```

---

## Troubleshooting Guide

### Build Fails

**Symptom**: `npm run build` fails with module errors

**Debug**:
```bash
# Check imports resolve
node -e "console.log(require.resolve('springboard/server/register'))"

# Check if files exist
ls -la node_modules/springboard/dist/server/register.*

# Verify exports
cat node_modules/springboard/package.json | jq '.exports."./server/register"'
```

**Fix**: Republish springboard with correct export map

### Type Errors

**Symptom**: TypeScript can't find types

**Debug**:
```bash
# Check .d.ts files
ls -la node_modules/springboard/dist/**/*.d.ts | head -10

# Check types field in exports
cat node_modules/springboard/package.json | jq '.exports."./server/register".types'
```

**Fix**: Ensure tsconfig.build.json includes all files

### Runtime Errors

**Symptom**: Server crashes on startup

**Debug**:
```bash
# Run with more logging
NODE_DEBUG=module npm run run-ws-server

# Check for import errors
node dist/node/dist/index.js 2>&1 | grep -i error
```

**Fix**: Check import paths in generated files

---

## Success Checklist

- [ ] Verdaccio running
- [ ] Springboard built successfully
- [ ] Springboard published to Verdaccio
- [ ] Songdrive dependencies updated
- [ ] Import statements updated
- [ ] TypeScript compiles with zero errors
- [ ] All platform builds succeed
- [ ] Unit tests pass
- [ ] Node server starts without errors
- [ ] Endpoints respond correctly
- [ ] Full CI pipeline passes

---

## Next Steps After Success

1. **Document changes**: Create migration guide for Songdrive
2. **Update catalog**: Update pnpm catalog with new springboard version
3. **Publish to npm**: Publish springboard to public npm registry
4. **Update CI**: Configure CI to use new package structure
5. **Announce**: Notify team of breaking changes

---

## Quick Reference Commands

```bash
# Start Verdaccio
verdaccio

# Build and publish springboard
cd packages/springboard
pnpm build
npm publish --registry http://localhost:4873

# Update and test Songdrive
cd ../../_debug/songdrive
# (edit package.json)
pnpm install
npm run check-types
npm run build
npm test
npm run ci

# Stop Verdaccio
pkill verdaccio
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-03
**Estimated Time**: 30-60 minutes for full procedure
