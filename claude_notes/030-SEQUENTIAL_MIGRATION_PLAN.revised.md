# Revised Sequential Migration Plan (Vite-only, Single Package)

**Scope**: Migrate refactor-branch server/platform abstractions into the current Vite branch **without** legacy esbuild/CLI support. Vite must cover the practical outcomes of the Songdrive esbuild script (file outputs, asset moves, multi-target builds), but the implementation is Vite-native.

**Constraints**:
- Single published runtime package: `springboard` only.
- Vite-only support (no backwards compatibility for esbuild or `springboard-cli`).
- Client + server refactor branch changes are both required.
- Keep current export pattern: runtime exports must point to `dist`.

---

## Phase 0: Preparation (No code changes)

### Tasks
1. Read the refactor branch files to be ported.
2. Confirm Vite build flows used in `apps/vite-test` still pass.
3. Confirm current `springboard` export map structure and build outputs.

### Notes
- No backup branch step in this plan.
- No rollback plan in this plan.

---

## Phase 1: Port platform-agnostic server layer (refactor branch -> single package)

### Target paths (single-package layout)
- `packages/springboard/src/server/hono_app.ts`
- `packages/springboard/src/server/register.ts`
- `packages/springboard/src/server/services/crossws_json_rpc.ts`
- `packages/springboard/src/server/services/server_json_rpc.ts`
- `packages/springboard/src/server/types/server_app_dependencies.ts`

### Correct import rewrites
**1) `hono_app.ts`**
- `springboard/engine/engine` -> `../core/engine/engine`
- `springboard/types/module_types` -> `../core/types/module_types`
- `@springboardjs/platforms-node/services/ws_server_core_dependencies` -> `../platforms/node/services/ws_server_core_dependencies`

**2) `register.ts`**
- `springboard/engine/engine` -> `../core/engine/engine`

**3) `server_json_rpc.ts`**
- `springboard/types/module_types` -> `../../core/types/module_types`

**4) `server_app_dependencies.ts`**
- `springboard/types/module_types` -> `../../core/types/module_types`

**5) `crossws_json_rpc.ts`**
- No rewrites needed.

### Acceptance criteria
- All files compile under `packages/springboard/src/server`.
- `initApp` uses injected dependencies and returns `createWebSocketHooks` + `injectResources`.

---

## Phase 2: Port Node platform (entrypoint + services)

### Required file changes
1. Replace `packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts` with refactor version adapted to single-package imports.
2. Move `ws_server_core_dependencies.ts` to `packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts`.
3. Ensure imports in server layer point to the new `platforms/node/services/...` location.

### Correct import rewrites for `node_server_entrypoint.ts`
- `springboard-server/src/hono_app` -> `springboard/server/hono_app`
- `@springboardjs/platforms-node/services/ws_server_core_dependencies` -> `springboard/platforms/node/services/ws_server_core_dependencies`
- `@springboardjs/platforms-node/services/node_kvstore_service` -> `springboard/platforms/node/services/node_kvstore_service`
- Keep `springboard/engine/engine` as package import.

### Entry point dependency note
- If `local-server.entrypoint.ts` is still referenced by any generator or template, update it to import from `springboard/platforms/node/services/ws_server_core_dependencies` (new location). If it is no longer used, remove references before deletion.

### Acceptance criteria
- Node server entrypoint uses crossws and the new `initApp` signature.
- No remaining imports from `src/server/ws_server_core_dependencies.ts`.

---

## Phase 3: Port browser RPC client (client-side refactor changes)

### File
- `packages/springboard/src/platforms/browser/services/browser_json_rpc.ts`

### Required changes
- Replace with refactor branch version.
- Ensure `PUBLIC_USE_WEBSOCKETS_FOR_RPC` toggle is retained.
- Import rewrite: `springboard/types/module_types` -> `../../../core/types/module_types`.

### Acceptance criteria
- HTTP-first RPC logic is present.
- WebSocket is optional and gated by `PUBLIC_USE_WEBSOCKETS_FOR_RPC`.

---

## Phase 4: Core changes for RPC middleware + HTTP KV safety

### Files
- `packages/springboard/src/core/engine/module_api.ts`
- `packages/springboard/src/core/services/http_kv_store_client.ts`

### Required changes
- Add `RpcMiddlewareResults` and thread through action calls.
- Ensure `createActions` returns a new object (no mutation of input map).
- Add the null response guard to HTTP KV client (from refactor branch).

---

## Phase 5: Vite entry template update (server integration)

### Files
- `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`
- `apps/vite-test/virtual-entries/node-entry.template.ts`

### Required changes
- Use `initApp` dependency injection pattern.
- Use crossws adapter and server `upgrade` handler.
- Use `injectResources` for static files and env.
- Read port from env at runtime: `const port = process.env.PORT ? parseInt(process.env.PORT, 10) : __PORT__;`

### Acceptance criteria
- Generated entry file includes `crossws` wiring and `injectResources`.
- Port is controllable via `PORT` env var.

---

## Phase 6: Single-package consolidation (merge sub-packages)

### Required changes
- Merge code from `packages/springboard/cli` and `packages/springboard/vite-plugin` into `packages/springboard/src/cli` and `packages/springboard/src/vite-plugin`.
- Remove `packages/springboard/cli/package.json` and `packages/springboard/vite-plugin/package.json`.
- Update `packages/springboard/package.json` scripts so `npm run build` builds all relevant outputs.

### Rationale
Keeping nested `package.json` files causes:
- Conflicting dependency graphs (dev deps vs runtime deps).
- Ambiguous publishing boundaries.
- Unclear build responsibility for the main `springboard` package.

### Acceptance criteria
- `springboard` root build produces all required `dist` outputs.
- No nested `package.json` remains under `packages/springboard/cli` or `packages/springboard/vite-plugin`.

---

## Phase 7: Export map updates (dist-first)

### Required changes
- Add export entries for new server paths and node services **targeting `dist`**.
- Do not export `./src/*` entries for runtime consumption.

### Example patterns
- `./server/hono_app` -> `./dist/server/hono_app.js` (types -> `./dist/server/hono_app.d.ts`).
- `./platforms/node/services/ws_server_core_dependencies` -> `./dist/platforms/node/services/ws_server_core_dependencies.js`.

### Acceptance criteria
- Build emits matching `dist` paths for all exports.

---

## Phase 8: Vite parity for Songdrive outcomes (Vite-only)

### Goal
Replace esbuild behavior with Vite-supported outputs that match Songdrive needs:
- Multi-target outputs (browser, node maestro, server, tauri, RN webview/main).
- Asset copying and post-build file moves (previously in `build/esbuild.ts`).
- Environment define injection, aliasing, and plugin hooks.

### Required Vite capabilities (minimal implementation targets)
1. **Multi-target build orchestration**
   - Provide a Vite-driven build runner that can execute multiple builds sequentially.
   - Support platform-specific entrypoints and output folders.

2. **File move/post-build hooks**
   - Implement a post-build hook that can copy files to configured destinations.
   - Config should allow “copy to folder” operations per target.

3. **Define/alias compatibility**
   - Provide a Vite layer to inject defines and aliases per target.

4. **Sentry + Sass plugins**
   - Support custom plugin injection per target.

### Acceptance criteria
- A Vite-based build script can replicate the final output layout of the Songdrive esbuild script.
- The app runs without needing any esbuild pipeline.

---

## Validation checklist (corrected)

### Runtime checks
- Start server with a deterministic port: `PORT=3001 node dist/node/index.mjs`.
- HTTP: `curl http://localhost:3001/` returns HTML.
- KV: `curl http://localhost:3001/kv/get-all` returns JSON.
- RPC: `curl -X POST http://localhost:3001/rpc/test -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"test","params":{},"id":1}'`.

### Import and export checks
- Use `rg` to verify no `springboard-server` or `@springboardjs/platforms-*` imports remain.
- Validate that `dist` outputs exist for all new export entries.

---

## Notes
- No esbuild compatibility is retained; Vite-only support is required.
- All changes remain inside `packages/springboard/src` and `packages/springboard/package.json`.
- The Vite parity work is part of the same migration effort (not deferred).
