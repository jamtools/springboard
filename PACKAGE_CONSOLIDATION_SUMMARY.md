# Package Consolidation Summary

**Date**: 2025-12-26
**Status**: Completed

## Overview

This document summarizes the package consolidation work performed to simplify the Springboard package structure. The main goal was to consolidate separate packages into a single `springboard` package with subpath exports.

## Changes Made

### 1. Data Storage Consolidation

**Before:**
- Separate package: `@springboardjs/data-storage`
- Location: `packages/springboard/data_storage/`
- Import: `import { KVStoreFromKysely } from '@springboardjs/data-storage/kv_api_kysely'`

**After:**
- Consolidated into main package
- Location: `packages/springboard/src/data-storage/`
- Import: `import { KVStoreFromKysely } from 'springboard/data-storage'`

**Files moved:**
- `kv_store_db_types.ts` - Database schema types
- `kv_api_kysely.ts` - Kysely-based KV store implementation
- `kv_api_trpc.ts` - HTTP-based KV store
- `sqlite_db.ts` - SQLite database utilities
- `index.ts` (new) - Main entry point with all exports

### 2. New Subpath Exports Added

Added the following exports to `packages/springboard/package.json`:

| Export Path | Description |
|-------------|-------------|
| `./data-storage` | Data storage module (SQLite, Kysely KV store) |
| `./data-storage/*` | Individual data-storage modules |
| `./engine` | Core engine module |
| `./engine/*` | Individual engine modules |
| `./test` | Test utilities (mock dependencies) |
| `./test/*` | Individual test utilities |
| `./types` | Core type definitions |
| `./types/*` | Individual type modules |

### 3. Vite Added to peerDependencies

Added `vite` as an optional peer dependency:

```json
{
  "peerDependencies": {
    "vite": "catalog:"
  },
  "peerDependenciesMeta": {
    "vite": { "optional": true }
  }
}
```

### 4. CLI Platform Imports Updated

Updated `packages/springboard/cli/src/config/vite_config_generator.ts`:

**Before:**
```typescript
platformEntrypoint: '@springboardjs/platforms-browser/entrypoints/online_entrypoint.ts',
htmlTemplate: '@springboardjs/platforms-browser/index.html',
```

**After:**
```typescript
platformEntrypoint: 'springboard/platforms/browser/entrypoints/online_entrypoint.ts',
htmlTemplate: 'springboard/platforms/browser/index.html',
```

All platform configurations updated:
- `browser` / `browser_offline`
- `node`
- `partykit_server` / `partykit_browser`
- `tauri_webview` / `tauri_maestro`
- `mobile`
- `server`

### 5. create-springboard-app Updated

Updated `packages/springboard/create-springboard-app/src/cli.ts`:

**Before:**
```typescript
const installDepsCommand = `${packageManager} install springboard@${version} springboard-server@${version} @springboardjs/platforms-node@${version} @springboardjs/platforms-browser@${version} ...`;
```

**After:**
```typescript
const installDepsCommand = `${packageManager} install springboard@${version} ...`;
```

- Removed separate platform packages
- Removed `springboard-server` (now part of main package)
- Added `vite` to dev dependencies

### 6. Source File Imports Updated

Updated imports in server code:

**`packages/springboard/src/server/ws_server_core_dependencies.ts`:**
```typescript
// Before
import {makeKyselySqliteInstance} from '@springboardjs/data-storage/sqlite_db';
import {KyselyDBWithKVStoreTable} from '@springboardjs/data-storage/kv_store_db_types';
import {KVStoreFromKysely} from '@springboardjs/data-storage/kv_api_kysely';

// After
import {makeKyselySqliteInstance} from '../data-storage/sqlite_db';
import {KyselyDBWithKVStoreTable} from '../data-storage/kv_store_db_types';
import {KVStoreFromKysely} from '../data-storage/kv_api_kysely';
```

**`packages/springboard/src/server/hono_app.ts`:**
```typescript
// Before
import {KVStoreFromKysely} from '@springboardjs/data-storage/kv_api_kysely';

// After
import {KVStoreFromKysely} from '../data-storage/kv_api_kysely';
```

### 7. Build System Updated

Updated `scripts/build-for-publish.ts`:

- Added data-storage entry point configuration
- Updated EXTERNALS list with new import paths
- Updated `generatePublishPackageJson()` with data-storage exports
- Updated typesVersions mapping

### 8. Workspace Configuration Updated

Updated `pnpm-workspace.yaml`:
- Removed `packages/springboard/data_storage` from workspace packages
- Deleted `packages/springboard/data_storage/package.json`

### 9. Test App Updated

Updated `test-apps/vite-multi-platform/package.json`:
- Removed `@springboardjs/data-storage` dependency
- Now uses `springboard/data-storage` subpath import

## Migration Guide

### For Users

If you were using `@springboardjs/data-storage`:

```typescript
// Before
import { KVStoreFromKysely } from '@springboardjs/data-storage/kv_api_kysely';
import { makeKyselySqliteInstance } from '@springboardjs/data-storage/sqlite_db';

// After
import { KVStoreFromKysely, makeKyselySqliteInstance } from 'springboard/data-storage';
// Or for specific modules:
import { KVStoreFromKysely } from 'springboard/data-storage/kv_api_kysely';
```

If you were using `@springboardjs/platforms-*`:

```typescript
// Before
import something from '@springboardjs/platforms-browser/...';

// After
import something from 'springboard/platforms/browser/...';
```

### For New Projects

Use `create-springboard-app` which now installs only the consolidated `springboard` package:

```bash
npx create-springboard-app my-app
```

## Remaining @springboardjs References

The following `@springboardjs` packages remain as they are legitimate separate packages:

- `@springboardjs/shoelace` - Shoelace UI component integration
- `@springboardjs/mantine` - Mantine UI component integration
- `@springboardjs/plugin-svelte` - Svelte framework plugin

## Files Changed

### Created
- `packages/springboard/src/data-storage/index.ts`
- `packages/springboard/src/data-storage/kv_store_db_types.ts`
- `packages/springboard/src/data-storage/kv_api_kysely.ts`
- `packages/springboard/src/data-storage/kv_api_trpc.ts`
- `packages/springboard/src/data-storage/sqlite_db.ts`
- `PACKAGE_CONSOLIDATION_SUMMARY.md` (this file)

### Modified
- `packages/springboard/package.json` - Added exports, typesVersions, peerDependencies
- `packages/springboard/src/server/ws_server_core_dependencies.ts` - Updated imports
- `packages/springboard/src/server/hono_app.ts` - Updated imports
- `packages/springboard/cli/src/config/vite_config_generator.ts` - Updated platform paths
- `packages/springboard/cli/src/vite_plugins/index.ts` - Updated documentation
- `packages/springboard/cli/src/vite_plugins/vite_plugin_html_generate.ts` - Updated documentation
- `packages/springboard/create-springboard-app/src/cli.ts` - Simplified dependencies
- `scripts/build-for-publish.ts` - Added data-storage build configuration
- `pnpm-workspace.yaml` - Removed data_storage package
- `test-apps/vite-multi-platform/package.json` - Removed old dependency

### Deleted
- `packages/springboard/data_storage/package.json`

## Verification

To verify the consolidation is complete:

1. Check no `@springboardjs/data-storage` imports remain in source:
   ```bash
   grep -r "@springboardjs/data-storage" packages/springboard/src/
   # Should return no results
   ```

2. Check no `@springboardjs/platforms-*` imports remain in CLI:
   ```bash
   grep -r "@springboardjs/platforms" packages/springboard/cli/src/
   # Should return no results (only documentation comments)
   ```

3. Build the package:
   ```bash
   pnpm --filter springboard build
   ```

4. Run type checking:
   ```bash
   pnpm --filter springboard check-types
   ```

## Next Steps

1. Run full test suite to verify functionality
2. Update any remaining documentation
3. Test in a fresh project using `create-springboard-app`
4. Verify all platform builds work correctly
