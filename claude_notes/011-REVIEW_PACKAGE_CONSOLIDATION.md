# Package Consolidation Review

**Date:** 2025-12-21
**Reviewer:** Code Review Expert
**Status:** INCOMPLETE - Multiple Critical Issues Found

---

## Executive Summary

**The package consolidation claim of "14+ packages -> 1 package" is FALSE.**

The reality is:
- **Still shipping 7+ separate npm packages** under `packages/springboard/`
- **`@springboardjs/data-storage` is NOT consolidated** - it remains a separate package
- **`@springboard/vite-plugin` is NOT consolidated** - it has its own package.json with separate npm name
- **The `springboard/vite-plugin` export exists** but points to files that don't exist (no `dist/` directory)
- **Old import patterns remain throughout the codebase** (both in source and tooling)
- **`create-springboard-app` still installs old, unconsolidated packages**

### Severity Assessment

| Issue | Severity | Impact |
|-------|----------|--------|
| vite-plugin dist missing | CRITICAL | Export will fail at runtime |
| data-storage not consolidated | HIGH | Users still need separate install |
| Old imports in source code | HIGH | Breaks runtime if consolidated |
| create-springboard-app outdated | HIGH | New users get broken setup |
| Missing subpath exports | MEDIUM | Some imports will fail |
| vite not in peerDependencies | MEDIUM | vite-plugin may fail |

---

## Package.json Analysis

### Main Package Exports (`packages/springboard/package.json`)

**Declared Exports:**
```json
{
  ".": "./src/index.ts",
  "./server": "./src/server/index.ts",
  "./platforms/node": "./src/platforms/node/index.ts",
  "./platforms/browser": "./src/platforms/browser/index.ts",
  "./platforms/tauri": "./src/platforms/tauri/index.ts",
  "./platforms/partykit": "./src/platforms/partykit/index.ts",
  "./platforms/react-native": "./src/platforms/react-native/index.ts",
  "./core": "./src/core/index.ts",
  "./core/*": "./src/core/*.ts",
  "./vite-plugin": "./vite-plugin/dist/index.js"
}
```

### CRITICAL ISSUE: vite-plugin Export is Broken

The export `./vite-plugin` points to `./vite-plugin/dist/index.js`, but:

```
$ ls packages/springboard/vite-plugin/
package.json  src/  tsconfig.json
```

**The `dist/` directory DOES NOT EXIST.** This means:
1. Anyone importing `springboard/vite-plugin` will get a module not found error
2. The build process for vite-plugin has never been run or the output is gitignored

### Missing Exports

The following import patterns are used in the codebase but NOT in exports:

| Import Pattern | Used In | Status |
|----------------|---------|--------|
| `springboard/engine/engine` | `apps/small_apps/tic_tac_toe/tic_tac_toe.spec.tsx` | NOT EXPORTED |
| `springboard/engine/module_api` | Multiple files in `packages/jamtools/` | NOT EXPORTED |
| `springboard/test/mock_core_dependencies` | Test files | NOT EXPORTED |

The `./core/*` wildcard may cover some of these, but `./engine/*` and `./test/*` are NOT exported.

### Peer Dependencies Issues

**Main package (`springboard`):**
- `vite` is NOT in peerDependencies
- This is a problem because `springboard/vite-plugin` requires Vite

**CLI package (`springboard-cli`):**
- Has `vite` in peerDependencies: `"^5.0.0 || ^6.0.0"` - CORRECT

### Files Array

```json
{
  "files": ["src", "dist", "vite-plugin"]
}
```

- Includes `vite-plugin` directory - GOOD
- But `vite-plugin/dist/` doesn't exist - BROKEN

### typesVersions Analysis

```json
{
  "typesVersions": {
    "*": {
      "vite-plugin": ["./vite-plugin/dist/index.d.ts"]
    }
  }
}
```

Points to non-existent `.d.ts` file since `dist/` doesn't exist.

---

## Separate Packages Status

### Packages Still Shipping Separately

| Package | npm Name | Consolidated? |
|---------|----------|---------------|
| `packages/springboard/` | `springboard` | Main package |
| `packages/springboard/cli/` | `springboard-cli` | SEPARATE |
| `packages/springboard/vite-plugin/` | `@springboard/vite-plugin` | SEPARATE |
| `packages/springboard/data_storage/` | `@springboardjs/data-storage` | SEPARATE |
| `packages/springboard/create-springboard-app/` | `create-springboard-app` | SEPARATE |
| `packages/springboard/plugins/svelte/` | `@springboardjs/plugin-svelte` | SEPARATE |
| `packages/springboard/external/mantine/` | `@springboardjs/mantine` | SEPARATE |
| `packages/springboard/external/shoelace/` | `@springboardjs/shoelace` | SEPARATE |

**Total: 8 separate packages, NOT 1 as claimed**

### data-storage Analysis

Location: `packages/springboard/data_storage/`

```json
{
  "name": "@springboardjs/data-storage",
  "exports": {
    ".": "./dist/index.mjs"
  }
}
```

**Issues:**
1. Still uses `@springboardjs/data-storage` npm name
2. Main springboard package has imports from this package (in `src/server/ws_server_core_dependencies.ts`)
3. No `springboard/data-storage` export exists in main package
4. Test app installs it separately: `"@springboardjs/data-storage": "0.2.0"`

**Files importing `@springboardjs/data-storage`:**
- `packages/springboard/src/server/ws_server_core_dependencies.ts`
- `packages/springboard/src/server/hono_app.ts`

This means **even the main springboard package depends on an external package** - consolidation is incomplete.

### vite-plugin Analysis

Location: `packages/springboard/vite-plugin/`

**package.json says:**
```json
{
  "name": "@springboard/vite-plugin",
  "exports": {
    ".": "./dist/index.js"
  }
}
```

**Problems:**
1. Package name is `@springboard/vite-plugin` (NOT the consolidated `springboard` name)
2. The main package exports `./vite-plugin` pointing to this directory
3. BUT the `dist/` directory doesn't exist
4. The vite-plugin has its OWN package.json and is listed in pnpm-workspace.yaml separately

---

## Import Path Audit

### Old Import Patterns Still in Use

#### `@springboardjs/data-storage` (should be `springboard/data-storage`)

**Found in source code (not just docs):**
```
packages/springboard/src/server/ws_server_core_dependencies.ts:
  import {makeKyselySqliteInstance} from '@springboardjs/data-storage/sqlite_db';
  import {KyselyDBWithKVStoreTable} from '@springboardjs/data-storage/kv_store_db_types';
  import {KVStoreFromKysely} from '@springboardjs/data-storage/kv_api_kysely';

packages/springboard/src/server/hono_app.ts:
  import {KVStoreFromKysely} from '@springboardjs/data-storage/kv_api_kysely';

test-apps/vite-multi-platform/package.json:
  "@springboardjs/data-storage": "0.2.0"
```

#### `@springboard/vite-plugin` alias

**Found in:**
```
vitest.config.ts:
  '@springboard/vite-plugin': path.resolve(__dirname, 'packages/springboard/vite-plugin/src')
```

This alias masks the fact that the export is broken.

#### `@springboardjs/platforms-*` (should be `springboard/platforms/*`)

**Found in CLI source code:**
```
packages/springboard/cli/src/config/vite_config_generator.ts:
  - '@springboardjs/platforms-browser/entrypoints/online_entrypoint.ts'
  - '@springboardjs/platforms-browser/index.html'
  - '@springboardjs/platforms-node/entrypoints/node_flexible_entrypoint.ts'
  - '@springboardjs/platforms-partykit/src/entrypoints/...'
  - '@springboardjs/platforms-tauri/entrypoints/...'
  - '@springboardjs/platforms-react-native/entrypoints/...'
```

These paths reference packages that no longer exist as separate packages!

#### `springboard-server` (should be `springboard/server`)

**Found in:**
```
packages/springboard/create-springboard-app/src/cli.ts:
  springboard-server@${version}

apps/small_apps/app_with_server_module/app_with_server_module.tsx:
  import {serverRegistry} from 'springboard-server/src/register';
```

#### `springboard/engine/*` (no export exists)

**Found in:**
```
apps/small_apps/tic_tac_toe/tic_tac_toe.spec.tsx:
  import {Springboard} from 'springboard/engine/engine';

packages/jamtools/*/: (multiple files)
  import {ModuleAPI} from 'springboard/engine/module_api';
```

These imports rely on TypeScript path mapping, not actual exports.

---

## Missing Exports Analysis

### Exports That Should Exist But Don't

| Import Used | Should Be Export | Current Status |
|-------------|-----------------|----------------|
| `springboard/engine/engine` | `"./engine/*"` | NOT EXPORTED |
| `springboard/engine/module_api` | `"./engine/*"` | NOT EXPORTED |
| `springboard/test/mock_core_dependencies` | `"./test/*"` | NOT EXPORTED |
| `springboard/data-storage` | `"./data-storage"` | NOT EXPORTED |
| `springboard/data-storage/*` | `"./data-storage/*"` | NOT EXPORTED |

### TypeScript Path Mapping Masking Issues

The `vitest.config.ts` has aliases:
```typescript
resolve: {
  alias: {
    '@springboard/vite-plugin': path.resolve(__dirname, 'packages/springboard/vite-plugin/src'),
  },
}
```

This means tests pass locally but the actual exports are broken.

---

## TypeScript Type Exports Review

### typesVersions in Main Package

```json
{
  "typesVersions": {
    "*": {
      "server": ["./src/server/index.ts"],
      "platforms/node": ["./src/platforms/node/index.ts"],
      "platforms/browser": ["./src/platforms/browser/index.ts"],
      "platforms/tauri": ["./src/platforms/tauri/index.ts"],
      "platforms/partykit": ["./src/platforms/partykit/index.ts"],
      "platforms/react-native": ["./src/platforms/react-native/index.ts"],
      "core": ["./src/core/index.ts"],
      "core/*": ["./src/core/*"],
      "vite-plugin": ["./vite-plugin/dist/index.d.ts"]
    }
  }
}
```

**Issues:**
1. `vite-plugin` points to non-existent `./vite-plugin/dist/index.d.ts`
2. Missing `engine/*` and `test/*` entries used by codebase
3. Missing `data-storage` entries

---

## Consolidation Gaps

### Critical Gaps

1. **data-storage Not Consolidated**
   - Still separate package `@springboardjs/data-storage`
   - Main springboard package DEPENDS on it
   - No `springboard/data-storage` export

2. **vite-plugin Export Broken**
   - Export path exists but dist/ doesn't
   - Package has separate name `@springboard/vite-plugin`
   - Listed separately in pnpm-workspace.yaml

3. **CLI Uses Non-Existent Imports**
   - References `@springboardjs/platforms-*` packages
   - These are supposed to be consolidated but CLI still uses old paths

4. **create-springboard-app Installs Old Packages**
   ```typescript
   const installDepsCommand = `${packageManager} install
     springboard@${version}
     springboard-server@${version}  // SHOULD BE springboard/server
     @springboardjs/platforms-node@${version}  // DOESN'T EXIST
     @springboardjs/platforms-browser@${version}  // DOESN'T EXIST
   `;
   ```

### Structural Issues

1. **Too Many Separate Workspaces**
   From pnpm-workspace.yaml:
   ```yaml
   - "packages/springboard"
   - "packages/springboard/cli"
   - "packages/springboard/vite-plugin"
   - "packages/springboard/data_storage"
   - "packages/springboard/plugins/*"
   - "packages/springboard/external/*"
   ```

   Each of these is a SEPARATE npm package, not part of the consolidated `springboard` package.

2. **Inconsistent Naming**
   - `@springboard/vite-plugin` (no "js")
   - `@springboardjs/data-storage` (has "js")
   - `@springboardjs/mantine` (has "js")

---

## Breaking Changes for Users

### If Consolidation Were Completed

Users would need to change:

| Old Import | New Import |
|------------|------------|
| `import x from 'springboard-server'` | `import x from 'springboard/server'` |
| `import x from '@springboardjs/platforms-node'` | `import x from 'springboard/platforms/node'` |
| `import x from '@springboardjs/platforms-browser'` | `import x from 'springboard/platforms/browser'` |
| `import x from '@springboardjs/platforms-tauri'` | `import x from 'springboard/platforms/tauri'` |
| `import x from '@springboardjs/platforms-partykit'` | `import x from 'springboard/platforms/partykit'` |
| `import x from '@springboardjs/platforms-react-native'` | `import x from 'springboard/platforms/react-native'` |
| `import x from '@springboardjs/data-storage'` | `import x from 'springboard/data-storage'` |
| `import x from '@springboard/vite-plugin'` | `import x from 'springboard/vite-plugin'` |

### Current Reality

Users CANNOT use the consolidated imports because:
1. The exports don't exist or point to non-existent files
2. The source code itself still uses old imports
3. The CLI generates code with old imports

---

## Recommendations

### Immediate Actions Required

1. **Build vite-plugin dist/**
   ```bash
   cd packages/springboard/vite-plugin
   npm run build
   ```
   Or update the export to point to source files.

2. **Add data-storage to Exports**
   ```json
   {
     "./data-storage": "./data_storage/index.ts",
     "./data-storage/*": "./data_storage/*.ts"
   }
   ```
   Note: Directory is `data_storage` (underscore) not `data-storage` (hyphen).

3. **Add Missing Subpath Exports**
   ```json
   {
     "./engine/*": "./src/core/engine/*.ts",
     "./test/*": "./src/test/*.ts"
   }
   ```

4. **Add vite to peerDependencies**
   ```json
   {
     "peerDependencies": {
       "vite": "^5.0.0 || ^6.0.0"
     },
     "peerDependenciesMeta": {
       "vite": { "optional": true }
     }
   }
   ```

5. **Fix CLI Platform Config**
   Update `packages/springboard/cli/src/config/vite_config_generator.ts` to use:
   - `springboard/platforms/browser` instead of `@springboardjs/platforms-browser`
   - etc.

6. **Fix create-springboard-app**
   Update to install just `springboard` package, not individual platform packages.

7. **Update Internal Imports**
   Change all imports from `@springboardjs/data-storage` to relative imports or the consolidated path.

### Medium-Term Actions

1. Remove separate package.json files for packages that should be consolidated
2. Remove from pnpm-workspace.yaml entries that shouldn't be separate packages
3. Add comprehensive export verification tests
4. Update IMPLEMENTATION_SUMMARY.md to reflect actual state

---

## Verification Checklist

- [ ] `springboard/vite-plugin` resolves correctly
- [ ] `springboard/data-storage` export exists
- [ ] `springboard/engine/*` exports exist
- [ ] `springboard/test/*` exports exist
- [ ] CLI uses consolidated import paths
- [ ] create-springboard-app installs correct packages
- [ ] No `@springboardjs/*` imports in source code
- [ ] All typesVersions point to existing files
- [ ] vite-plugin/dist/ directory exists after build
- [ ] Test apps can install and run with consolidated package only

---

## Conclusion

The package consolidation is approximately **30% complete**. The exports field has been added, but:

1. Critical exports are broken (vite-plugin dist doesn't exist)
2. data-storage remains unconsolidated
3. Internal code still uses old import paths
4. Tooling (CLI, create-app) generates old import paths
5. Multiple packages still ship separately

**The "14+ packages -> 1 package" claim is misleading.** The reality is still 7+ separate packages with a partially-working exports field in the main package.

---

*Generated by Code Review Expert*
