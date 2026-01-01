# Sequential Migration Plan: Refactor Branch to Vite (No Legacy CLI)

**Based on**: 026-REFACTOR_BRANCH_MIGRATION_PLAN.holistic.md
**Constraints**:
- Single `springboard` package only
- No legacy esbuild/CLI support needed
- Must support all songdrive esbuild.ts use cases in Vite
- Follow holistic plan approach (in-place refactor)

---

## Reference: Songdrive esbuild.ts Requirements

**File**: `claude_notes/reference-songdrive-esbuild.ts`

**Key capabilities needed in Vite**:
1. Multiple build targets from single config:
   - Browser (online, offline)
   - Node (maestro)
   - Hono server
   - React Native (webview, main)
   - Desktop (Tauri browser, maestro)

2. Build customization per target:
   - Custom loaders (`.svg`, `.sql`, `.ttf`, etc.)
   - Environment variable injection (`define`)
   - Plugin system (Sentry, Sass, custom transformations)
   - HTML post-processing (`editHtmlFile`)
   - Alias resolution (`devAliases`)
   - External dependencies control

3. Development features:
   - Watch mode (`--watch`)
   - Multiple simultaneous builds
   - Platform-specific env vars

4. Build orchestration:
   - Conditional builds via `SPRINGBOARD_PLATFORM_VARIANT`
   - Sequential execution (browser → node → server)
   - Post-build file operations (copy to apps/)

**Priority**: Phase 7+ (after core migration complete)

---

## Phase 0: Preparation & Validation

**Duration**: 15 minutes
**Agent**: None (manual)
**Blocking**: None

### Tasks
1. Create backup branch
2. Verify current state compiles
3. Move `create-springboard-app` to top-level
4. Review refactor branch files

### Commands
```bash
# 1. Backup
git checkout -b backup-before-holistic-migration

# 2. Typecheck current
pnpm -C packages/springboard check-types

# 3. Move create-springboard-app
mv packages/springboard/create-springboard-app packages/create-springboard-app
# Update pnpm-workspace.yaml if needed

# 4. List refactor branch files to copy
ls -la /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/
ls -la /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/
```

### Acceptance Criteria
- [AC0.1] Backup branch created and pushed
- [AC0.2] `pnpm -C packages/springboard check-types` passes with 0 errors
- [AC0.3] `create-springboard-app` moved to `packages/create-springboard-app`
- [AC0.4] Can list all files to copy from refactor branch
- [AC0.5] Current Vite dev mode works: `cd apps/vite-test && pnpm dev`

### Rollback
```bash
git checkout vite-support
git branch -D backup-before-holistic-migration
```

---

## Phase 1: Copy Platform-Agnostic Server Files

**Duration**: 30 minutes
**Agent**: `general-purpose` (file copying + import rewriting)
**Blocking**: Phase 0

### Tasks
Copy 5 server files from refactor branch to `packages/springboard/src/server/` with import rewrites.

### Files to Copy

#### 1.1: `hono_app.ts` (353 lines)
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/hono_app.ts`
**Target**: `packages/springboard/src/server/hono_app.ts`

**Import Rewrites Required**:
```typescript
// BEFORE (refactor branch - package imports)
import {WebsocketServerCoreDependencies} from '@springboardjs/platforms-node/services/ws_server_core_dependencies';
import {Springboard} from 'springboard/engine/engine';
import {KVStore} from 'springboard/types/module_types';

// AFTER (this branch - relative imports)
import {WebsocketServerCoreDependencies} from '../platforms/node/services/ws_server_core_dependencies';
import {Springboard} from '../core/engine/engine';
import {KVStore} from '../core/types/module_types';
```

**Find/Replace Operations**:
- `springboard/engine/engine` → `../core/engine/engine`
- `springboard/types/module_types` → `../core/types/module_types`
- `@springboardjs/platforms-node/services/ws_server_core_dependencies` → `../platforms/node/services/ws_server_core_dependencies`

#### 1.2: `register.ts` (36 lines)
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts`
**Target**: `packages/springboard/src/server/register.ts`

**Import Rewrites**:
```typescript
// BEFORE
import type {Springboard} from 'springboard/engine/engine';

// AFTER
import type {Springboard} from '../core/engine/engine';
```

#### 1.3: `crossws_json_rpc.ts` (new file)
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/services/crossws_json_rpc.ts`
**Target**: `packages/springboard/src/server/services/crossws_json_rpc.ts`

**Import Rewrites**: None needed (uses external packages only)

#### 1.4: `server_json_rpc.ts`
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/services/server_json_rpc.ts`
**Target**: `packages/springboard/src/server/services/server_json_rpc.ts`

**Import Rewrites**:
```typescript
// BEFORE
import {KVStore} from 'springboard/types/module_types';

// AFTER
import {KVStore} from '../../core/types/module_types';
```

#### 1.5: `server_app_dependencies.ts` (new file)
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/types/server_app_dependencies.ts`
**Target**: `packages/springboard/src/server/types/server_app_dependencies.ts`

**Import Rewrites**:
```typescript
// BEFORE
import {KVStore} from 'springboard/types/module_types';

// AFTER
import {KVStore} from '../../core/types/module_types';
```

### Validation Commands
```bash
# After each file copy, run:
pnpm -C packages/springboard check-types

# Should show new files in git status:
git status packages/springboard/src/server/
```

### Acceptance Criteria
- [AC1.1] All 5 files copied to correct locations
- [AC1.2] All imports rewritten to relative paths
- [AC1.3] `pnpm -C packages/springboard check-types` passes with 0 errors
- [AC1.4] New directory structure exists:
  - `packages/springboard/src/server/services/`
  - `packages/springboard/src/server/types/`
- [AC1.5] Can view git diff showing new files

### Rollback
```bash
git checkout packages/springboard/src/server/hono_app.ts
git checkout packages/springboard/src/server/register.ts
rm -rf packages/springboard/src/server/services/crossws_json_rpc.ts
rm -rf packages/springboard/src/server/types/
git checkout packages/springboard/src/server/services/server_json_rpc.ts
```

---

## Phase 2: Copy Node Platform Files

**Duration**: 30 minutes
**Agent**: `general-purpose` (file copying + import rewriting)
**Blocking**: Phase 1

### Tasks
Copy 5 node platform files from refactor branch with import rewrites.

### Files to Copy

#### 2.1: `node_server_entrypoint.ts` (99 lines) - REPLACE existing
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts`
**Target**: `packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts`

**Import Rewrites**:
```typescript
// BEFORE
import {initApp} from 'springboard-server/src/hono_app';
import {makeWebsocketServerCoreDependenciesWithSqlite} from '@springboardjs/platforms-node/services/ws_server_core_dependencies';
import {LocalJsonNodeKVStoreService} from '@springboardjs/platforms-node/services/node_kvstore_service';
import {Springboard} from 'springboard/engine/engine';

// AFTER
import {initApp} from 'springboard/server/hono_app';  // Export from package.json
import {makeWebsocketServerCoreDependenciesWithSqlite} from '../services/ws_server_core_dependencies';
import {LocalJsonNodeKVStoreService} from '../services/node_kvstore_service';
import {Springboard} from 'springboard/engine/engine';  // Keep package import (exported)
```

#### 2.2: `ws_server_core_dependencies.ts` - MOVE from src/server/
**Source**: `packages/springboard/src/server/ws_server_core_dependencies.ts` (current location)
**Target**: `packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts`

**Import Rewrites**:
```typescript
// Update imports to:
import {KVStoreFromKysely} from '../../data-storage/kv_api_kysely';
import {SqliteDb} from '../../data-storage/sqlite_db';
```

**Alternative**: Copy from refactor branch if different

#### 2.3-2.5: Other node services (copy if changed)
**Source Files**:
- `/Users/mickmister/.../platforms/node/services/node_json_rpc.ts`
- `/Users/mickmister/.../platforms/node/services/node_kvstore_service.ts`
- `/Users/mickmister/.../platforms/node/services/node_file_storage_service.ts`

**Action**: Diff first, copy if different from current branch

### Validation Commands
```bash
# Check node entrypoint compiles
pnpm -C packages/springboard check-types

# Verify ws_server_core_dependencies moved
ls packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts
! ls packages/springboard/src/server/ws_server_core_dependencies.ts
```

### Acceptance Criteria
- [AC2.1] `node_server_entrypoint.ts` copied and imports rewritten
- [AC2.2] `ws_server_core_dependencies.ts` moved to platforms/node/services/
- [AC2.3] Old location (`src/server/ws_server_core_dependencies.ts`) deleted
- [AC2.4] All node services present in `packages/springboard/src/platforms/node/services/`
- [AC2.5] `pnpm -C packages/springboard check-types` passes

### Rollback
```bash
git checkout packages/springboard/src/platforms/node/entrypoints/
mv packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts \
   packages/springboard/src/server/ws_server_core_dependencies.ts
git checkout packages/springboard/src/platforms/node/services/
```

---

## Phase 3: Update Browser Platform RPC Client

**Duration**: 15 minutes
**Agent**: `general-purpose` (file copying)
**Blocking**: Phase 1, Phase 2

### Tasks
Copy HTTP-first browser RPC client from refactor branch.

### Files to Copy

#### 3.1: `browser_json_rpc.ts`
**Source**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/webapp/services/browser_json_rpc.ts`
**Target**: `packages/springboard/src/platforms/browser/services/browser_json_rpc.ts`

**Import Rewrites**:
```typescript
// BEFORE
import {KVStore} from 'springboard/types/module_types';

// AFTER
import {KVStore} from '../../../core/types/module_types';
```

**Important**: Ensure `PUBLIC_USE_WEBSOCKETS_FOR_RPC` flag is retained

### Validation Commands
```bash
pnpm -C packages/springboard check-types

# Check for HTTP-first pattern
grep -A5 "fetch.*rpc" packages/springboard/src/platforms/browser/services/browser_json_rpc.ts
```

### Acceptance Criteria
- [AC3.1] `browser_json_rpc.ts` copied with correct imports
- [AC3.2] HTTP-first pattern visible in code (fetch-based RPC)
- [AC3.3] `PUBLIC_USE_WEBSOCKETS_FOR_RPC` environment variable check present
- [AC3.4] `pnpm -C packages/springboard check-types` passes
- [AC3.5] File size similar to refactor branch version (~200+ lines for HTTP support)

### Rollback
```bash
git checkout packages/springboard/src/platforms/browser/services/browser_json_rpc.ts
```

---

## Phase 4: Update Core Package (ModuleAPI + HTTP KV)

**Duration**: 15 minutes
**Agent**: `general-purpose` (targeted changes)
**Blocking**: None (independent)

### Tasks
Apply refactor branch changes to 2 core files.

### Files to Update

#### 4.1: `module_api.ts` - RPC Middleware Results
**File**: `packages/springboard/src/core/engine/module_api.ts`

**Changes from refactor branch**:
1. Add `RpcMiddlewareResults` interface
2. Update `ActionCallback` signature to include middleware results
3. Ensure `createActions` returns new object (not mutating input)

**Validation**: Check git diff from refactor branch
```bash
cd /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree
git show refactor-springboard-server:packages/springboard/core/engine/module_api.ts > /tmp/module_api.refactor.ts

# Compare
diff /tmp/module_api.refactor.ts \
     /private/var/.../phone2daw-jamtools-worktree/packages/springboard/src/core/engine/module_api.ts
```

#### 4.2: `http_kv_store_client.ts` - Null Safety
**File**: `packages/springboard/src/core/services/http_kv_store_client.ts`

**Changes from refactor branch**:
1. Add null check for JSON response
2. Remove `HttpKvStoreClient` alias if present (or keep for compatibility)

### Validation Commands
```bash
pnpm -C packages/springboard check-types
pnpm -C packages/springboard test  # If tests exist
```

### Acceptance Criteria
- [AC4.1] `module_api.ts` includes middleware results in action callbacks
- [AC4.2] `createActions` returns new object (test by checking if it mutates input)
- [AC4.3] `http_kv_store_client.ts` has null safety for JSON parsing
- [AC4.4] `pnpm -C packages/springboard check-types` passes
- [AC4.5] No breaking changes to existing action creation patterns

### Rollback
```bash
git checkout packages/springboard/src/core/engine/module_api.ts
git checkout packages/springboard/src/core/services/http_kv_store_client.ts
```

---

## Phase 5: Update Vite Plugin Template (Critical)

**Duration**: 45 minutes
**Agent**: `general-purpose` (template rewriting)
**Blocking**: Phase 1, Phase 2

### Tasks
Rewrite `node-entry.template.ts` to use refactor branch patterns.

### Files to Update

#### 5.1: `node-entry.template.ts`
**File**: `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`

**Current Pattern** (simplified):
```typescript
import { initApp } from 'springboard/server';
import { serve } from '@hono/node-server';

const { app } = initApp(kvDeps);
const server = serve({ fetch: app.fetch, port: __PORT__ });
```

**New Pattern** (from refactor branch):
```typescript
import { serve } from '@hono/node-server';
import crosswsNode from 'crossws/adapters/node';
import { initApp } from 'springboard/server/hono_app';
import { makeWebsocketServerCoreDependenciesWithSqlite } from 'springboard/platforms/node/services/ws_server_core_dependencies';
import { LocalJsonNodeKVStoreService } from 'springboard/platforms/node/services/node_kvstore_service';
import { Springboard } from 'springboard/engine/engine';
import '__USER_ENTRY__';

setTimeout(async () => {
    const nodeKvDeps = await makeWebsocketServerCoreDependenciesWithSqlite();
    const useWebSocketsForRpc = process.env.USE_WEBSOCKETS_FOR_RPC === 'true';

    let wsNode: ReturnType<typeof crosswsNode>;

    const {app, serverAppDependencies, injectResources, createWebSocketHooks} = initApp({
        broadcastMessage: (message) => wsNode.publish('event', message),
        remoteKV: nodeKvDeps.kvStoreFromKysely,
        userAgentKV: new LocalJsonNodeKVStoreService('userAgent'),
    });

    wsNode = crosswsNode({
        hooks: createWebSocketHooks(useWebSocketsForRpc)
    });

    const port = __PORT__;

    const server = serve({
        fetch: app.fetch,
        port,
    }, (info) => {
        console.log(\`Server listening on http://localhost:\${info.port}\`);
    });

    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', \`http://\${request.headers.host}\`);
        if (url.pathname === '/ws') {
            wsNode.handleUpgrade(request, socket, head);
        } else {
            socket.end('HTTP/1.1 404 Not Found\\r\\n\\r\\n');
        }
    });

    const coreDeps = {
        log: console.log,
        showError: console.error,
        storage: serverAppDependencies.storage,
        isMaestro: () => true,
        rpc: serverAppDependencies.rpc,
    };
    Object.assign(coreDeps, serverAppDependencies);

    const engine = new Springboard(coreDeps, {});

    injectResources({
        engine,
        serveStaticFile: async (c, fileName, headers) => {
            const webappDistFolder = process.env.WEBAPP_FOLDER || './dist';
            const fullPath = \`\${webappDistFolder}/\${fileName}\`;
            const fs = await import('node:fs');
            const data = await fs.promises.readFile(fullPath, 'utf-8');
            c.status(200);
            if (headers) {
                Object.entries(headers).forEach(([key, value]) => {
                    c.header(key, value);
                });
            }
            return c.body(data);
        },
        getEnvValue: name => process.env[name],
    });

    await engine.initialize();
});

export default () => {};
```

**Key Changes**:
1. New `initApp` signature with dependency injection
2. Crossws adapter setup (`crosswsNode`)
3. WebSocket upgrade handler (`server.on('upgrade', ...)`)
4. Resource injection (`injectResources()`)
5. Environment variable: `USE_WEBSOCKETS_FOR_RPC`

### Validation Commands
```bash
# Build vite-test app
cd apps/vite-test
pnpm build

# Check generated entry file
cat .springboard/node-entry.ts

# Run production build
node dist/node/index.mjs &
SERVER_PID=$!

# Test endpoints
curl http://localhost:3001/
curl http://localhost:3001/kv/get-all

# Kill server
kill $SERVER_PID
```

### Acceptance Criteria
- [AC5.1] Template generates code with new `initApp` signature
- [AC5.2] Crossws adapter code present in generated file
- [AC5.3] WebSocket upgrade handler present
- [AC5.4] `injectResources()` call present
- [AC5.5] Production build succeeds: `cd apps/vite-test && pnpm build`
- [AC5.6] Server starts: `node dist/node/index.mjs`
- [AC5.7] HTTP works: `curl http://localhost:3001/` returns HTML
- [AC5.8] RPC works: `curl -X POST http://localhost:3001/rpc` returns JSON
- [AC5.9] WebSocket connects: Use browser DevTools to test `ws://localhost:3001/ws`

### Rollback
```bash
git checkout packages/springboard/vite-plugin/src/templates/node-entry.template.ts
```

---

## Phase 6: Add Dependencies

**Duration**: 10 minutes
**Agent**: None (manual)
**Blocking**: Phase 1

### Tasks
Add new dependencies to `packages/springboard/package.json`.

### Changes

#### 6.1: Add runtime dependencies
**File**: `packages/springboard/package.json`

```json
{
  "dependencies": {
    "crossws": "^0.2.4",
    "srvx": "^0.8.6"
  }
}
```

**Note**: `json-rpc-2.0` should already be present

### Validation Commands
```bash
cd packages/springboard
pnpm install

# Verify packages installed
ls node_modules/crossws
ls node_modules/srvx
```

### Acceptance Criteria
- [AC6.1] `crossws` added to dependencies
- [AC6.2] `srvx` added to dependencies
- [AC6.3] `pnpm install` completes without errors
- [AC6.4] `node_modules/crossws` exists
- [AC6.5] `node_modules/srvx` exists

### Rollback
```bash
git checkout packages/springboard/package.json
pnpm install
```

---

## Phase 7: Update Package Exports

**Duration**: 15 minutes
**Agent**: None (manual JSON editing)
**Blocking**: Phase 1, Phase 2

### Tasks
Update `packages/springboard/package.json` exports for new paths.

### Changes

#### 7.1: Add new exports
**File**: `packages/springboard/package.json`

```json
{
  "exports": {
    "./server": "./src/server/index.ts",
    "./server/register": "./src/server/register.ts",
    "./server/hono_app": "./src/server/hono_app.ts",
    "./server/services/*": "./src/server/services/*.ts",
    "./platforms/node/services/ws_server_core_dependencies": "./src/platforms/node/services/ws_server_core_dependencies.ts",
    "./platforms/node/services/node_kvstore_service": "./src/platforms/node/services/node_kvstore_service.ts",
    "./engine/engine": "./src/core/engine/engine.tsx"
  }
}
```

**Note**: Keep all existing exports, add these new ones

### Validation Commands
```bash
# Test imports work
cd apps/vite-test
node -e "console.log(require.resolve('springboard/server/hono_app'))"
node -e "console.log(require.resolve('springboard/platforms/node/services/ws_server_core_dependencies'))"
```

### Acceptance Criteria
- [AC7.1] All new exports added to package.json
- [AC7.2] Existing exports still present
- [AC7.3] `springboard/server/hono_app` resolves correctly
- [AC7.4] `springboard/platforms/node/services/*` resolves correctly
- [AC7.5] No export resolution errors in typecheck

### Rollback
```bash
git checkout packages/springboard/package.json
```

---

## Phase 8: Full Validation Suite

**Duration**: 30 minutes
**Agent**: None (manual testing)
**Blocking**: All previous phases

### Tasks
Run comprehensive validation of migration.

### Test Cases

#### 8.1: TypeScript Compilation
```bash
pnpm -C packages/springboard check-types
# MUST pass with 0 errors
```

#### 8.2: Vite Dev Mode
```bash
cd apps/vite-test
pnpm dev
# Open http://localhost:5173
# Test: App loads
# Test: HMR works (edit tic_tac_toe.tsx)
# Test: Click cells, verify state updates
```

#### 8.3: Vite Production Build
```bash
cd apps/vite-test
pnpm build

# Check output structure
ls -la dist/node/
ls -la dist/assets/

# Run production server
node dist/node/index.mjs
```

#### 8.4: Runtime Endpoints
With server running from 8.3:
```bash
# Test HTTP
curl http://localhost:3001/
# Should return HTML

# Test KV
curl http://localhost:3001/kv/get-all
# Should return JSON

# Test RPC
curl -X POST http://localhost:3001/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}'
# Should return JSON response
```

#### 8.5: WebSocket Connection
```javascript
// In browser console at http://localhost:3001
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.send(JSON.stringify({jsonrpc: '2.0', method: 'test', params: {}, id: 1}));
```

#### 8.6: Import Path Verification
```bash
# Verify all imports use correct patterns
cd packages/springboard/src/server
grep -r "springboard-server" .
# Should return: no matches

grep -r "@springboardjs/platforms" .
# Should return: no matches (all should be relative)
```

### Acceptance Criteria
- [AC8.1] TypeScript compiles with 0 errors
- [AC8.2] Vite dev mode works (HMR, app renders)
- [AC8.3] Vite production build completes
- [AC8.4] Production server starts successfully
- [AC8.5] HTTP endpoint returns HTML
- [AC8.6] `/kv/get-all` returns JSON
- [AC8.7] `/rpc` endpoint responds to POST
- [AC8.8] WebSocket connection succeeds
- [AC8.9] WebSocket RPC messages work
- [AC8.10] No `springboard-server` imports exist
- [AC8.11] No `@springboardjs/platforms-*` package imports exist

### Rollback
If any acceptance criteria fail:
```bash
git checkout backup-before-holistic-migration
```

---

## Phase 9: Documentation & Cleanup

**Duration**: 20 minutes
**Agent**: None (manual)
**Blocking**: Phase 8 (all tests pass)

### Tasks
Document changes and clean up.

### Documentation

#### 9.1: Update CHANGELOG.md
```markdown
## [Unreleased]

### Changed
- Migrated to platform-agnostic server architecture from refactor branch
- Server code now uses dependency injection pattern
- WebSocket implementation switched from @hono/node-ws to crossws
- RPC now uses HTTP-first approach with optional WebSocket
- All code consolidated into single `springboard` package

### Added
- `crossws` for universal WebSocket support
- `srvx` for server utilities
- New export paths: `springboard/server/hono_app`, `springboard/platforms/node/services/*`

### Removed
- Legacy CLI support (esbuild-based builds)
- `springboard-cli` package references
- `@springboardjs/platforms-*` separate packages
```

#### 9.2: Update README (if applicable)
- Remove references to `springboard-cli`
- Document new import paths
- Update examples to use Vite

#### 9.3: Clean up unused files
```bash
# Remove old server files if they exist
rm -f packages/springboard/src/server/entrypoints/local-server.entrypoint.ts
```

### Acceptance Criteria
- [AC9.1] CHANGELOG.md updated with migration details
- [AC9.2] README reflects Vite-first approach
- [AC9.3] No references to `springboard-cli` in docs
- [AC9.4] Unused files removed
- [AC9.5] Git history shows clean commit

### Final Commit
```bash
git add -A
git commit -m "Migrate to platform-agnostic server architecture

- Copy platform-agnostic server files from refactor branch
- Update Vite template to use new initApp signature
- Switch to crossws for universal WebSocket support
- Implement HTTP-first RPC with optional WebSocket
- Update package exports for new paths
- Add crossws and srvx dependencies
- Remove legacy CLI support

All tests passing. Vite dev and production builds working.

Follows holistic migration plan (026).
"
```

---

## Summary Table

| Phase | Duration | Agent | Blocking | Key Deliverable |
|-------|----------|-------|----------|-----------------|
| 0 | 15 min | Manual | None | Backup & validation |
| 1 | 30 min | general-purpose | Phase 0 | Server files copied |
| 2 | 30 min | general-purpose | Phase 1 | Node platform files copied |
| 3 | 15 min | general-purpose | Phase 1, 2 | Browser RPC updated |
| 4 | 15 min | general-purpose | None | Core changes applied |
| 5 | 45 min | general-purpose | Phase 1, 2 | Vite template rewritten |
| 6 | 10 min | Manual | Phase 1 | Dependencies added |
| 7 | 15 min | Manual | Phase 1, 2 | Exports updated |
| 8 | 30 min | Manual | All | Full validation |
| 9 | 20 min | Manual | Phase 8 | Documentation |
| **Total** | **3h 45min** | | | **Migration complete** |

---

## Subagent Execution Strategy

### Phase Sequencing
1. **Phases 0, 6, 7, 9**: Manual (no subagent)
2. **Phases 1-5**: Use `general-purpose` subagent sequentially
3. **Phase 8**: Manual validation (critical - don't automate)

### Subagent Instructions Template

For each phase with subagent:
```markdown
Agent: general-purpose
Task: [Phase name]

Context:
- Working directory: /private/var/folders/.../phone2daw-jamtools-worktree
- Refactor branch: /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree
- Must follow holistic plan (026)

Instructions:
[Specific tasks from phase]

Acceptance Criteria:
[AC items from phase]

Validation:
Run: pnpm -C packages/springboard check-types
Expected: 0 errors

DO NOT proceed to next phase automatically.
Return control after validation passes.
```

### Communication Between Phases
Each phase must:
1. Complete all tasks
2. Pass all acceptance criteria
3. Return control to user
4. User approves before next phase starts

---

## Post-Migration: Songdrive Use Cases (Future Work)

**Reference**: `claude_notes/reference-songdrive-esbuild.ts`

**Phase 10+ tasks** (not in this migration):
1. Multi-target Vite config support
2. Custom loaders in Vite
3. Plugin system for Vite
4. HTML post-processing hooks
5. Build orchestration
6. React Native support in Vite

**Priority**: Medium (after core migration stable)

---

## Rollback Strategy

### Complete Rollback
```bash
git reset --hard backup-before-holistic-migration
pnpm install
```

### Phase-Specific Rollback
See "Rollback" section in each phase.

### Validation After Rollback
```bash
pnpm -C packages/springboard check-types
cd apps/vite-test && pnpm dev
```

---

## Notes

1. **No legacy CLI**: Intentionally excluded from this plan
2. **Single package**: All changes stay in `packages/springboard/src/`
3. **Import discipline**: Critical - test after each file copy
4. **Vite-first**: Don't break current working Vite setup
5. **Incremental**: Each phase is independently rollbackable
