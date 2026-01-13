# Verdaccio Testing - Executable Plan

**Date**: 2026-01-03
**Goal**: Test migrated springboard with Songdrive using Verdaccio
**Songdrive Location**: `/Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor`

---

## Prerequisites

1. Verdaccio installed: `npm install -g verdaccio`
2. Clean build environment
3. Songdrive repo at the path above

---

## Step 1: Start Verdaccio

```bash
# Start Verdaccio in background
verdaccio &

# Save PID for cleanup later
echo $! > /tmp/verdaccio.pid

# Wait for startup
sleep 3

# Verify it's running
curl -s http://localhost:4873 | grep -q "verdaccio" && echo "✓ Verdaccio running"
```

---

## Step 2: Add Build Scripts to Springboard

Update `packages/springboard/package.json` to add unified build scripts:

```json
{
  "scripts": {
    "build:all": "pnpm run prebuild && pnpm run build && pnpm run build:cli && pnpm run build:vite-plugin",
    "publish:local": "pnpm run build:all && npm publish --registry http://localhost:4873"
  }
}
```

---

## Step 3: Build and Publish Springboard

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard

# Clean
rm -rf dist/

# Build everything with one command
pnpm run build:all

# Verify all outputs
echo "Checking build outputs..."
test -d dist/core && echo "✓ dist/core"
test -d dist/server && echo "✓ dist/server"
test -d dist/platforms && echo "✓ dist/platforms"
test -d dist/cli && echo "✓ dist/cli"
test -d dist/vite-plugin && echo "✓ dist/vite-plugin"

# Publish to Verdaccio
pnpm run publish:local
```

**If publish fails with auth error**:
```bash
npm adduser --registry http://localhost:4873
# Username: test
# Password: test
# Email: test@test.com
```

**Verify publication**:
```bash
npm view springboard --registry http://localhost:4873
```

---

## Step 4: Prepare Songdrive Directory

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Backup current state
git stash
cp package.json package.json.backup
cp pnpm-lock.yaml pnpm-lock.yaml.backup 2>/dev/null || true

# Configure Verdaccio registry
cat > .npmrc << 'EOF'
registry=http://localhost:4873
EOF
```

---

## Step 5: Update Songdrive package.json

Edit `package.json` manually or use this script:

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Create a script to update package.json
cat > /tmp/update-songdrive-deps.js << 'EOF'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Get springboard version from Verdaccio
const { execSync } = require('child_process');
const version = execSync('npm view springboard version --registry http://localhost:4873', {encoding: 'utf8'}).trim();

// Remove old packages
const oldPackages = [
  'springboard-server',
  '@springboardjs/data-storage',
  '@springboardjs/platforms-browser',
  '@springboardjs/platforms-cf-workers',
  '@springboardjs/platforms-node',
  '@springboardjs/platforms-react-native'
];

oldPackages.forEach(name => {
  delete pkg.dependencies?.[name];
  delete pkg.devDependencies?.[name];
});

delete pkg.devDependencies?.['springboard-cli'];

// Update springboard to specific version
pkg.dependencies.springboard = version;

// Write back
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ Updated to springboard@${version}`);
console.log(`✓ Removed ${oldPackages.length + 1} old packages`);
EOF

node /tmp/update-songdrive-deps.js
```

**Or manually edit package.json**:

Remove these from `dependencies`:
- `springboard-server`
- `@springboardjs/data-storage`
- `@springboardjs/platforms-browser`
- `@springboardjs/platforms-cf-workers`
- `@springboardjs/platforms-node`
- `@springboardjs/platforms-react-native`

Remove from `devDependencies`:
- `springboard-cli`

Update:
```json
{
  "dependencies": {
    "springboard": "^0.15.40"
  }
}
```

---

## Step 6: Update All Import Statements

Songdrive has code in multiple directories (not just `src/`). Update ALL TypeScript files:

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Create comprehensive update script
cat > /tmp/update-imports.sh << 'EOF'
#!/bin/bash
set -e

# Find all TS/TSX files (excluding node_modules and dist)
FILES=$(find . \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/.next/*" \
  -not -path "*/build/*")

echo "Updating imports in $(echo "$FILES" | wc -l) files..."

# Update springboard-server imports
echo "$FILES" | xargs sed -i '' \
  "s|from 'springboard-server/src/register'|from 'springboard/server/register'|g"
echo "$FILES" | xargs sed -i '' \
  "s|from \"springboard-server/src/register\"|from \"springboard/server/register\"|g"

# Update @springboardjs/platforms-node
echo "$FILES" | xargs sed -i '' \
  "s|from '@springboardjs/platforms-node|from 'springboard/platforms/node|g"
echo "$FILES" | xargs sed -i '' \
  "s|from \"@springboardjs/platforms-node|from \"springboard/platforms/node|g"

# Update @springboardjs/platforms-browser
echo "$FILES" | xargs sed -i '' \
  "s|from '@springboardjs/platforms-browser|from 'springboard/platforms/browser|g"
echo "$FILES" | xargs sed -i '' \
  "s|from \"@springboardjs/platforms-browser|from \"springboard/platforms/browser|g"

# Update @springboardjs/platforms-cf-workers
echo "$FILES" | xargs sed -i '' \
  "s|from '@springboardjs/platforms-cf-workers|from 'springboard/platforms/cloudflare-workers|g"
echo "$FILES" | xargs sed -i '' \
  "s|from \"@springboardjs/platforms-cf-workers|from \"springboard/platforms/cloudflare-workers|g"

# Update @springboardjs/platforms-react-native
echo "$FILES" | xargs sed -i '' \
  "s|from '@springboardjs/platforms-react-native|from 'springboard/platforms/react-native|g"
echo "$FILES" | xargs sed -i '' \
  "s|from \"@springboardjs/platforms-react-native|from \"springboard/platforms/react-native|g"

# Update @springboardjs/data-storage
echo "$FILES" | xargs sed -i '' \
  "s|from '@springboardjs/data-storage|from 'springboard/data-storage|g"
echo "$FILES" | xargs sed -i '' \
  "s|from \"@springboardjs/data-storage|from \"springboard/data-storage|g"

echo "✓ Import updates complete"
EOF

chmod +x /tmp/update-imports.sh
/tmp/update-imports.sh
```

**Verify changes**:
```bash
# Check for remaining old imports
echo "Checking for springboard-server:"
rg "from ['\"]springboard-server" . --type ts 2>/dev/null || echo "✓ None found"

echo "Checking for @springboardjs:"
rg "from ['\"]@springboardjs" . --type ts 2>/dev/null || echo "✓ None found"

# Show sample of changes
git diff | grep "from '" | head -20
```

---

## Step 7: Install Dependencies

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Clean install
rm -rf node_modules pnpm-lock.yaml

# Install from Verdaccio
pnpm install

# Verify springboard installed correctly
echo "Checking springboard installation:"
ls -la node_modules/springboard/dist/ | head -10
test -d node_modules/springboard/dist/server && echo "✓ server"
test -d node_modules/springboard/dist/platforms && echo "✓ platforms"
test -d node_modules/springboard/dist/cli && echo "✓ cli"
test -d node_modules/springboard/dist/vite-plugin && echo "✓ vite-plugin"
```

---

## Step 8: TypeScript Validation

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Run type check
npm run check-types 2>&1 | tee /tmp/typecheck.log

# Analyze results
if grep -q "error TS" /tmp/typecheck.log; then
  echo "❌ Type errors found:"
  grep "error TS" /tmp/typecheck.log | head -20
  exit 1
else
  echo "✓ Type check passed"
fi
```

---

## Step 9: Build Test

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Clean
rm -rf dist/

# Build
npm run build 2>&1 | tee /tmp/build.log

if [ $? -eq 0 ]; then
  echo "✓ Build succeeded"

  # Check outputs
  echo "Build outputs:"
  ls -lh dist/ 2>/dev/null || echo "(no dist/)"
  ls -lh dist/*/ 2>/dev/null | head -20
else
  echo "❌ Build failed"
  tail -100 /tmp/build.log
  exit 1
fi
```

---

## Step 10: Runtime Test

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Start server in background
npm run run-ws-server > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for startup
sleep 10

# Check if still running
if ps -p $SERVER_PID > /dev/null; then
  echo "✓ Server started"

  # Test endpoints (adjust port if needed)
  PORT=${PORT:-3000}

  echo "Testing endpoints..."
  curl -s http://localhost:$PORT/kv/get-all > /dev/null && echo "✓ KV endpoint" || echo "❌ KV endpoint"
  curl -s -X POST http://localhost:$PORT/rpc/test \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}' > /dev/null && \
    echo "✓ RPC endpoint" || echo "❌ RPC endpoint"

  # Stop server
  kill $SERVER_PID
  sleep 2
else
  echo "❌ Server failed to start"
  cat /tmp/server.log
  exit 1
fi
```

---

## Step 11: Run Tests

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Run tests
npm test 2>&1 | tee /tmp/test.log

if grep -q "FAIL" /tmp/test.log; then
  echo "❌ Tests failed"
  grep -A5 "FAIL" /tmp/test.log | head -30
  exit 1
else
  echo "✓ Tests passed"
fi
```

---

## Step 12: Full CI Validation

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Run full CI
npm run ci 2>&1 | tee /tmp/ci.log

if [ $? -eq 0 ]; then
  echo "✓ CI passed"
else
  echo "❌ CI failed"
  tail -100 /tmp/ci.log
  exit 1
fi
```

---

## Complete Automated Script

Here's a single script that runs everything:

```bash
cat > /tmp/test-springboard-integration.sh << 'EOF'
#!/bin/bash
set -e

SPRINGBOARD_DIR="/private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard"
SONGDRIVE_DIR="/Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor"

echo "========================================="
echo "Springboard + Songdrive Integration Test"
echo "========================================="

# 1. Start Verdaccio
echo ""
echo "Step 1: Starting Verdaccio..."
pkill verdaccio 2>/dev/null || true
verdaccio > /tmp/verdaccio.log 2>&1 &
sleep 5
curl -s http://localhost:4873 | grep -q "verdaccio" && echo "✓ Verdaccio running" || (echo "❌ Verdaccio failed"; exit 1)

# 2. Build and publish springboard
echo ""
echo "Step 2: Building and publishing springboard..."
cd "$SPRINGBOARD_DIR"
rm -rf dist/
pnpm run build:all || (echo "❌ Build failed"; exit 1)
npm publish --registry http://localhost:4873 2>&1 | grep -E "(published|already exists)" && echo "✓ Published" || (echo "❌ Publish failed"; exit 1)

# 3. Backup Songdrive
echo ""
echo "Step 3: Backing up Songdrive state..."
cd "$SONGDRIVE_DIR"
cp package.json package.json.backup
cp pnpm-lock.yaml pnpm-lock.yaml.backup 2>/dev/null || true
echo "✓ Backup created"

# 4. Configure registry
echo ""
echo "Step 4: Configuring Verdaccio registry..."
echo "registry=http://localhost:4873" > .npmrc
echo "✓ Registry configured"

# 5. Update dependencies
echo ""
echo "Step 5: Updating package.json..."
node /tmp/update-songdrive-deps.js
echo "✓ Dependencies updated"

# 6. Update imports
echo ""
echo "Step 6: Updating imports..."
bash /tmp/update-imports.sh
echo "✓ Imports updated"

# 7. Install dependencies
echo ""
echo "Step 7: Installing dependencies..."
rm -rf node_modules pnpm-lock.yaml
pnpm install
test -d node_modules/springboard/dist/server && echo "✓ Dependencies installed" || (echo "❌ Install failed"; exit 1)

# 8. Type check
echo ""
echo "Step 8: Type checking..."
npm run check-types && echo "✓ Type check passed" || (echo "❌ Type errors"; exit 1)

# 9. Build
echo ""
echo "Step 9: Building Songdrive..."
rm -rf dist/
npm run build && echo "✓ Build succeeded" || (echo "❌ Build failed"; exit 1)

# 10. Test
echo ""
echo "Step 10: Running tests..."
npm test && echo "✓ Tests passed" || (echo "❌ Tests failed"; exit 1)

# 11. CI
echo ""
echo "Step 11: Running CI..."
npm run ci && echo "✓ CI passed" || (echo "❌ CI failed"; exit 1)

echo ""
echo "========================================="
echo "✓ ALL TESTS PASSED"
echo "========================================="
EOF

chmod +x /tmp/test-springboard-integration.sh
```

**Run the automated script**:
```bash
/tmp/test-springboard-integration.sh
```

---

## Cleanup

### If Tests Pass

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Commit changes
git add package.json .npmrc
git add src/ apps/ build/ tests/ db/ entrypoints/
git commit -m "Migrate to single-package springboard"

# Clean up backups
rm package.json.backup pnpm-lock.yaml.backup
```

### If Tests Fail

```bash
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor

# Restore backups
cp package.json.backup package.json
cp pnpm-lock.yaml.backup pnpm-lock.yaml 2>/dev/null || true
rm .npmrc

# Reinstall original deps
pnpm install

# Reset code changes
git checkout .
```

### Stop Verdaccio

```bash
pkill verdaccio
rm /tmp/verdaccio.pid
```

---

## Quick Reference Commands

```bash
# Build and publish springboard
cd packages/springboard && pnpm run publish:local

# Update Songdrive imports
cd /Users/mickmister/code/songdrive-workspaces/songdrive-springboard-refactor
bash /tmp/update-imports.sh

# Run validation
npm run check-types && npm run build && npm test && npm run ci
```

---

## Troubleshooting

### Issue: Build script doesn't exist

**Fix**: Add to `packages/springboard/package.json`:
```json
{
  "scripts": {
    "build:all": "pnpm run prebuild && pnpm run build && pnpm run build:cli && pnpm run build:vite-plugin",
    "publish:local": "pnpm run build:all && npm publish --registry http://localhost:4873"
  }
}
```

### Issue: Import not found

**Symptom**: `Cannot find module 'springboard/server/register'`

**Fix**:
1. Check export map: `cat node_modules/springboard/package.json | jq '.exports."./server/register"'`
2. Verify file exists: `ls node_modules/springboard/dist/server/register.*`
3. Regenerate exports: `node packages/springboard/scripts/generate-exports.js`
4. Rebuild and republish

### Issue: Type errors

**Symptom**: TypeScript errors about missing types

**Fix**:
1. Check `.d.ts` files exist in dist/
2. Verify `types` field in export map
3. May need to update Songdrive code for new types

---

**Document Version**: 2.0
**Last Updated**: 2026-01-03
**Estimated Time**: 30-60 minutes
