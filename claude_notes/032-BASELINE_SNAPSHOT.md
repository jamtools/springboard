# Baseline Snapshot: Phase 0 Preparation

**Date**: 2026-01-02
**Purpose**: Document baseline state before refactor branch migration
**Branch**: 0143-vite-support-reo (worktree)

---

## 1. Build Status

### Springboard Package Build

**Command**: `pnpm -C packages/springboard build`

**Status**: FAILED

**Error**:
```
Error: Cannot find module '/private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree/packages/springboard/node_modules/typescript/bin/tsc'
```

**Root Cause**: The pnpm store appears corrupted in this worktree. The symlinked `typescript` module's `bin/` directory is empty:
- Path: `node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/` contains no files
- This prevents `tsc` from running

**Note**: A `dist/` directory already exists with previously compiled output (last modified Dec 31), suggesting the build worked at some point before the pnpm store became corrupted.

### Vite Test App

**Command**: `pnpm -C apps/vite-test dev`

**Status**: FAILED

**Error**:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../node_modules/.pnpm/vite@7.3.0_.../node_modules/rollup/parseAst'
```

**Root Cause**: Same pnpm store corruption issue. The Vite dependencies are not properly resolved.

---

## 2. Current Export Map Structure

**Location**: `packages/springboard/package.json`

### Main Package Info
- Name: `springboard`
- Version: `0.15.40`
- Type: `module`
- Main: `./dist/index.js`

### Export Map Overview

The export map follows a consistent pattern targeting `dist/` outputs:

```json
{
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./core": { "types": "./dist/core/index.d.ts", "import": "./dist/core/index.js" },
  "./server": { "types": "./dist/server/index.d.ts", "import": "./dist/server/index.js" },
  "./server/register": { "types": "./dist/server/register.d.ts", "import": "./dist/server/register.js" },
  ...
}
```

### Platform Entrypoints

| Export Path | Target |
|-------------|--------|
| `./platforms/browser` | `./dist/platforms/browser/index.js` |
| `./platforms/browser/entrypoints/online_entrypoint` | `./dist/platforms/browser/entrypoints/online_entrypoint.js` |
| `./platforms/browser/entrypoints/offline_entrypoint` | `./dist/platforms/browser/entrypoints/offline_entrypoint.js` |
| `./platforms/browser/entrypoints/react_entrypoint` | `./dist/platforms/browser/entrypoints/react_entrypoint.js` |
| `./platforms/node` | `./dist/platforms/node/index.js` |
| `./platforms/node/entrypoints/node_flexible_entrypoint` | `./dist/platforms/node/entrypoints/node_flexible_entrypoint.js` |
| `./platforms/node/entrypoints/node_server_entrypoint` | `./dist/platforms/node/entrypoints/node_server_entrypoint.js` |
| `./platforms/partykit` | `./dist/platforms/partykit/index.js` |
| `./platforms/tauri` | `./dist/platforms/tauri/index.js` |
| `./platforms/react-native` | `./dist/platforms/react-native/index.js` |

### Other Exports

| Export Path | Notes |
|-------------|-------|
| `./vite-plugin` | Points to `./vite-plugin/dist/index.js` (sub-package) |
| `./legacy-cli` | For backward compatibility with esbuild CLI |
| `./data-storage` | Storage layer exports |
| `./engine/engine` | Core engine |
| `./engine/module_api` | Module API |
| `./module_registry/module_registry` | Module registry |
| `./modules/base_module/base_module` | Base module class |

### Notable Observations

1. **Dual exports for entrypoints**: Some entrypoints have both `.ts` suffix exports and non-suffix exports, both pointing to the same `dist/` location. Example:
   - `./platforms/browser/entrypoints/online_entrypoint`
   - `./platforms/browser/entrypoints/online_entrypoint.ts`

2. **Vite plugin in sub-package**: `./vite-plugin` points to `./vite-plugin/dist/index.js`, not `./dist/vite-plugin/...`

3. **HTML template export**: `./platforms/browser/index.html` points to source: `./src/platforms/browser/index.html`

4. **No `local-server.entrypoint` in exports**: The `local-server.entrypoint` is NOT directly exported in the package.json exports map. It's only re-exported from `./server` as `startLocalServer`.

---

## 3. local-server.entrypoint.ts Usage

### File Location
`packages/springboard/src/server/entrypoints/local-server.entrypoint.ts`

### Compiled Output
`packages/springboard/dist/server/entrypoints/local-server.entrypoint.js`

### File Contents Summary
The file exports a default async function that:
1. Creates WebSocket server core dependencies with SQLite
2. Initializes the Hono app
3. Starts an HTTP server on PORT env var (default 1337)
4. Injects WebSocket support
5. Returns `NodeAppDependencies`

### References Found

| File | Line | Usage |
|------|------|-------|
| `packages/springboard/src/server/index.ts` | 34 | `export { default as startLocalServer } from './entrypoints/local-server.entrypoint';` |
| `packages/springboard/src/legacy-cli/build.ts` | 437 | Commented-out reference in `buildServer` function documentation |
| `packages/springboard/src/legacy-cli/build.ts` | 465 | Commented-out reference in legacy code |
| `packages/springboard/cli/src/config/vite_config_generator.ts` | 108 | Used in `platformConfigs.server.platformEntrypoint`: `'springboard/server/entrypoints/local-server.entrypoint.ts'` |

### Usage Analysis

1. **Re-exported from server module**: The `local-server.entrypoint.ts` is re-exported as `startLocalServer` from `springboard/server`, making it the primary way consumers should import it.

2. **Vite CLI config generator**: The CLI's `vite_config_generator.ts` references it as the platform entrypoint for the `server` build target. This is the ACTIVE usage that must be considered during migration.

3. **Legacy CLI**: References in `build.ts` are in commented-out code from the deprecated `buildServer` function.

---

## 4. TypeScript Errors and Warnings

**Status**: Unable to run `pnpm -C packages/springboard check-types` due to pnpm store corruption.

**Existing dist/ status**: The `dist/` directory contains compiled output from Dec 31, 2025, suggesting the code compiled successfully at that time.

**Inferred state**: Based on existing compiled output, no blocking TypeScript errors are expected once dependencies are properly installed.

---

## 5. pnpm Store Corruption Details

The worktree has a corrupted pnpm store where symlinked modules are incomplete:

### Affected Paths
- `node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/` - Empty directory
- `node_modules/.pnpm/vite@7.3.0_.../node_modules/rollup/parseAst` - Missing module

### Resolution Required
Before proceeding with Phase 1, run:
```bash
# Option 1: Clean reinstall
rm -rf node_modules packages/*/node_modules apps/*/node_modules
pnpm install

# Option 2: Force rebuild
pnpm install --force
```

---

## 6. Ready/Not-Ready Assessment

### NOT READY for Phase 1

**Blocking Issues**:
1. pnpm store corruption prevents builds and type checking
2. Cannot verify TypeScript compilation status
3. Cannot verify Vite dev server functionality

### Prerequisites Before Phase 1

1. **Fix pnpm dependencies**: Run `pnpm install --force` or clean reinstall
2. **Verify build works**: `pnpm -C packages/springboard build` must succeed
3. **Verify Vite dev works**: `pnpm -C apps/vite-test dev` must start

### Once Prerequisites Met

The codebase appears ready for Phase 1 migration:
- Export map structure is well-defined and follows correct patterns
- `local-server.entrypoint.ts` usage is documented and isolated to known locations
- Existing `dist/` output suggests code compiles successfully

---

## 7. Summary

| Check | Status | Notes |
|-------|--------|-------|
| Springboard build | FAILED | pnpm store corruption |
| Vite test app | FAILED | pnpm store corruption |
| Export map documented | DONE | 40+ exports identified |
| local-server.entrypoint usage | DONE | 3 active references found |
| TypeScript errors | BLOCKED | Cannot run check-types |
| Ready for Phase 1 | NO | Fix pnpm first |

---

## 8. Next Steps

1. **Immediate**: Fix pnpm store corruption
   ```bash
   cd /private/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/0143-vite-support-reo/phone2daw-jamtools-worktree
   pnpm install --force
   ```

2. **Verify**: Run build and dev commands
   ```bash
   pnpm -C packages/springboard build
   pnpm -C apps/vite-test dev
   ```

3. **Proceed**: Once builds pass, start Phase 1 (Platform-Agnostic Server Layer port)
