# Build System Blockers Review

**Status**: CRITICAL - Build is completely blocked
**Impact**: Verdaccio testing cannot proceed
**Analysis Date**: 2025-12-21

---

## Executive Summary

The build system has **THREE CRITICAL BLOCKERS** that must be resolved before Verdaccio testing can proceed:

1. **BLOCKER 1**: ESM default export mismatch in `register.ts` (CRITICAL)
2. **BLOCKER 2**: Missing esbuild dependency in root package.json (HIGH)
3. **BLOCKER 3**: FilesModule circular dependency causing undefined exports (HIGH)

All three blockers are **PRE-EXISTING** - they were not introduced by recent changes. The consolidation work exposed these issues but did not create them.

---

## Current Build Failure Analysis

### Error Output
```
✘ [ERROR] No matching export in "packages/springboard/src/core/engine/register.ts"
for import "default"

    packages/springboard/src/core/modules/files/files_module.tsx:3:7:
      3 │ import springboard from '../../engine/register';
        ╵        ~~~~~~~~~~~

▲ [WARNING] Import "FilesModule" will always be undefined because the file
"packages/springboard/src/core/modules/files/files_module.tsx" has no exports

    packages/springboard/src/index.ts:70:9:
      70 │ export { FilesModule } from './core/modules/files/files_module';
         ╵          ~~~~~~~~~~~
```

### Build Command
```bash
npx tsx scripts/build-for-publish.ts
```

### Failure Point
The build fails during esbuild bundling of the main entry point (`index.ts`) when attempting to resolve the `files_module.tsx` imports.

---

## Root Cause Deep Dive

### BLOCKER 1: ESM Default Export Mismatch

**File**: `/packages/springboard/src/core/engine/register.ts`

**Problem**: The file exports a named export `springboard` but 5 files import it as a default export:

**Current Code (Line 64-73)**:
```typescript
export const springboard: SpringboardRegistry = {
    registerModule,
    registerClassModule,
    registerSplashScreen,
    reset: () => {
        springboard.registerModule = registerModule;
        springboard.registerClassModule = registerClassModule;
        springboard.registerSplashScreen = registerSplashScreen;
    },
};
```

**Files Using Incorrect Default Import**:
1. `packages/springboard/src/core/modules/files/files_module.tsx:3`
   ```typescript
   import springboard from '../../engine/register';  // WRONG
   ```

2. `packages/springboard/src/core/engine/module_api.spec.ts:3`
   ```typescript
   import springboard from './register';  // WRONG
   ```

3. `packages/springboard/src/platforms/react-native/entrypoints/rn_app_springboard_entrypoint.ts:3`
   ```typescript
   import springboard from '../../../core/engine/register';  // WRONG
   ```

4. `packages/springboard/src/platforms/partykit/entrypoints/partykit_server_entrypoint.ts:5`
   ```typescript
   import springboard from '../../../core/engine/register';  // WRONG
   ```

5. `packages/springboard/src/platforms/react-native/services/kv/kv_rn_and_webview.spec.tsx:9`
   ```typescript
   import springboard from '../../../../core/engine/register';  // WRONG
   ```

**Why This Worked Before**:
- The Vite dev environment is more permissive with ESM/CJS interop
- TypeScript compilation doesn't enforce this at build time
- The Vite plugin may have transformed these imports

**Why It Fails Now**:
- esbuild is stricter about ESM import/export matching
- `build-for-publish.ts` uses esbuild directly without the Vite plugin transforms
- esbuild correctly identifies that there is no `export default` statement

**Impact**: Build cannot proceed past the first entry point compilation

---

### BLOCKER 2: Missing esbuild Dependency

**File**: `/package.json` (root)

**Problem**: The `build-for-publish.ts` script imports esbuild:
```typescript
import { build, type BuildOptions } from 'esbuild';
```

But esbuild is not declared in root dependencies.

**Current State**:
```json
{
  "pnpm": {
    "overrides": {
      "esbuild": "catalog:"  // Only in overrides
    }
  }
}
```

**Missing**:
```json
{
  "devDependencies": {
    "esbuild": "catalog:"  // Should be here
  }
}
```

**Why This Might Work Sometimes**:
- pnpm hoisting may provide esbuild from another package
- Some environments may have esbuild globally installed
- The catalog override ensures version consistency but doesn't install it

**Why It Fails**:
- Fresh installs won't have esbuild in root node_modules
- The override alone doesn't create a dependency
- tsx cannot find the module when running scripts/build-for-publish.ts

**Impact**: Build script cannot even start

---

### BLOCKER 3: FilesModule Circular Dependency

**Files Involved**:
- `/packages/springboard/src/index.ts:70`
- `/packages/springboard/src/core/modules/files/files_module.tsx`

**Problem Chain**:

1. **index.ts attempts to export FilesModule type**:
   ```typescript
   // Line 70
   export { FilesModule } from './core/modules/files/files_module';
   ```

2. **files_module.tsx does not export FilesModule**:
   ```typescript
   // The file only:
   // - Declares FilesModule type (line 34-41)
   // - Calls springboard.registerModule() (line 43)
   // - Does NOT export anything
   ```

3. **The type is declared in a module augmentation**:
   ```typescript
   // Line 8-12
   declare module '../../module_registry/module_registry' {
       interface AllModules {
           Files: FilesModule;
       }
   }
   ```

**Why It's a Circular Dependency**:
```
index.ts
  → imports from files_module.tsx
    → imports springboard from register.ts
      → (would be imported by index.ts if default export existed)
        → tries to export FilesModule which doesn't exist
```

**Why This Worked Before**:
- The module was never bundled with esbuild before
- TypeScript compilation ignores this because FilesModule is type-only in the augmentation
- Vite dev mode doesn't perform the same level of tree shaking

**Why It Fails Now**:
- esbuild tries to resolve the named export `FilesModule`
- The file has no exports (it only has side effects via registerModule call)
- esbuild correctly warns that the import will always be undefined

**Impact**: Even if BLOCKER 1 is fixed, this prevents clean bundling

---

## Pre-existing vs New Issues

### Analysis Method
I traced the git history and implementation timeline:

1. Checked IMPLEMENTATION_SUMMARY.md for consolidation changes
2. Examined register.ts export pattern (unchanged during consolidation)
3. Reviewed build-for-publish.ts (created for new workflow but exposed pre-existing issues)
4. Analyzed files_module.tsx structure (pre-existing pattern)

### Verdict: ALL PRE-EXISTING

| Blocker | Status | Evidence |
|---------|--------|----------|
| BLOCKER 1: Default export mismatch | **PRE-EXISTING** | The named export pattern in register.ts existed before consolidation. Files were already using default imports incorrectly. |
| BLOCKER 2: Missing esbuild | **NEW EXPOSURE** | The build-for-publish.ts script is new, but the missing dependency is a packaging oversight, not a regression. |
| BLOCKER 3: FilesModule export | **PRE-EXISTING** | The files_module.tsx pattern existed before. Previous build system didn't expose this because it used different tooling. |

**Key Insight**: The consolidation work and new build script didn't introduce bugs - they **revealed pre-existing architectural issues** that were masked by:
- Vite's permissive import handling
- TypeScript's type-only compilation
- Lack of strict ESM bundling validation

---

## Fix Strategy

### Step 1: Fix BLOCKER 1 (Default Export Mismatch)

**Priority**: CRITICAL - Do this first

**Option A: Add default export to register.ts** (RECOMMENDED)
```typescript
// At the end of packages/springboard/src/core/engine/register.ts

export const springboard: SpringboardRegistry = {
    registerModule,
    registerClassModule,
    registerSplashScreen,
    reset: () => {
        springboard.registerModule = registerModule;
        springboard.registerClassModule = registerClassModule;
        springboard.registerSplashScreen = registerSplashScreen;
    },
};

// Add this line:
export default springboard;
```

**Pros**:
- Minimal changes (1 line)
- Preserves backward compatibility
- Fixes all 5 import sites
- Aligns with actual usage pattern

**Cons**:
- Dual export (both named and default) can be confusing
- Not ideal ESM style (named exports preferred)

**Option B: Change all imports to named imports**
```typescript
// Change in 5 files:
import { springboard } from '../../engine/register';
```

**Pros**:
- Better ESM style
- Explicit imports
- No dual export confusion

**Cons**:
- 5 file changes required
- Risk of missing an import
- May affect test mocks

**RECOMMENDATION**: Use Option A for speed and safety. Refactor to Option B later if desired.

### Step 2: Fix BLOCKER 2 (Missing esbuild)

**Priority**: CRITICAL - Do immediately after Step 1

**Change Required**:
```json
// In /package.json root
{
  "devDependencies": {
    // ... existing deps ...
    "esbuild": "catalog:"
  }
}
```

**Then run**:
```bash
pnpm install
```

**Validation**:
```bash
pnpm list esbuild  # Should show root installation
npx tsx scripts/build-for-publish.ts  # Should not fail on import
```

### Step 3: Fix BLOCKER 3 (FilesModule Export)

**Priority**: HIGH - Do after Steps 1 & 2

**Option A: Export the type from files_module.tsx** (RECOMMENDED)
```typescript
// In packages/springboard/src/core/modules/files/files_module.tsx
// After line 41, before line 43:

export type { FilesModule };  // Add this export

springboard.registerModule('Files', {}, async (moduleAPI): Promise<FilesModule> => {
    // ... existing code ...
});
```

**Option B: Re-export from module_registry**
```typescript
// In packages/springboard/src/index.ts:70
// Change from:
export { FilesModule } from './core/modules/files/files_module';

// To:
export type { FilesModule } from './core/module_registry/module_registry';
```

Then in `module_registry.ts`:
```typescript
export type { FilesModule } from '../modules/files/files_module';
```

**RECOMMENDATION**: Use Option A. It's clearer and the type should be co-located with its implementation.

### Step 4: Verify Build

**After all fixes**:
```bash
# Clean build
rm -rf packages/springboard/dist

# Run build
npx tsx scripts/build-for-publish.ts

# Expected output structure:
packages/springboard/dist/
  index.mjs
  index.d.ts
  core/index.mjs
  core/index.d.ts
  server/index.mjs
  server/index.d.ts
  # ... etc for all platforms
```

### Step 5: Test with Verdaccio

**Only proceed after Step 4 succeeds**:

1. Publish to local Verdaccio registry
2. Create test package that imports springboard
3. Verify all entry points work:
   ```typescript
   import springboard from 'springboard';
   import { springboard as named } from 'springboard';
   import type { FilesModule } from 'springboard';
   import server from 'springboard/server';
   import browser from 'springboard/platforms/browser';
   ```

---

## Dependencies & Build Order

### Current Build Order (from turbo.json)
```
build: dependsOn ["^build"]
```

This means each package waits for its dependencies to build first.

### Springboard Package Dependency Graph

```
packages/springboard (core library)
  ├── src/ (source files)
  ├── vite-plugin/ (has its own build)
  │   └── depends on: nothing (standalone)
  ├── cli/ (has its own build)
  │   └── depends on: springboard, vite-plugin
  ├── data_storage/ (separate package)
  └── plugins/* (separate packages)
      └── depends on: springboard

apps/jamtools
  └── depends on: springboard, @jamtools/core

apps/small_apps
  └── depends on: springboard
```

### Build-for-Publish Specific Order

The `build-for-publish.ts` script builds **one package only**: `packages/springboard`

**Internal entry point order** (from ENTRY_POINTS array):
1. Main entry (`.`) - index.ts
2. Core (./core) - core/index.ts
3. Server (./server) - server/index.ts
4. Platforms:
   - browser
   - node
   - partykit
   - tauri
   - react-native

**Current problem**: Fails on step 1 (main entry) due to BLOCKER 1.

### Correct Build Sequence

For Verdaccio testing:

```bash
# 1. Fix source code (BLOCKERS 1, 2, 3)
# Apply fixes from strategy above

# 2. Install dependencies
pnpm install

# 3. Build springboard package for publishing
npm run build:publish
# This runs: npx tsx scripts/build-for-publish.ts

# 4. Verify dist/ structure
ls -R packages/springboard/dist

# 5. Start Verdaccio
npx verdaccio

# 6. Publish to local registry
cd packages/springboard
npm publish --registry http://localhost:4873

# 7. Test installation in isolated environment
mkdir /tmp/test-springboard
cd /tmp/test-springboard
npm init -y
npm install springboard --registry http://localhost:4873

# 8. Test imports
node -e "import('springboard').then(m => console.log(m))"
```

---

## Additional Issues Found (Non-Blocking)

### Issue 1: import.meta.dirname Usage

**File**: `/scripts/build-for-publish.ts:109`

```typescript
const __dirname = path.dirname(new URL(import.meta.url).pathname);
```

**Status**: Currently works but is non-standard

**Better approach**:
```typescript
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

**Priority**: LOW - Current implementation works but could fail on Windows

**Fix Later**: After critical blockers resolved

### Issue 2: CLI Binary Missing on Install

**Warning during pnpm install**:
```
WARN  Failed to create bin at .../node_modules/.bin/sb.
ENOENT: no such file or directory,
open '.../packages/springboard/cli/dist/cli.js'
```

**Root Cause**: The CLI package needs to be built before it can be linked

**Current Workaround**: postinstall hook rebuilds it

**Issue**: Race condition on fresh clones

**Priority**: MEDIUM - Doesn't block publish but affects developer experience

**Fix Later**: Consider moving to prepublish hook or checking in dist/

### Issue 3: Package Structure Documentation Mismatch

**IMPLEMENTATION_SUMMARY.md mentions** (line 260-270):
> Build script may reference old package paths

**Analysis**: Actually the build script is **CORRECT**. It references:
```typescript
const PACKAGE_DIR = path.join(REPO_ROOT, 'packages/springboard');
const SRC_DIR = path.join(PACKAGE_DIR, 'src');
```

And uses proper source paths:
```typescript
input: 'index.ts',  // Relative to SRC_DIR
input: 'core/index.ts',
input: 'server/index.ts',
```

**Conclusion**: This warning in IMPLEMENTATION_SUMMARY.md is incorrect. The build script is properly updated for the consolidated structure.

**Priority**: DOCUMENTATION - Update IMPLEMENTATION_SUMMARY.md

---

## Risk Assessment

### Immediate Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fix breaks dev mode | MEDIUM | Test both `npm run dev` and `npm run build:publish` after each fix |
| Default export causes import confusion | LOW | Add JSDoc comment explaining dual export |
| Missing other ESM issues | MEDIUM | Run full type check after fixes: `pnpm check-types` |
| Breaking published packages | HIGH | Test with Verdaccio BEFORE publishing to npm |

### Testing Requirements

**Before considering this fixed**:

1. ✅ Build script completes without errors
2. ✅ All entry points generate .mjs and .d.ts files
3. ✅ Verdaccio can serve the package
4. ✅ Test project can install from Verdaccio
5. ✅ All imports work in test project
6. ✅ Dev mode still works: `npm run dev`
7. ✅ Type checking passes: `pnpm check-types`
8. ✅ Tests pass: `pnpm test`

### Rollback Plan

If fixes cause issues:

1. **Git has no commits yet** - changes are only in working tree
2. **To rollback**:
   ```bash
   git status  # Check what changed
   git checkout -- <file>  # Revert specific file
   git checkout .  # Revert all changes
   ```

3. **To test fixes in isolation**:
   ```bash
   git stash  # Save current changes
   # Test without changes
   git stash pop  # Restore changes
   ```

---

## Severity Classification

### CRITICAL (Blocks All Progress)
- ✅ BLOCKER 1: Default export mismatch
- ✅ BLOCKER 2: Missing esbuild dependency

### HIGH (Blocks Clean Build)
- ✅ BLOCKER 3: FilesModule export issue

### MEDIUM (Affects Developer Experience)
- Issue 2: CLI binary missing on install

### LOW (Minor Issues)
- Issue 1: import.meta.dirname usage
- Documentation mismatch in IMPLEMENTATION_SUMMARY.md

---

## Conclusion

The build system is **completely blocked** by three pre-existing issues that the new build-for-publish.ts script exposed:

1. ESM import/export mismatch (5 files using default import incorrectly)
2. Missing root-level esbuild dependency
3. Type export missing from files_module.tsx

**None of these were introduced by recent work** - they existed in the codebase but were masked by Vite's permissive handling.

**Estimated Fix Time**: 30-60 minutes
- 5 minutes: Add default export
- 2 minutes: Add esbuild to package.json
- 5 minutes: Add FilesModule export
- 5 minutes: Run pnpm install
- 10 minutes: Test build
- 30 minutes: Verdaccio testing

**Can Proceed to Verdaccio Testing**: NO - Not until all three blockers are fixed

**Next Steps**:
1. Apply fixes from strategy section
2. Run full build
3. Test with Verdaccio
4. Document results
5. Create PR with fixes

---

## Appendix: File References

### Files Requiring Changes

**Priority 1 (CRITICAL)**:
- `/packages/springboard/src/core/engine/register.ts` - Add default export
- `/package.json` - Add esbuild dependency

**Priority 2 (HIGH)**:
- `/packages/springboard/src/core/modules/files/files_module.tsx` - Export FilesModule type

**Priority 3 (DOCUMENTATION)**:
- `/IMPLEMENTATION_SUMMARY.md` - Update section about build script paths

### Files Analyzed (No Changes Needed)

- ✅ `/scripts/build-for-publish.ts` - Correct, just needs dependencies
- ✅ `/pnpm-workspace.yaml` - Correct
- ✅ `/turbo.json` - Correct
- ✅ `/packages/springboard/package.json` - Correct
- ✅ `/packages/springboard/tsconfig.build.json` - Correct

### Commands for Verification

```bash
# Check current state
pnpm list esbuild
git status

# After fixes
pnpm install
npm run build:publish
ls -la packages/springboard/dist/

# Full test suite
pnpm check-types
pnpm test
pnpm build
```

---

**Report Generated**: 2025-12-21
**Analyst**: DevOps Troubleshooter AI
**Severity**: CRITICAL - Complete Build Failure
**Blockers**: 3 (All Pre-Existing)
**Estimated Resolution**: 30-60 minutes + testing
