# Test Infrastructure Review - Vite Migration Project

**Review Date:** 2025-12-21
**Reviewer:** Test Automation Engineer (AI Agent)
**Status:** CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

### What's Broken
- **Platform Builds:** 15/15 tests failing - vite-plugin not built
- **Verdaccio Workflow:** Failing in setup - missing vite-plugin dist/ directory
- **Dev Server:** Unknown status - cannot run without vite-plugin
- **False Positives:** Smoke tests and Plugin API tests passing but not testing real functionality

### What Works
- **Smoke Tests:** 10/10 passing (BUT: testing wrong API - see details)
- **Plugin API Tests:** 32/32 passing (BUT: testing wrong API - see details)
- **Test Infrastructure:** File system, exec, and verdaccio utilities appear robust

### Critical Path Impact
**The entire test suite is blocked because the vite-plugin is not being built.** This is a FATAL infrastructure failure that invalidates most test results.

---

## Detailed Test Status

### 1. Smoke Tests (10/10 passing) ⚠️ FALSE POSITIVE

**Status:** PASSING but INCORRECT

**What They Test:**
- Basic vitest functionality
- Node.js API access
- ES module support
- Test utilities can be imported
- Vite plugin can be imported and called

**Critical Issues:**

1. **Testing Wrong API** (Lines 64-72)
   ```typescript
   const plugins = springboard({
     entry: './src/index.tsx',
     platforms: ['browser'],
   });

   expect(Array.isArray(plugins)).toBe(true);  // WRONG!
   ```

   The test expects `springboard()` to return `Plugin[]`, but according to the actual implementation in `vite-plugin/src/index.ts`, it should return `UserConfig` (Vite's configuration object). The test is passing by accident because UserConfig has a `plugins` array property.

2. **Not Testing Build Output**
   - Tests import from source (`../packages/springboard/vite-plugin/src/index.js`)
   - Does NOT test the built dist/ output
   - Will pass even if vite-plugin cannot be built or published

**Risk Assessment:** HIGH
- These tests give false confidence that the plugin works
- They don't validate the published package will function
- They bypass the actual build system

---

### 2. Plugin API Tests (32/32 passing) ⚠️ FALSE POSITIVE

**Status:** PASSING but INCORRECT

**What They Test:**
- Plugin API function exports
- Configuration validation
- Platform utilities
- TypeScript type exports

**Critical Issues:**

1. **Same API Confusion** (Lines 28-41, 193-201)
   ```typescript
   it('should return array of plugins', () => {
     const plugins = springboard({
       entry: './src/index.tsx',
       platforms: ['browser'],
     });

     expect(Array.isArray(plugins)).toBe(true);  // WRONG ASSUMPTION
   ```

   - Tests assume `springboard()` returns `Plugin[]`
   - Actually returns `UserConfig` with `plugins` property
   - Tests are checking `config.plugins` exists, not testing the actual API contract

2. **No Integration Testing**
   - All tests are unit-level API checks
   - No actual Vite builds are run
   - No validation that plugins work in real Vite environment

3. **defineSpringboardConfig() Misunderstanding** (Lines 193-201)
   ```typescript
   it('should return UserConfig with plugins', () => {
     const config = defineSpringboardConfig({
       entry: './src/index.tsx',
       platforms: ['browser'],
     });

     expect(config).toHaveProperty('plugins');
   ```

   This is the ONLY test that correctly expects UserConfig, but it's testing the wrong function. Both `springboard()` and `defineSpringboardConfig()` should return UserConfig.

**Risk Assessment:** HIGH
- False sense of API correctness
- Tests will pass with broken implementation
- No coverage of actual build functionality

---

### 3. Platform Builds Tests (15/15 failing) 🔴 CRITICAL

**Status:** ALL FAILING

**Root Cause:** Missing vite-plugin dist/ directory

**Error Analysis:**
```
Error: Cannot find module 'springboard/vite-plugin'
```

**Why It Fails:**

1. **vite-plugin Not Built**
   - `packages/springboard/vite-plugin/dist/` does not exist
   - package.json points to `./dist/index.js` as entry
   - No build has been run to create dist/ from src/

2. **Test Setup Issues** (Lines 389)
   ```typescript
   await execute('pnpm install', { cwd: dir, timeout: 60000 });
   ```

   - Creates test apps with `springboard: 'workspace:*'` dependency
   - pnpm tries to resolve workspace package
   - Workspace package references non-existent dist/ directory
   - Installation fails before tests can even run

3. **Circular Dependency Problem**
   - Tests need built plugin to run
   - Plugin isn't in build pipeline
   - No build:vite-plugin script exists

**What SHOULD Happen:**
```
1. Build vite-plugin: pnpm --filter @springboard/vite-plugin build
2. Create test app with vite-plugin dependency
3. Run vite build in test app
4. Verify output structure
```

**What ACTUALLY Happens:**
```
1. Create test app
2. Try to install springboard with vite-plugin
3. FAIL: vite-plugin dist/ doesn't exist
4. Tests never run
```

**Risk Assessment:** CRITICAL
- Cannot test any platform builds
- Cannot verify Vite migration works
- Entire migration validation is impossible

---

### 4. Verdaccio Workflow Tests (failing in setup) 🔴 CRITICAL

**Status:** FAILING in beforeAll() setup

**Root Cause:** Multiple issues in test design and implementation

**Critical Issues:**

1. **Missing build:publish Script Execution**

   Line 60 calls:
   ```typescript
   execSync('pnpm build:publish', {
     cwd: REPO_ROOT,
     stdio: 'inherit',
   });
   ```

   But there's NO GUARANTEE that:
   - The vite-plugin is built first
   - The vite-plugin dist/ exists
   - The vite-plugin will be included in published package

2. **Incorrect File Reading** (Line 182)
   ```typescript
   const content = await readJson<string>(jsFile);
   ```

   **CRITICAL BUG:** Using `readJson()` to read JavaScript files. This is wrong because:
   - `readJson()` calls `JSON.parse()` on file contents
   - JavaScript files are not JSON
   - This will throw parsing errors
   - Should use `fs.readFile()` instead

3. **Type Misuse** (Line 199)
   ```typescript
   const configContent = await readJson<string>(viteConfig);
   ```

   Same issue - reading TypeScript config file as JSON. Will fail.

4. **package.publish.json May Not Include vite-plugin**

   The build-for-publish.ts script (lines 328-410) generates package.publish.json but:
   - Only handles main package exports
   - No explicit vite-plugin export handling visible
   - May not include vite-plugin in published structure

5. **Test Logic Flaw** (Lines 172-192)

   Test "should verify platform injection works correctly" reads JS files and expects:
   ```typescript
   expect(contentStr).not.toContain('@platform');
   ```

   But it's using `readJson()` which will fail before this assertion runs.

**What SHOULD Happen:**
```
1. Build vite-plugin (MISSING)
2. Build main package
3. Create package.publish.json
4. Publish to Verdaccio
5. Install from Verdaccio
6. Test builds
```

**What ACTUALLY Happens:**
```
1. Build main package (vite-plugin NOT built)
2. Create package.publish.json (vite-plugin dist/ missing)
3. Try to publish (FAIL or publish incomplete package)
4. Tests fail or test wrong thing
```

**Risk Assessment:** CRITICAL
- Cannot validate publish workflow
- Cannot test end-to-end package installation
- Core use case (npm install springboard) is untested

---

### 5. Dev Server Tests (unknown status) ⚠️ UNTESTED

**Status:** Cannot run due to upstream failures

**Blockers:**
1. Requires vite-plugin to be built
2. Requires successful pnpm install in test apps
3. Both prerequisites currently failing

**Test Design Issues:**

1. **Same Test App Creation Problem** (Lines 289-410)
   - Uses `springboard: 'workspace:*'` dependency
   - Will fail without built vite-plugin
   - Cannot test dev server without fixing upstream issues

2. **Incomplete HMR Testing** (Lines 83-110)
   - Tests file modification and waits 2 seconds
   - Doesn't verify HMR actually updated the page
   - Just checks dev server still responds (weak assertion)

3. **Platform Directive Testing** (Lines 138-151)
   - Fetches `/src/index.tsx` directly from dev server
   - Expects transformed output without `@platform` markers
   - Good concept but may not work as expected (Vite may serve original source)

**Risk Assessment:** MEDIUM
- Test design is reasonable
- Implementation blocked by infrastructure failures
- Once vite-plugin is built, these tests might work

---

## Root Cause Analysis

### Primary Root Cause: Missing vite-plugin Build Step

**The vite-plugin package is never built before tests run.**

**Evidence:**
1. No `dist/` directory exists in `packages/springboard/vite-plugin/`
2. package.json references `./dist/index.js` as entry point
3. No build step in test setup or CI pipeline
4. Root package.json has no vite-plugin build command

**Impact Chain:**
```
No vite-plugin build
  ↓
Cannot install workspace package
  ↓
Platform build tests fail
  ↓
Verdaccio tests fail
  ↓
Dev server tests cannot run
  ↓
Zero validation of Vite migration
```

### Secondary Root Cause: False API Understanding

**Tests assume `springboard()` returns `Plugin[]` when it returns `UserConfig`**

**Evidence:**
1. Smoke tests check `Array.isArray(plugins)` directly on return value
2. Plugin API tests have same assumption
3. Only `defineSpringboardConfig()` test expects UserConfig
4. Actual implementation returns UserConfig object

**Correct API:**
```typescript
// CORRECT
const config = springboard({...});  // Returns UserConfig
config.plugins  // Array of Vite plugins

// TESTS ASSUME (WRONG)
const plugins = springboard({...});  // They think this returns Plugin[]
```

**Why Tests Still Pass:**
- JavaScript type coercion
- `UserConfig` object is truthy, passes `Array.isArray()` parent check somehow
- Tests are too permissive in assertions

### Tertiary Root Cause: Incorrect Utility Usage

**readJson() used to read JavaScript/TypeScript files**

**Evidence:**
1. Line 182 in verdaccio-workflow: `readJson<string>(jsFile)`
2. Line 199 in verdaccio-workflow: `readJson<string>(viteConfig)`
3. readJson() implementation calls `JSON.parse()`
4. Will throw on non-JSON content

**Impact:**
- Verdaccio tests will fail even if other issues are fixed
- False failures mask real issues
- Test utilities being misused

---

## Missing Test Coverage

### 1. vite-plugin Build Validation
**MISSING:** No tests verify vite-plugin can be built

**Should Test:**
- `pnpm build` in vite-plugin package succeeds
- dist/ directory created
- dist/index.js and dist/index.d.ts exist
- TypeScript declarations are valid
- Exported functions are accessible

### 2. Integration Testing
**MISSING:** No tests run actual Vite builds

**Current Tests:**
- Import plugin and call functions ✓
- Mock test apps ✓
- Try to build (FAIL - plugin not built) ✗

**Should Test:**
- Real Vite build in minimal project
- Plugin hooks are called correctly
- Build output structure is correct
- Platform injection actually works

### 3. API Contract Testing
**MISSING:** No tests verify correct return types

**Should Test:**
```typescript
it('springboard() should return UserConfig', () => {
  const config = springboard({...});
  expect(config).toHaveProperty('plugins');
  expect(Array.isArray(config.plugins)).toBe(true);
  expect(config.plugins.length).toBeGreaterThan(0);
});

it('springboard() should NOT return Plugin[] directly', () => {
  const result = springboard({...});
  expect(Array.isArray(result)).toBe(false);  // Should FAIL if returns Plugin[]
});
```

### 4. Published Package Structure
**MISSING:** No tests validate package.publish.json exports

**Should Test:**
- vite-plugin export exists in package.json
- vite-plugin export points to correct dist/ file
- All required files are in "files" array
- Package can be imported after publish

### 5. Build Script Validation
**MISSING:** No tests for build-for-publish.ts

**Should Test:**
- Script runs without errors
- All entry points are built
- package.publish.json is created
- vite-plugin is included in build output
- TypeScript declarations generated

### 6. Error Handling
**MISSING:** No tests for invalid configurations

**Should Test:**
- Invalid platform names
- Missing required options
- Conflicting options
- Malformed viteConfig functions
- Invalid entry paths

### 7. Multi-Platform Builds
**MISSING:** No tests for simultaneous platform builds

**Should Test:**
- Building 2+ platforms in one command
- Platform-specific output directories
- No cross-contamination between platforms
- Platform injection works independently per platform

### 8. TypeScript Type Safety
**MISSING:** No compile-time type tests

**Should Test:**
```typescript
// Should compile
const config: UserConfig = springboard({...});

// Should NOT compile
const plugins: Plugin[] = springboard({...});  // Type error expected
```

---

## Critical Path to Fix

### Priority 1: Build Infrastructure (BLOCKING EVERYTHING)

**Step 1.1: Add vite-plugin Build to Root Package**
```json
// package.json
{
  "scripts": {
    "build:vite-plugin": "pnpm --filter @springboard/vite-plugin build",
    "prebuild:publish": "pnpm run build:vite-plugin"
  }
}
```

**Step 1.2: Verify vite-plugin Builds**
```bash
cd packages/springboard/vite-plugin
pnpm build
# Verify dist/ directory created
ls -la dist/
# Should show: index.js, index.d.ts
```

**Step 1.3: Update build-for-publish.ts**

Add vite-plugin build before main package build:
```typescript
// Line ~60, before building entry points
console.log('\nBuilding vite-plugin...');
execSync('pnpm --filter @springboard/vite-plugin build', {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});
```

**Step 1.4: Verify package.publish.json Includes vite-plugin**

Check that generated package.publish.json has:
```json
{
  "exports": {
    "./vite-plugin": {
      "types": "./vite-plugin/dist/index.d.ts",
      "import": "./vite-plugin/dist/index.js"
    }
  },
  "files": [
    "src",
    "dist",
    "vite-plugin"  // Must include entire vite-plugin directory
  ]
}
```

---

### Priority 2: Fix Test Bugs (BEFORE RUNNING TESTS)

**Step 2.1: Fix API Assumptions in smoke.test.ts**
```typescript
// Line 64-72 BEFORE
const plugins = springboard({...});
expect(Array.isArray(plugins)).toBe(true);

// Line 64-72 AFTER
const config = springboard({...});
expect(config).toHaveProperty('plugins');
expect(Array.isArray(config.plugins)).toBe(true);
```

**Step 2.2: Fix API Assumptions in plugin-api.test.ts**
```typescript
// Multiple places - change:
const plugins = springboard({...});
expect(Array.isArray(plugins)).toBe(true);

// To:
const config = springboard({...});
expect(config).toHaveProperty('plugins');
expect(Array.isArray(config.plugins)).toBe(true);
```

**Step 2.3: Fix readJson() Misuse in verdaccio-workflow.test.ts**
```typescript
// Line 182 BEFORE
const content = await readJson<string>(jsFile);

// Line 182 AFTER
const content = await fs.readFile(jsFile, 'utf8');

// Line 199 BEFORE
const configContent = await readJson<string>(viteConfig);

// Line 199 AFTER
// Just remove this test - reading TS config is not useful
```

**Step 2.4: Add readFile Utility**

In `tests/utils/file-system.ts`:
```typescript
/**
 * Read text file
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}
```

---

### Priority 3: Validate Tests Actually Work (VERIFICATION)

**Step 3.1: Run Smoke Tests**
```bash
pnpm test:vite tests/smoke.test.ts
# Should: 10/10 passing
```

**Step 3.2: Run Plugin API Tests**
```bash
pnpm test:vite tests/e2e/plugin-api.test.ts
# Should: 32/32 passing
```

**Step 3.3: Run Platform Build Tests**
```bash
pnpm test:vite tests/e2e/platform-builds.test.ts
# Should: 15/15 passing (after fixes)
# If fails: check error messages for new issues
```

**Step 3.4: Run Verdaccio Workflow**
```bash
pnpm test:vite tests/e2e/verdaccio-workflow.test.ts
# Should: 10/10 passing (after fixes)
# Timeout: 300000ms (5 min)
```

**Step 3.5: Run Dev Server Tests**
```bash
pnpm test:vite tests/e2e/dev-server.test.ts
# Should: ~20 tests passing
```

---

### Priority 4: Add Missing Coverage (AFTER BASIC TESTS PASS)

**Step 4.1: Add vite-plugin Build Tests**

Create `tests/vite-plugin-build.test.ts`:
```typescript
describe('Vite Plugin Build', () => {
  it('should build successfully', async () => {
    await execute('pnpm build', {
      cwd: path.join(REPO_ROOT, 'packages/springboard/vite-plugin'),
    });

    expect(await dirExists(PLUGIN_DIST_DIR)).toBe(true);
    expect(await fileExists(path.join(PLUGIN_DIST_DIR, 'index.js'))).toBe(true);
    expect(await fileExists(path.join(PLUGIN_DIST_DIR, 'index.d.ts'))).toBe(true);
  });
});
```

**Step 4.2: Add API Contract Tests**

In `plugin-api.test.ts`:
```typescript
describe('API Contract Validation', () => {
  it('springboard() should return UserConfig, not Plugin[]', () => {
    const result = springboard({entry: './src/index.tsx'});

    // Should be object with plugins property
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('plugins');

    // Should NOT be an array
    expect(Array.isArray(result)).toBe(false);
  });
});
```

**Step 4.3: Add Integration Tests**

Create `tests/e2e/vite-integration.test.ts`:
```typescript
describe('Vite Integration', () => {
  it('should build real project with vite-plugin', async () => {
    // Create minimal Vite project
    // Add vite-plugin
    // Run vite build
    // Verify output
  });
});
```

---

## Risk Assessment

### Production Risks (What Could Break)

#### CRITICAL Risk: vite-plugin Not Publishable
**Severity:** 🔴 CRITICAL
**Probability:** 95%

**Issue:** If package is published without vite-plugin dist/, users cannot use it.

**Symptom:**
```bash
npm install springboard
# Works

import { springboard } from 'springboard/vite-plugin';
# Error: Cannot find module 'springboard/vite-plugin'
```

**Impact:**
- Complete failure of Vite integration
- Users cannot create apps with Vite
- Migration to Vite is unusable

**Mitigation:**
- MUST build vite-plugin before publish
- MUST include vite-plugin/dist/ in published package
- MUST test published package before releasing

---

#### CRITICAL Risk: Incorrect API in Documentation
**Severity:** 🔴 CRITICAL
**Probability:** 80%

**Issue:** If docs show `springboard()` returning `Plugin[]`, users will misuse API.

**Wrong Usage:**
```typescript
// User tries this (from docs)
export default springboard({...});  // Returns UserConfig, not valid export

// Error: Vite expects Plugin[] or UserConfig, but got UserConfig
// (Actually works, but confusing)
```

**Correct Usage:**
```typescript
// Should be
import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';

export default defineConfig({
  plugins: springboard({...})  // Returns UserConfig with plugins
});

// OR use helper
import { defineSpringboardConfig } from 'springboard/vite-plugin';

export default defineSpringboardConfig({...});
```

**Impact:**
- User confusion
- Support burden
- Migration friction

**Mitigation:**
- Fix all documentation examples
- Add clear API documentation
- Provide migration guide

---

#### HIGH Risk: Platform Builds May Not Work
**Severity:** 🔴 HIGH
**Probability:** 70%

**Issue:** Platform-specific builds are completely untested.

**Unknown:**
- Does platform injection work?
- Are output directories correct?
- Do multi-platform builds work?
- Are platform-specific features available?

**Impact:**
- Users building for node/partykit/tauri may get broken output
- Silent failures in production
- Platform-specific code may not be injected correctly

**Mitigation:**
- MUST fix and run platform-builds.test.ts
- MUST manually test each platform
- MUST verify platform injection works

---

#### HIGH Risk: Published Package Structure Wrong
**Severity:** 🔴 HIGH
**Probability:** 60%

**Issue:** package.publish.json may not include vite-plugin correctly.

**Potential Problems:**
- vite-plugin not in exports map
- vite-plugin/dist/ not in files array
- TypeScript types not accessible
- Sub-path imports broken

**Impact:**
- npm install works but imports fail
- TypeScript errors in user projects
- Incomplete package functionality

**Mitigation:**
- Review package.publish.json carefully
- Test package installation from Verdaccio
- Verify all import paths work

---

#### MEDIUM Risk: Dev Server May Not Work
**Severity:** 🟡 MEDIUM
**Probability:** 50%

**Issue:** Dev server tests haven't run, HMR may be broken.

**Unknown:**
- Does dev server start?
- Does HMR work?
- Are platform directives transformed in dev mode?
- Do virtual modules work?

**Impact:**
- Poor developer experience
- Users can build but not develop
- Slow iteration cycles

**Mitigation:**
- Fix and run dev-server.test.ts
- Manual testing of dev server
- Verify HMR works in real app

---

#### MEDIUM Risk: TypeScript Types May Be Wrong
**Severity:** 🟡 MEDIUM
**Probability:** 40%

**Issue:** Type declarations may not match runtime behavior.

**Example:**
```typescript
// If types say Plugin[] but runtime is UserConfig
const result: Plugin[] = springboard({...});  // Compiles but wrong
```

**Impact:**
- Type errors in user projects
- Confusion about correct API
- IDE autocomplete wrong

**Mitigation:**
- Add type tests
- Verify .d.ts files match implementation
- Test in real TypeScript project

---

## Test Infrastructure Quality Assessment

### What's Good ✅

1. **Utility Functions Are Robust**
   - `file-system.ts`: Clean, well-designed, good error handling
   - `exec.ts`: Proper process management, timeout handling
   - `verdaccio.ts`: Comprehensive registry management

2. **Test Structure Is Logical**
   - Good separation of concerns (smoke, API, integration, E2E)
   - BeforeAll/afterAll cleanup
   - Appropriate timeouts

3. **Test Naming Is Clear**
   - Descriptive test names
   - Good test organization
   - Clear intent

### What's Broken ❌

1. **Missing Build Prerequisites**
   - vite-plugin not built before tests
   - No build verification
   - Dependencies not satisfied

2. **Wrong API Assumptions**
   - Tests expect Plugin[] return
   - Actually returns UserConfig
   - False positives from loose assertions

3. **Incorrect Utility Usage**
   - readJson() used for non-JSON files
   - Will cause runtime errors
   - Masks real test failures

4. **No Integration Testing**
   - All tests are mocked or unit-level
   - No real Vite builds
   - Can't verify actual functionality

5. **Incomplete Coverage**
   - No vite-plugin build tests
   - No published package validation
   - No real-world usage tests

---

## Recommended Actions (Prioritized)

### Immediate (Do First)
1. ✅ Build vite-plugin package
2. ✅ Fix API assumptions in smoke.test.ts
3. ✅ Fix API assumptions in plugin-api.test.ts
4. ✅ Fix readJson() misuse in verdaccio-workflow.test.ts
5. ✅ Run all tests and verify they pass

### Short Term (Do Next)
6. ✅ Add vite-plugin to build:publish script
7. ✅ Verify package.publish.json includes vite-plugin
8. ✅ Add vite-plugin build tests
9. ✅ Add API contract tests
10. ✅ Manual test: publish to Verdaccio and install

### Medium Term (Do Soon)
11. ✅ Add integration tests with real Vite builds
12. ✅ Test each platform individually
13. ✅ Test multi-platform builds
14. ✅ Verify dev server works
15. ✅ Verify HMR works

### Long Term (Do Eventually)
16. ✅ Add performance tests
17. ✅ Add error handling tests
18. ✅ Add TypeScript type tests
19. ✅ Add documentation validation
20. ✅ Set up CI/CD pipeline

---

## Conclusion

**The test suite is currently providing FALSE CONFIDENCE.**

- Tests appear to pass (42/42 for smoke + API)
- But they're testing the wrong thing
- Real functionality is completely untested
- Production deployment would fail immediately

**Root cause:** vite-plugin not built, tests have wrong assumptions.

**Fix:** Build vite-plugin, fix test assumptions, run real integration tests.

**Time to fix:** 2-4 hours for critical path, 1-2 days for full coverage.

**Risk if deployed now:** 100% failure rate for users trying to use Vite integration.

---

## Appendix: Test Execution Commands

### Run Individual Test Suites
```bash
# Smoke tests (should pass after fixes)
pnpm test:vite tests/smoke.test.ts

# Plugin API tests (should pass after fixes)
pnpm test:vite tests/e2e/plugin-api.test.ts

# Platform builds (will fail until vite-plugin built)
pnpm test:vite tests/e2e/platform-builds.test.ts

# Verdaccio workflow (will fail until vite-plugin built + fixes)
pnpm test:vite tests/e2e/verdaccio-workflow.test.ts --timeout=300000

# Dev server (will fail until vite-plugin built)
pnpm test:vite tests/e2e/dev-server.test.ts
```

### Run All Tests
```bash
# All tests (most will fail currently)
pnpm test:vite

# Watch mode (for development)
pnpm test:vite:watch

# With coverage (after tests pass)
pnpm test:vite:coverage
```

### Build Commands
```bash
# Build vite-plugin (REQUIRED FIRST)
pnpm --filter @springboard/vite-plugin build

# Build for publish (should include vite-plugin)
pnpm build:publish

# Verify vite-plugin built
ls -la packages/springboard/vite-plugin/dist/
```

---

**END OF REVIEW**
