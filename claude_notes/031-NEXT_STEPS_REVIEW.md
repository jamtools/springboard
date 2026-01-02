# Next Steps Review: Refactor Branch Migration to Vite

**Date**: 2026-01-01
**Status**: Needs updates before implementation
**Scope**: Migrate platform-agnostic server architecture from refactor-springboard-server branch into current Vite-based branch

---

## Executive Summary

This document consolidates findings from four planning documents (024, 025, 028, 029, 030, 026) and provides a clear, executable path forward for migrating the refactor branch's platform abstraction layer into the current Vite branch.

### Critical Decisions Confirmed

1. **Single package only**: Everything stays in `packages/springboard/src/`. No new packages created.
2. **Vite-only support**: No legacy esbuild/CLI backwards compatibility.
3. **Songdrive parity required**: All use cases from `reference-songdrive-esbuild.ts` must work with Vite.
4. **Import path pattern**: All exports via `springboard/*` (never `springboard-server/*` or `/src/*`).
5. **Export maps target dist**: All runtime exports point to compiled `dist/` files, not `src/`.

---

## Architecture: Single Package Structure

### Current Branch Layout (Correct)
```
packages/springboard/
├── package.json (SINGLE published package)
├── src/
│   ├── core/              # Framework core (engine, types)
│   ├── platforms/
│   │   ├── browser/       # Browser-specific services
│   │   └── node/          # Node-specific services
│   ├── server/            # Platform-agnostic server (currently Node-specific)
│   ├── cli/               # Sub-package (needs consolidation)
│   ├── vite-plugin/       # Sub-package (needs consolidation)
│   └── (no create-springboard-app here; it currently lives at packages/springboard/create-springboard-app)
└── dist/                  # Build output (what gets exported)
```

### Target Changes

**Phase 6 (Single-package consolidation)** will:
- Remove `packages/springboard/cli/package.json`
- Remove `packages/springboard/vite-plugin/package.json`
- Move `packages/springboard/create-springboard-app/` → `packages/create-springboard-app/`
- Update `packages/springboard/package.json` so `pnpm -C packages/springboard build` emits all required `dist` outputs (runtime, cli, vite-plugin)

**Rationale**: Nested package.json files create:
- Conflicting dependency graphs
- Ambiguous publishing boundaries
- Unclear build responsibility

---

## File Migration Map (Refactor → Current Branch)

### Phase 1: Platform-Agnostic Server Layer

| Refactor Branch Source | Target Path (This Branch) | Import Rewrites Required |
|------------------------|---------------------------|--------------------------|
| `packages/springboard/server/src/hono_app.ts` | `packages/springboard/src/server/hono_app.ts` | `springboard/engine/engine` → `../core/engine/engine`<br>`springboard/types/module_types` → `../core/types/module_types`<br>`@springboardjs/platforms-node/services/ws_server_core_dependencies` → `../platforms/node/services/ws_server_core_dependencies` |
| `packages/springboard/server/src/register.ts` | `packages/springboard/src/server/register.ts` | `springboard/engine/engine` → `../core/engine/engine` |
| `packages/springboard/server/src/services/crossws_json_rpc.ts` | `packages/springboard/src/server/services/crossws_json_rpc.ts` | No rewrites needed |
| `packages/springboard/server/src/services/server_json_rpc.ts` | `packages/springboard/src/server/services/server_json_rpc.ts` | `springboard/types/module_types` → `../../core/types/module_types` |
| `packages/springboard/server/src/types/server_app_dependencies.ts` | `packages/springboard/src/server/types/server_app_dependencies.ts` | `springboard/types/module_types` → `../../core/types/module_types` |

### Phase 2: Node Platform (Platform-Specific)

| Refactor Branch Source | Target Path (This Branch) | Import Rewrites Required |
|------------------------|---------------------------|--------------------------|
| `packages/springboard/platforms/node/entrypoints/node_entrypoint.ts` | `packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts` | `springboard-server/src/hono_app` → `springboard/server/hono_app`<br>`@springboardjs/platforms-node/services/ws_server_core_dependencies` → `springboard/platforms/node/services/ws_server_core_dependencies`<br>`@springboardjs/platforms-node/services/node_kvstore_service` → `springboard/platforms/node/services/node_kvstore_service` |
| `packages/springboard/platforms/node/services/ws_server_core_dependencies.ts` | `packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts` | Update data-storage imports to `../../data-storage/...` |

**Action Required**: Move `ws_server_core_dependencies.ts` from `src/server/` to `src/platforms/node/services/` if it exists in current branch.

### Phase 3: Browser Platform (Client-Side)

| Refactor Branch Source | Target Path (This Branch) | Import Rewrites Required |
|------------------------|---------------------------|--------------------------|
| `packages/springboard/platforms/webapp/services/browser_json_rpc.ts` | `packages/springboard/src/platforms/browser/services/browser_json_rpc.ts` | `springboard/types/module_types` → `../../../core/types/module_types`<br>Retain `PUBLIC_USE_WEBSOCKETS_FOR_RPC` toggle |

### Phase 4: Core API Changes

| File to Modify | Changes Required |
|----------------|------------------|
| `packages/springboard/src/core/engine/module_api.ts` | Add `RpcMiddlewareResults` interface<br>Thread middleware results to action callbacks<br>Ensure `createActions` returns new object (no mutation) |
| `packages/springboard/src/core/services/http_kv_store_client.ts` | Add null response guard from refactor branch |

---

## API Signature Changes

### initApp() - Dependency Injection Pattern

**Current (This Branch)**:
```typescript
export const initApp = (kvDeps: WebsocketServerCoreDependencies): InitAppReturnValue
```

**Target (Refactor Branch)**:
```typescript
type InitServerAppArgs = {
    remoteKV: KVStore;
    userAgentKV: KVStore;
    broadcastMessage: (message: string) => void;
};

type InjectResourcesArgs = {
    engine: Springboard;
    serveStaticFile: (c: Context, fileName: string, headers: Record<string, string>) => Promise<Response>;
    getEnvValue: (name: string) => string | undefined;
};

type InitAppReturnValue = {
    app: Hono;
    serverAppDependencies: ServerAppDependencies;
    injectResources: (args: InjectResourcesArgs) => void;
    createWebSocketHooks: (useWebSocketsForRpc: boolean) => Hooks;
};

export const initApp = (initArgs: InitServerAppArgs): InitAppReturnValue
```

**Why**: Separates platform-agnostic server code from platform-specific implementations (Node, CF Workers, etc.).

---

## Phase Execution Plan

### Phase 0: Preparation (No code changes)
- [x] Read refactor branch files
- [ ] Confirm Vite build flows in `apps/vite-test` still pass
- [ ] Confirm current export map structure
- [ ] Document current `local-server.entrypoint.ts` usage

**Acceptance Criteria**:
- Build passes: `pnpm -C packages/springboard build`
- Vite test app runs: `pnpm -C apps/vite-test dev`

---

### Phase 1: Port Platform-Agnostic Server Layer

**Files to Copy** (from refactor branch with import rewrites):
1. `server/src/hono_app.ts` → `src/server/hono_app.ts`
2. `server/src/register.ts` → `src/server/register.ts`
3. `server/src/services/crossws_json_rpc.ts` → `src/server/services/crossws_json_rpc.ts`
4. `server/src/services/server_json_rpc.ts` → `src/server/services/server_json_rpc.ts`
5. `server/src/types/server_app_dependencies.ts` → `src/server/types/server_app_dependencies.ts`

**Import Rewrite Rules**:
- Package imports → Local paths: `springboard/engine/engine` → `../core/engine/engine`
- Cross-package → Local paths: `@springboardjs/platforms-node/*` → `../platforms/node/*`

**Acceptance Criteria**:
- All files compile: `pnpm -C packages/springboard check-types`
- `initApp` signature matches refactor branch
- No `springboard-server` imports remain

---

### Phase 2: Port Node Platform

**Files to Copy/Update**:
1. Replace `platforms/node/entrypoints/node_server_entrypoint.ts` with refactor version
2. Move `ws_server_core_dependencies.ts` → `platforms/node/services/ws_server_core_dependencies.ts`
3. Update server layer imports to new `platforms/node/services/` location

**Critical**: Check if `local-server.entrypoint.ts` is still used by generators/templates. If yes, update. If no, remove.

**Acceptance Criteria**:
- Node entrypoint uses crossws adapter
- No imports from old `src/server/ws_server_core_dependencies.ts` remain
- TypeScript compiles cleanly

---

### Phase 3: Port Browser RPC Client

**File to Update**:
- `platforms/browser/services/browser_json_rpc.ts` (replace with refactor version)

**Required Changes**:
- HTTP-first RPC logic (refactor branch)
- Keep `PUBLIC_USE_WEBSOCKETS_FOR_RPC` toggle
- Update import: `springboard/types/module_types` → `../../../core/types/module_types`

**Acceptance Criteria**:
- HTTP RPC path works (`/rpc/*`)
- WebSocket optional and gated by env var
- TypeScript compiles

---

### Phase 4: Core API Changes

**Files to Modify**:
1. `core/engine/module_api.ts`
   - Add `RpcMiddlewareResults` interface
   - Update `ActionCallback` to include middleware results
   - Ensure `createActions` returns new object (no mutation)

2. `core/services/http_kv_store_client.ts`
   - Port null response guard from refactor branch
   - Remove `HttpKvStoreClient` alias if present (or keep for compatibility)

**Acceptance Criteria**:
- Middleware results thread to action callbacks
- No mutation of input maps in `createActions`
- HTTP KV client handles null responses safely

---

### Phase 5: Vite Entry Template Update

**Files to Modify**:
1. `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`
2. `apps/vite-test/virtual-entries/node-entry.template.ts`

**Pattern to Implement** (from refactor branch):
```typescript
import {serve} from '@hono/node-server';
import crosswsNode from 'crossws/adapters/node';
import {initApp} from 'springboard/server/hono_app';
import {makeWebsocketServerCoreDependenciesWithSqlite} from 'springboard/platforms/node/services/ws_server_core_dependencies';
import {LocalJsonNodeKVStoreService} from 'springboard/platforms/node/services/node_kvstore_service';
import {Springboard} from 'springboard/engine/engine';

const nodeKvDeps = await makeWebsocketServerCoreDependenciesWithSqlite();
let wsNode: ReturnType<typeof crosswsNode>;

const {app, serverAppDependencies, injectResources, createWebSocketHooks} = initApp({
    broadcastMessage: (message) => wsNode.publish('event', message),
    remoteKV: nodeKvDeps.kvStoreFromKysely,
    userAgentKV: new LocalJsonNodeKVStoreService('userAgent'),
});

const useWebSocketsForRpc = process.env.USE_WEBSOCKETS_FOR_RPC === 'true';
wsNode = crosswsNode({
    hooks: createWebSocketHooks(useWebSocketsForRpc)
});

// Port configuration (runtime env var override)
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : __PORT__;

const server = serve({
    fetch: app.fetch,
    port,
}, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
});

server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/ws') {
        wsNode.handleUpgrade(request, socket, head);
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
        // Node.js fs.readFile implementation
    },
    getEnvValue: name => process.env[name],
});

await engine.initialize();
```

**Key Changes**:
- Use `initApp` dependency injection
- crossws adapter for WebSocket
- `injectResources` for static files and env
- Port from env var at runtime: `PORT` env var overrides `__PORT__`

**Acceptance Criteria**:
- Generated entry file includes crossws wiring
- `injectResources` called with platform-specific implementations
- Port controllable via `PORT` env var
- Server starts and responds to requests

---

### Phase 6: Single-Package Consolidation

**Required Changes**:

1. **Merge sub-packages into main package**:
   - Move `packages/springboard/cli/src/*` → `packages/springboard/src/cli/*`
   - Move `packages/springboard/vite-plugin/src/*` → `packages/springboard/src/vite-plugin/*`
   - Remove `packages/springboard/cli/package.json`
   - Remove `packages/springboard/vite-plugin/package.json`

2. **Move create-springboard-app out**:
   - Move `packages/springboard/create-springboard-app/` → `packages/create-springboard-app/`

3. **Update build config**:
   - Update `packages/springboard/package.json` scripts so `pnpm -C packages/springboard build` emits runtime, cli, and vite-plugin outputs under `dist/`.
   - Update `tsconfig.build.json` include paths to cover `src/cli/**` and `src/vite-plugin/**`.
   - Document the expected `dist/` layout for merged cli + vite-plugin exports.

**Risks of Nested package.json**:
- Conflicting dependency graphs (dev deps vs runtime deps)
- Ambiguous publishing boundaries
- Unclear build responsibility for main package

**Acceptance Criteria**:
- No nested `package.json` under `packages/springboard/cli` or `packages/springboard/vite-plugin`
- `pnpm -C packages/springboard build` produces all required `dist` outputs
- `create-springboard-app` is separate published package

---

### Phase 7: Export Map Updates

**Required Changes**:
- Add export entries for new server paths **targeting `dist`**
- Do NOT export `./src/*` entries for runtime consumption

**Example Patterns**:
```json
{
  "exports": {
    "./server/hono_app": {
      "types": "./dist/server/hono_app.d.ts",
      "import": "./dist/server/hono_app.js"
    },
    "./server/register": {
      "types": "./dist/server/register.d.ts",
      "import": "./dist/server/register.js"
    },
    "./platforms/node/services/ws_server_core_dependencies": {
      "types": "./dist/platforms/node/services/ws_server_core_dependencies.d.ts",
      "import": "./dist/platforms/node/services/ws_server_core_dependencies.js"
    }
  }
}
```

**Acceptance Criteria**:
- Build emits matching `dist` paths for all exports
- No `./src/*` exports for runtime (only for tooling if needed)
- TypeScript can resolve all exported paths

---

### Phase 8: Vite Parity for Songdrive Outcomes

**Goal**: Replace esbuild behavior with Vite-supported outputs matching Songdrive needs.

**Reference**: `claude_notes/reference-songdrive-esbuild.ts` (707 lines)

**Required Capabilities (concrete implementation)**:

1. **Multi-target build runner**
   - Add `packages/springboard/src/vite-plugin/build-runner.ts` that accepts an array of targets and runs them sequentially.
   - Each target includes: `name`, `platform`, `entrypoint`, `outDir`, `define`, `alias`, `plugins`, `postBuild`.

2. **Post-build file operations**
   - Add `packages/springboard/src/vite-plugin/post_build.ts` with helpers: `ensureDir`, `copyFile`, `copyDir`.
   - Each target may define `postBuild.copy` tasks to replicate esbuild’s output moves.

3. **Define/alias compatibility**
   - Build runner merges per-target `define` and `resolve.alias` into the Vite config.
   - Provide a helper to merge `define` from env vars (parity with `esbuild.ts`).

4. **Plugin mapping**
   - Allow per-target plugin injection (Sentry, Sass, custom transforms).
   - Provide a standard loader plugin for `.sql`, `.ttf`, `.svg`, `.woff` to emulate `dataurl` behavior.

5. **HTML post-processing**
   - Add a `transformIndexHtml` hook per target to support edits like `editHtmlFile` in `reference-songdrive-esbuild.ts`.

6. **Build orchestration flags**
   - Support `SPRINGBOARD_PLATFORM_VARIANT` in the build runner to filter targets.
   - Provide a `--watch` mode that runs targets in sequence and re-triggers on change.

**Acceptance Criteria**:
- Vite-based build script replicates final output layout of Songdrive esbuild script
- Multi-target builds work (browser, node, server, etc.)
- Asset copying and file moves work
- Environment defines injected correctly
- App runs without needing esbuild pipeline

**Implementation Note**: This phase is CRITICAL and NOT deferred. The migration is incomplete without Vite parity for Songdrive use cases.

---

## Validation Checklist

### Build Validation
- [ ] `pnpm -C packages/springboard build` succeeds
- [ ] All expected `dist/` outputs exist
- [ ] Export map paths resolve correctly

### TypeScript Validation
- [ ] `pnpm -C packages/springboard check-types` passes
- [ ] No `springboard-server` imports remain: `rg "from ['\"]springboard-server" packages/springboard/src`
- [ ] No `@springboardjs/platforms-*` imports remain: `rg "from ['\"]@springboardjs/platforms" packages/springboard/src`

### Runtime Validation (Deterministic Port)
Start server with controlled port:
```bash
PORT=3001 node apps/vite-test/dist/node/index.mjs
```

Test endpoints:
- [ ] HTTP: `curl http://localhost:3001/` returns HTML
- [ ] KV: `curl http://localhost:3001/kv/get-all` returns JSON
- [ ] RPC: `curl -X POST http://localhost:3001/rpc/test -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}'` returns valid JSON-RPC response
- [ ] WebSocket: `wscat -c ws://localhost:3001/ws` connects successfully

### Vite Template Validation
- [ ] `pnpm -C apps/vite-test dev` starts successfully
- [ ] `pnpm -C apps/vite-test build` produces valid output
- [ ] Generated node entry uses crossws and `injectResources`

---

## Critical Corrections from Reviews

### From 029-SEQUENTIAL_MIGRATION_PLAN.review.md

1. **Import rewrites must be accurate**:
   - `server_json_rpc.ts` imports `Rpc, RpcArgs` (not `KVStore`)
   - `server_app_dependencies.ts` imports `CoreDependencies` (not `KVStore`)
   - Verify actual imports in refactor branch files before copying

2. **Port configuration**:
   - Must be injected via `PORT` env var at server runtime
   - Template: `const port = process.env.PORT ? parseInt(process.env.PORT, 10) : __PORT__;`

3. **Single-package consolidation is required**:
   - Merge `cli` and `vite-plugin` sub-packages into main package
   - This is part of the migration effort, not deferred

4. **Export maps target dist**:
   - All runtime exports point to `dist/` files (not `src/`)
   - Keep pattern from current branch

5. **Songdrive esbuild parity is required**:
   - Must support all outcomes from `reference-songdrive-esbuild.ts`
   - Multi-target builds, file moves, plugins, defines
   - This is NOT deferred work

### From 025-REFACTOR_BRANCH_MIGRATION_PLAN.review.md

1. **Import path consistency**:
   - Use `springboard/*` for all public imports
   - Never `springboard-server/*` or `springboard/src/*`

2. **Call-site migration**:
   - Update `apps/small_apps/app_with_server_module/app_with_server_module.tsx`
   - Replace `springboard-server/src/register` with `springboard/server/register`

3. **Entrypoint migration**:
   - Check if `local-server.entrypoint.ts` is used by generators
   - If yes, update. If no, remove.

---

## Implementation Sequence

**Recommended approach**: Sequential subagent execution per phase.

1. **Phase 0**: Preparation agent (verification only)
2. **Phase 1**: Backend architect (server layer port)
3. **Phase 2**: Backend architect (node platform port)
4. **Phase 3**: Frontend developer (browser RPC client)
5. **Phase 4**: Backend architect (core API changes)
6. **Phase 5**: Backend architect (Vite template update)
7. **Phase 6**: DX optimizer (package consolidation)
8. **Phase 7**: Backend architect (export map updates)
9. **Phase 8**: Vite specialist (Songdrive parity implementation)

**Why sequential**: Prevents stepping on each other's toes, ensures clean implementation per phase, clear acceptance criteria per agent.

---

## Open Questions Resolved

1. **Legacy CLI support?** → No. Hard cutoff. Vite only.
2. **Merge cli/vite-plugin sub-packages?** → Yes, in this effort (Phase 6).
3. **Songdrive esbuild parity?** → Required, not deferred (Phase 8).
4. **Export maps?** → Target `dist/` only (keep current pattern).
5. **Port configuration?** → Runtime env var (`PORT`) with fallback to build-time default.

---

## Success Metrics

- [ ] Single published package: `springboard` only (plus `create-springboard-app`)
- [ ] All imports use `springboard/*` pattern
- [ ] Platform abstraction works (dependency injection pattern)
- [ ] Vite dev and prod builds work
- [ ] All Songdrive esbuild use cases supported via Vite
- [ ] Runtime validation passes (HTTP, KV, RPC, WebSocket)
- [ ] No nested `package.json` files under `packages/springboard/`
- [ ] Export maps target `dist/` outputs only

---

## Next Immediate Action

**Start with Phase 0**: Preparation and verification.

Run these commands to establish baseline:
```bash
# Verify current build works
pnpm -C packages/springboard build

# Verify Vite test app works
pnpm -C apps/vite-test dev

# Document current export map
cat packages/springboard/package.json | jq '.exports'

# Check for local-server.entrypoint.ts usage
rg "local-server.entrypoint" packages/ apps/
```

Once baseline is confirmed, proceed to Phase 1 with backend architect agent.
