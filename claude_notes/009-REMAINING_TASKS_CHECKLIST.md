# Remaining Tasks Checklist

**Generated**: 2025-12-21
**Based on**: 4 comprehensive subagent reviews
**Current Status**: ~30% complete (not 85% as originally estimated)

---

## 🚨 Critical Path (Must Complete First)

### Phase 1: Fix Build Blockers (Est: 1 hour)

- [ ] **Fix ESM Default Export in register.ts**
  - File: `packages/springboard/src/core/engine/register.ts`
  - Issue: Exports `springboard` as named export, but 5 files import as default
  - Fix: Add `export default springboard;` at end of file
  - Files affected:
    - `packages/springboard/src/core/modules/files/files_module.tsx:3`
    - (4 other files - see REVIEW_BUILD_BLOCKERS.md)

- [ ] **Add Missing esbuild Dependency**
  - File: Root `package.json`
  - Issue: `build-for-publish.ts` imports esbuild but it's not in devDependencies
  - Fix: Add `"esbuild": "catalog:"` to devDependencies
  - Then run: `pnpm install`

- [ ] **Fix FilesModule Export**
  - File: `packages/springboard/src/core/modules/files/files_module.tsx`
  - Issue: Type declared but not exported, causing undefined imports
  - Fix: Add `export type { FilesModule };`

- [ ] **Verify build-for-publish.ts Works**
  - Run: `pnpm build:publish`
  - Should complete without errors
  - Verify output in `packages/springboard/dist/`

### Phase 2: Build vite-plugin Package (Est: 30 min)

- [ ] **Build vite-plugin for First Time**
  - Run: `pnpm --filter @springboard/vite-plugin build`
  - Verify: `packages/springboard/vite-plugin/dist/` directory created
  - Verify: `dist/index.js` and `dist/index.d.ts` exist

- [ ] **Add vite-plugin to build:publish Script**
  - File: `scripts/build-for-publish.ts`
  - Add vite-plugin to PACKAGES array
  - Ensure it builds before publishing

- [ ] **Test Import Resolution**
  - Create test file: `import { springboard } from 'springboard/vite-plugin';`
  - Run: `npx tsx test-file.ts`
  - Should not error

---

## 🏗️ Architecture Fixes (Est: 3 days)

### Fix Critical Plugin Architecture Flaws

- [ ] **Fix SSR Configuration Contradiction**
  - File: `packages/springboard/vite-plugin/src/config/platform-configs.ts`
  - Issue: `ssr.noExternal: true` contradicts `rollupOptions.external: ['react']`
  - Options:
    - Option A: Remove `ssr.noExternal: true` entirely
    - Option B: Keep `external` array only (remove `noExternal`)
    - Option C: Use `noExternal: (id) => !externalList.includes(id)`
  - Verify: React is actually externalized in node/partykit builds

- [ ] **Add Multi-Platform Build Isolation**
  - File: `packages/springboard/vite-plugin/src/plugins/build.ts`
  - Issue: Platform builds share process, can interfere with each other
  - Fix: Implement one of:
    - Sequential queue with proper cleanup between builds
    - Child processes for each platform build
    - Separate Vite instances with isolated config
  - Test: Run multi-platform build multiple times, verify no conflicts

- [ ] **Fix Build Hook Usage**
  - File: `packages/springboard/vite-plugin/src/plugins/build.ts`
  - Issue: `writeBundle()` used incorrectly (doesn't guarantee parent build completion)
  - Options:
    - Option A: Use `closeBundle()` with proper sequencing
    - Option B: Add lifecycle management system
    - Option C: Use Vite's programmatic API differently
  - Update comment to reflect actual behavior

### Simplify API Duplication

- [ ] **Consolidate Plugin APIs**
  - Files:
    - `packages/springboard/vite-plugin/src/index.ts`
  - Issue: 3 different APIs (`springboard()`, `springboardPlugins()`, `defineSpringboardConfig()`)
  - Decision needed:
    - Keep only `springboard()` and deprecate others?
    - Keep `springboard()` + `defineSpringboardConfig()` for different use cases?
  - Update documentation to reflect chosen approach

---

## 📦 Package Consolidation (Est: 2 days)

### Complete data-storage Consolidation

- [ ] **Move data-storage into Main Package**
  - Current: Separate `@springboardjs/data-storage` package
  - Target: `springboard/data-storage` export
  - Steps:
    1. Move `packages/springboard/data_storage/src/*` to `packages/springboard/src/data-storage/`
    2. Add `./data-storage` export to main package.json
    3. Update all imports from `@springboardjs/data-storage` to `springboard/data-storage`
    4. Remove `packages/springboard/data_storage/package.json`
    5. Update pnpm-workspace.yaml

- [ ] **Add Missing Subpath Exports**
  - File: `packages/springboard/package.json`
  - Add exports for:
    - `./engine/*` (currently used but not exported)
    - `./test/*` (currently used but not exported)
    - `./data-storage` (after consolidation above)
  - Update `typesVersions` to match

- [ ] **Add vite to peerDependencies**
  - File: `packages/springboard/package.json`
  - Add: `"vite": "catalog:"` to peerDependencies
  - Add: `"vite": { "optional": true }` to peerDependenciesMeta

### Fix Old Import Patterns

- [ ] **Update CLI Imports**
  - File: `packages/springboard/cli/src/**/*.ts`
  - Find all: `@springboardjs/platforms-*` imports
  - Replace with: `springboard/platforms/*`

- [ ] **Update create-springboard-app**
  - File: `packages/springboard/create-springboard-app/templates/**/*`
  - Remove dependencies on:
    - `springboard-server`
    - `@springboardjs/platforms-*`
  - Use only: `springboard` with subpath imports

- [ ] **Update All Source Files**
  - Find: `@springboardjs/data-storage`
  - Replace: `springboard/data-storage`
  - Run: `grep -r "@springboardjs" packages/`
  - Fix all occurrences

---

## ✅ Testing & Validation (Est: 2 days)

### Fix Test Suite

- [ ] **Fix False Positive Tests**
  - File: `tests/smoke.test.ts`
  - File: `tests/e2e/plugin-api.test.ts`
  - Issue: Tests assume wrong API contract
  - Current: Tests check for `config.plugins`
  - Actual: `springboard()` returns `Plugin[]` directly
  - Fix: Update all test assertions to match actual API

- [ ] **Fix Verdaccio Workflow Test**
  - File: `tests/e2e/verdaccio-workflow.test.ts`
  - Issue: Uses `readJson()` on .ts files (lines 182, 199)
  - Fix: Use appropriate method for TypeScript/JavaScript files
  - Or: Change to read package.json instead

- [ ] **Add vite-plugin Build to Test Setup**
  - File: Test configuration or setup
  - Ensure vite-plugin is built before tests run
  - Add to CI/CD pipeline

### Run Full Test Suite

- [ ] **Run and Fix All Tests**
  - Run: `pnpm test:e2e`
  - Target: All tests passing
  - Current status:
    - Smoke: 10/10 ✅ (but false positives)
    - Plugin API: 32/32 ✅ (but false positives)
    - Platform builds: 0/15 ❌
    - Verdaccio workflow: 0/10 ❌
    - Dev server: Unknown

- [ ] **Platform Build Tests**
  - Ensure all 15 platform build tests pass
  - Test each platform independently:
    - browser (3 tests)
    - node (3 tests)
    - partykit (3 tests)
    - tauri (2 tests)
    - react-native (2 tests)
    - multi-platform (2 tests)

- [ ] **Verdaccio E2E Workflow**
  - Full workflow must pass:
    1. Build package
    2. Publish to Verdaccio
    3. Install in test app
    4. Build all platforms
    5. Verify artifacts
    6. Run dev server
  - This is THE critical test

---

## 📝 Documentation Updates (Est: 1 day)

### Update for API Changes

- [ ] **Update VITE_PLUGIN_DESIGN.md**
  - Reflect actual API (Plugin[] not UserConfig)
  - Update examples
  - Document build isolation approach

- [ ] **Update MIGRATION_GUIDE.md**
  - Add section on vite-plugin import
  - Update data-storage import patterns
  - Add troubleshooting for common issues

- [ ] **Update README.md**
  - Fix import examples
  - Update quick start guide
  - Correct package consolidation claims

- [ ] **Update Test App Examples**
  - Files in `test-apps/vite-multi-platform/examples/`
  - Ensure all examples use correct API
  - Test each example actually works

### Fix Inaccurate Documentation

- [ ] **Correct IMPLEMENTATION_SUMMARY.md**
  - Update completion estimate (30% not 85%)
  - Mark package consolidation as incomplete
  - Update test status section
  - Add findings from review documents

---

## 🔍 Code Quality (Est: 1 day)

### Type Safety

- [ ] **Run TypeScript Type Checking**
  - Run: `pnpm check-types`
  - Fix all type errors
  - Especially around:
    - Changed API signatures
    - Import path changes
    - Platform config types

- [ ] **Generate Type Declarations**
  - Verify `.d.ts` files are generated correctly
  - Test that consumers get proper autocomplete
  - Check `typesVersions` field works

### Code Review Items

- [ ] **Remove Dead Code**
  - Remove unused `springboardPlugins()` if deprecated
  - Remove unused `defineSpringboardConfig()` if deprecated
  - Clean up commented-out code

- [ ] **Add Error Handling**
  - Platform build failures should not crash entire build
  - Add try/catch around child builds
  - Provide helpful error messages

- [ ] **Add Debug Logging**
  - Log platform build sequence
  - Log hook execution order
  - Make debugging easier for users

---

## 🚀 Pre-Release Checklist

### Final Validation

- [ ] **Manual Testing**
  - Create fresh test app from scratch
  - Install `springboard` package
  - Import and use vite-plugin
  - Build for all platforms
  - Verify all outputs work

- [ ] **Performance Testing**
  - Dev server startup time < 2s
  - HMR update time < 100ms
  - Build time comparison vs previous
  - Bundle size analysis

- [ ] **Cross-Platform Testing**
  - Test on macOS
  - Test on Linux
  - Test on Windows
  - Verify Node.js version compatibility

### Package Publishing Prep

- [ ] **Update package.json Versions**
  - Decide on version number
  - Update CHANGELOG.md
  - Tag release candidate

- [ ] **Create package.publish.json**
  - Verify exports field is complete
  - Ensure all files are included
  - Check peer dependencies

- [ ] **Test Publish Workflow**
  - Publish to Verdaccio
  - Install from Verdaccio
  - Verify all imports work
  - Test in real project

---

## 📊 Progress Tracking

### Overall Status

- **Phase 1 (Critical Blockers)**: ⬜ Not Started
- **Phase 2 (vite-plugin Build)**: ⬜ Not Started
- **Architecture Fixes**: ⬜ Not Started
- **Package Consolidation**: 🟨 30% Complete
- **Testing & Validation**: ⬜ Not Started
- **Documentation**: 🟨 Partially Complete
- **Code Quality**: ⬜ Not Started
- **Pre-Release**: ⬜ Not Started

### Time Estimates

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Fix Build Blockers | 1 hour | 🔴 Critical |
| Build vite-plugin | 30 min | 🔴 Critical |
| Architecture Fixes | 3 days | 🔴 Critical |
| Package Consolidation | 2 days | 🟡 High |
| Testing & Validation | 2 days | 🔴 Critical |
| Documentation | 1 day | 🟡 High |
| Code Quality | 1 day | 🟢 Medium |
| Pre-Release | 1 day | 🟢 Medium |
| **TOTAL** | **~8-10 days** | |

---

## 📎 Reference Documents

- `REVIEW_TEST_STATUS.md` - Test infrastructure analysis
- `REVIEW_BUILD_BLOCKERS.md` - Build system issues
- `REVIEW_VITE_PLUGIN_INTEGRATION.md` - Architecture review
- `REVIEW_PACKAGE_CONSOLIDATION.md` - Consolidation status
- `IMPLEMENTATION_SUMMARY.md` - Original implementation notes
- `VITE_PLUGIN_DESIGN.md` - Design documentation

---

## ⚠️ Risk Assessment

**High Risk Items** (Must fix before any release):
- SSR configuration contradiction → Production bundle bloat
- Multi-platform race conditions → Intermittent build failures
- False positive tests → Unknown bugs in production
- Broken vite-plugin export → Cannot use package at all

**Medium Risk Items** (Should fix soon):
- Incomplete package consolidation → Confusing for users
- Old import patterns → Breaking changes on upgrade
- Missing error handling → Poor debugging experience

**Low Risk Items** (Nice to have):
- API duplication → Slightly confusing but functional
- Documentation gaps → Can be addressed incrementally

---

**Last Updated**: 2025-12-21
**Status**: Ready for execution
