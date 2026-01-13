# Songdrive Integration Testing Plan

**Date**: 2026-01-03
**Status**: Ready for execution
**Goal**: Validate that migrated springboard package works with Songdrive (branch `claude/issue-171-20251003-1828`)

---

## Executive Summary

Songdrive is currently using the **refactor branch package structure** with multiple `@springboardjs/*` packages. We need to test that our single-package migration works correctly by:

1. Publishing the updated springboard packages locally
2. Updating Songdrive dependencies
3. Running Songdrive's build and tests
4. Validating all platforms work

---

## Current Songdrive State

### Location
```bash
/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/_debug/songdrive
```

### Branch
`claude/issue-171-20251003-1828`

### Dependencies (from package.json)

Songdrive uses the **refactor branch multi-package structure**:

```json
{
  "dependencies": {
    "springboard": "catalog:",
    "springboard-server": "catalog:",
    "@springboardjs/data-storage": "catalog:",
    "@springboardjs/platforms-browser": "catalog:",
    "@springboardjs/platforms-cf-workers": "catalog:",
    "@springboardjs/platforms-node": "catalog:",
    "@springboardjs/platforms-react-native": "catalog:"
  },
  "devDependencies": {
    "springboard-cli": "catalog:"
  }
}
```

### Import Patterns Used

From grep analysis, Songdrive imports:
- `springboard` (default import)
- `springboard/engine/module_api` (ModuleAPI, ActionCallOptions)
- `springboard/engine/engine` (useSpringboardEngine)
- `springboard/module_registry/module_registry` (AllModules)
- `springboard/services/states/shared_state_service` (StateSupervisor)
- `springboard-server/src/register` (serverRegistry)
- `@springboardjs/platforms-node/services/node_rpc_async_local_storage` (commented out)

### Build Scripts

Key scripts:
```bash
npm run build                 # Main build
npm run build-desktop         # Tauri build
npm run build-e2e            # E2E test build
npm run check-types          # TypeScript validation
npm test                     # Vitest tests
npm run ci                   # Full CI pipeline
```

### Platform Variants

Uses `SPRINGBOARD_PLATFORM_VARIANT` env var:
- `browser_offline` - Offline browser build
- `main` - Main online browser build
- `all` - All platforms (CI)

---

## Migration Impact Analysis

### What Changed in This Branch

1. **Single Package**: All springboard code in one package
2. **Import Paths**: `springboard-server/*` → `springboard/server/*`
3. **Platform Packages**: `@springboardjs/platforms-*` → `springboard/platforms/*`
4. **Export Structure**: All exports from single `springboard` package

### Required Songdrive Changes

#### 1. Remove Refactor Branch Packages

These packages no longer exist:
- ❌ `springboard-server`
- ❌ `@springboardjs/data-storage`
- ❌ `@springboardjs/platforms-browser`
- ❌ `@springboardjs/platforms-cf-workers`
- ❌ `@springboardjs/platforms-node`
- ❌ `@springboardjs/platforms-react-native`
- ❌ `springboard-cli`

Keep only:
- ✅ `springboard` (single package with everything)
- ✅ `create-springboard-app` (if used)

#### 2. Update Import Statements

**Find and replace** across Songdrive codebase:

```typescript
// OLD (refactor branch)
import {serverRegistry} from 'springboard-server/src/register';
import {nodeRpcAsyncLocalStorage} from '@springboardjs/platforms-node/services/node_rpc_async_local_storage';

// NEW (single package)
import {serverRegistry} from 'springboard/server/register';
import {nodeRpcAsyncLocalStorage} from 'springboard/platforms/node/services/node_rpc_async_local_storage';
```

**Pattern**: Remove `@springboardjs/platforms-*` and `springboard-server`, use `springboard/*` instead.

#### 3. Update esbuild.ts for Multi-Target Builds

Songdrive's `build/esbuild.ts` should migrate to use new Vite multi-target API (from Phase 8).

**Current**: Uses esbuild directly
**Target**: Use springboard Vite plugin multi-target builder

Example migration:
```typescript
// OLD (esbuild-based)
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.tsx'],
  outdir: 'dist/browser',
  platform: 'browser',
  // ... many lines of config
});

// NEW (Vite-based)
import { runBuildTargets, defineTargets, commonLoaders } from 'springboard/vite-plugin';

const targets = defineTargets([
  {
    name: 'browser',
    platform: 'browser',
    entrypoint: './src/index.tsx',
    outDir: './dist/browser',
    plugins: [commonLoaders({ sql: true, fonts: true })],
  },
  // ... other targets
]);

await runBuildTargets(targets);
```

---

## Testing Checklist

### Phase 1: Local Package Publishing

#### 1.1 Build Springboard Package

```bash
cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree

# Clean build
pnpm -C packages/springboard clean || true
pnpm -C packages/springboard build

# Verify outputs
ls -la packages/springboard/dist/
ls -la packages/springboard/dist/server/
ls -la packages/springboard/dist/platforms/node/
ls -la packages/springboard/dist/platforms/browser/
ls -la packages/springboard/dist/cli/
ls -la packages/springboard/dist/vite-plugin/
```

**Expected**: All dist/ outputs exist with .js and .d.ts files

#### 1.2 Verify Export Map

```bash
cat packages/springboard/package.json | jq '.exports' | head -50
```

**Expected**: 43+ exports including:
- `./server/*`
- `./platforms/node/*`
- `./platforms/browser/*`
- `./cli`
- `./vite-plugin`
- `./engine/*`
- `./module_registry/*`

#### 1.3 Publish to Local Verdaccio (Optional)

If using local registry:
```bash
# Start verdaccio
npx verdaccio

# Publish
cd packages/springboard
npm publish --registry http://localhost:4873
```

Or use `pnpm link` for faster testing:
```bash
cd packages/springboard
pnpm link --global

cd ../../_debug/songdrive
pnpm link --global springboard
```

---

### Phase 2: Update Songdrive Dependencies

#### 2.1 Update package.json

Edit `_debug/songdrive/package.json`:

```json
{
  "dependencies": {
    "springboard": "workspace:*",
    // REMOVE these:
    // "springboard-server": "catalog:",
    // "@springboardjs/data-storage": "catalog:",
    // "@springboardjs/platforms-browser": "catalog:",
    // "@springboardjs/platforms-cf-workers": "catalog:",
    // "@springboardjs/platforms-node": "catalog:",
    // "@springboardjs/platforms-react-native": "catalog:"
  },
  "devDependencies": {
    // REMOVE:
    // "springboard-cli": "catalog:"
  }
}
```

#### 2.2 Update Import Statements

```bash
cd _debug/songdrive

# Find all springboard-server imports
rg "from ['\"]springboard-server" src/

# Find all @springboardjs/platforms imports
rg "from ['\"]@springboardjs/platforms" src/

# Replace them with springboard/* imports
```

**Automated replacement** (be careful, review changes):
```bash
# springboard-server → springboard/server
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '\''springboard-server/src/register'\''|from '\''springboard/server/register'\''|g' {} +

# @springboardjs/platforms-node → springboard/platforms/node
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '\''@springboardjs/platforms-node|from '\''springboard/platforms/node|g' {} +

# @springboardjs/platforms-browser → springboard/platforms/browser
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's|from '\''@springboardjs/platforms-browser|from '\''springboard/platforms/browser|g' {} +

# Repeat for other platforms as needed
```

#### 2.3 Reinstall Dependencies

```bash
cd _debug/songdrive
pnpm install
```

---

### Phase 3: TypeScript Validation

#### 3.1 Check Types

```bash
cd _debug/songdrive
npm run check-types
```

**Expected**: No TypeScript errors

**Common Issues**:
- Missing export paths → Update export map in springboard package.json
- Wrong import paths → Fix import statements
- Type mismatches → Check if refactor branch had different types

#### 3.2 Verify Module Resolution

```bash
# Test that imports resolve
node -e "console.log(require.resolve('springboard'))"
node -e "console.log(require.resolve('springboard/server/register'))"
node -e "console.log(require.resolve('springboard/platforms/node/services/ws_server_core_dependencies'))"
```

**Expected**: All resolve successfully

---

### Phase 4: Build Validation

#### 4.1 Clean Build

```bash
cd _debug/songdrive

# Clean
rm -rf dist/

# Build all platforms
npm run build
```

**Expected**: Builds succeed for all targets

**Platforms to verify**:
- ✅ Browser (dist/browser/)
- ✅ Node (dist/node/)
- ✅ Server (dist/server/)
- ✅ Tauri (dist/tauri/)
- ✅ React Native (dist/rn/)

#### 4.2 Platform-Specific Builds

```bash
# Browser offline
npm run build-offline-for-pages

# Browser online
npm run build-online-for-pages

# Desktop
npm run build-desktop
```

**Expected**: All succeed

#### 4.3 Check Output Files

```bash
# Verify critical outputs exist
ls -la dist/browser/index.html
ls -la dist/node/dist/index.js
ls -la dist/server/dist/local-server.cjs
```

---

### Phase 5: Runtime Validation

#### 5.1 Start Node Server

```bash
cd _debug/songdrive

# Set environment
touch .env
source .env

# Start server
npm run run-ws-server
```

**Expected**: Server starts without errors

**Verify**:
- Server listens on configured port
- No import errors
- No runtime errors in first 10 seconds

#### 5.2 Test Endpoints

In another terminal:
```bash
# Health check (if exists)
curl http://localhost:3000/health

# KV endpoint
curl http://localhost:3000/kv/get-all

# RPC endpoint
curl -X POST http://localhost:3000/rpc/test \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}'

# WebSocket (use wscat)
wscat -c ws://localhost:3000/ws
```

**Expected**: All endpoints respond correctly

#### 5.3 Development Mode

```bash
# Start dev mode (watch + server)
npm run dev
```

**Expected**:
- Watch mode starts
- Server runs
- Hot reload works on file changes

---

### Phase 6: Test Suite

#### 6.1 Unit Tests

```bash
cd _debug/songdrive
npm test
```

**Expected**: All tests pass

**If tests fail**:
- Check if tests import springboard packages
- Update test mocks/imports if needed
- Verify test data still valid

#### 6.2 E2E Tests

```bash
npm run test-e2e
```

**Expected**: E2E tests pass

---

### Phase 7: CI Validation

#### 7.1 Full CI Pipeline

```bash
npm run ci
```

This runs:
1. Build all platforms
2. Type checking
3. Unit tests
4. Docker build

**Expected**: All steps pass

---

## Acceptance Criteria

### Must Pass

- [x] TypeScript compiles with no errors
- [x] All platform builds succeed (browser, node, server, tauri, RN)
- [x] Node server starts and responds to requests
- [x] Unit tests pass
- [x] E2E tests pass
- [x] CI pipeline passes
- [x] No import errors at runtime

### Should Verify

- [x] WebSocket connections work
- [x] RPC calls work (HTTP and WebSocket)
- [x] Database operations work (Kysely integration)
- [x] File uploads work
- [x] Authentication works
- [x] Desktop build (Tauri) runs
- [x] React Native build works

### Nice to Have

- [ ] Performance comparable to refactor branch
- [ ] Build times acceptable
- [ ] Bundle sizes similar or smaller
- [ ] No console warnings

---

## Troubleshooting Guide

### Issue: Import not found

**Symptom**: `Cannot find module 'springboard/server/register'`

**Fix**:
1. Check export map in `packages/springboard/package.json`
2. Verify file exists in `dist/server/register.js`
3. Run export generation script: `node packages/springboard/scripts/generate-exports.js`
4. Rebuild: `pnpm -C packages/springboard build`

### Issue: Type errors

**Symptom**: TypeScript errors about missing types

**Fix**:
1. Check `.d.ts` files exist in dist/
2. Verify `types` field in export map points to correct path
3. Check if refactor branch had different type definitions
4. May need to update Songdrive code to match new types

### Issue: Build fails

**Symptom**: esbuild.ts fails to build

**Fix**:
1. Check if esbuild.ts imports old packages
2. Update to use springboard/* imports
3. Consider migrating to Vite multi-target API (Phase 8 implementation)
4. Check for path resolution issues

### Issue: Runtime errors

**Symptom**: Server crashes on startup

**Fix**:
1. Check server logs for specific error
2. Verify all required environment variables set
3. Check database connection
4. Verify file paths correct
5. Check for missing dependencies

### Issue: WebSocket not connecting

**Symptom**: WebSocket connection fails

**Fix**:
1. Verify crossws is being used (not @hono/node-ws)
2. Check WebSocket upgrade handler in server code
3. Verify `/ws` route is configured
4. Check for CORS/security issues

---

## Migration Checklist for Songdrive

Use this checklist when updating Songdrive to work with single-package springboard:

### Pre-Migration

- [ ] Create a new branch from `claude/issue-171-20251003-1828`
- [ ] Document current working state (screenshots, test results)
- [ ] Back up current dependencies in package.json

### Update Dependencies

- [ ] Remove `springboard-server` from package.json
- [ ] Remove `@springboardjs/data-storage` from package.json
- [ ] Remove `@springboardjs/platforms-browser` from package.json
- [ ] Remove `@springboardjs/platforms-cf-workers` from package.json
- [ ] Remove `@springboardjs/platforms-node` from package.json
- [ ] Remove `@springboardjs/platforms-react-native` from package.json
- [ ] Remove `springboard-cli` from devDependencies
- [ ] Keep/update `springboard` to latest version
- [ ] Run `pnpm install`

### Update Imports

- [ ] Replace `springboard-server/src/register` → `springboard/server/register`
- [ ] Replace `@springboardjs/platforms-node/*` → `springboard/platforms/node/*`
- [ ] Replace `@springboardjs/platforms-browser/*` → `springboard/platforms/browser/*`
- [ ] Replace other platform imports as needed
- [ ] Search for any remaining old imports: `rg "@springboardjs|springboard-server" src/`

### Verify Build

- [ ] Run `npm run check-types` - should pass
- [ ] Run `npm run build` - should succeed
- [ ] Check dist/ outputs exist
- [ ] Verify all platform builds work

### Test Runtime

- [ ] Start server: `npm run run-ws-server`
- [ ] Test endpoints manually
- [ ] Run unit tests: `npm test`
- [ ] Run E2E tests: `npm run test-e2e`
- [ ] Test development mode: `npm run dev`

### Validate All Platforms

- [ ] Browser build works
- [ ] Node server works
- [ ] Tauri desktop build works
- [ ] React Native build works (if applicable)
- [ ] Cloudflare Workers build works (if applicable)

### Final Validation

- [ ] Run full CI: `npm run ci`
- [ ] Manual smoke test of key features
- [ ] Check for console errors/warnings
- [ ] Performance check (build time, bundle size)

---

## Success Metrics

### Build Metrics

- **TypeScript**: Zero errors
- **Build time**: Comparable to refactor branch (within 10%)
- **Bundle sizes**: Similar or smaller than refactor branch
- **Output structure**: Matches expected layout

### Runtime Metrics

- **Server startup**: < 5 seconds
- **First request**: < 1 second
- **WebSocket connection**: < 500ms
- **No crashes**: Server stable for 5+ minutes

### Test Metrics

- **Unit tests**: 100% pass rate
- **E2E tests**: 100% pass rate
- **CI pipeline**: All steps green

---

## Next Steps After Validation

Once Songdrive integration testing passes:

1. **Document changes**: Update Songdrive's README/docs with new import patterns
2. **Update CI**: Ensure CI uses correct springboard version
3. **Migration guide**: Create guide for other projects using refactor branch
4. **Publish**: Publish springboard package to npm
5. **Announcement**: Announce breaking changes and migration path

---

## Contact/Support

If issues arise during testing:
1. Check this document's troubleshooting section
2. Review Phase 1-8 implementation summaries
3. Check springboard package exports: `claude_notes/032-PHASE7_EXPORT_GENERATION_SUMMARY.md`
4. Review multi-target build guide: `claude_notes/034-VITE_MULTI_TARGET_GUIDE.md`

---

**Document Version**: 1.0
**Last Updated**: 2026-01-03
**Status**: Ready for execution
