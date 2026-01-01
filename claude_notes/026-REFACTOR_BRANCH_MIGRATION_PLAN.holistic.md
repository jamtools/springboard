# Holistic Refactor Branch Migration Plan (Single-Package, Vite, Legacy Esbuild Support)

## Goals and constraints
- **Single published package**: keep `springboard` as the only published runtime package. Keep `create-springboard-app` as the only separate published package.
- **Import path convention**: all runtime imports must be from `springboard/*` paths (no `springboard-server`, no `/src` in consumer imports).
- **Vite-first**: keep the new Vite build flow as the primary path.
- **Legacy esbuild compatibility**: keep the legacy esbuild APIs available so `/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/de3c-make-tauri-file/ffmpeg-songdrive/build/esbuild.ts` can be migrated without losing features.
- **Refactor branch parity**: port the platform-agnostic server layer and the HTTP-first RPC changes (client + server) while preserving the single-package layout on this branch.

## Current state snapshot (this branch)
- Single package is already declared in `packages/springboard/package.json` with export map for `./server`, `./platforms/*`, and `./legacy-cli`.
- `packages/springboard/src/server/*` contains Node-specific Hono + `@hono/node-ws` code (not platform-agnostic).
- `packages/springboard/src/platforms/browser/services/browser_json_rpc.ts` already supports HTTP + WebSocket.
- `packages/springboard/src/legacy-cli` exists and exports esbuild APIs, but **`buildServer` is removed**.
- Sub-packages exist **inside** `packages/springboard` (`cli/`, `vite-plugin/`, `create-springboard-app/`), each with its own `package.json` (conflicts with “single package” intent).

## Refactor branch deltas that matter
- **Platform-agnostic server**: `server/src/hono_app.ts` and `server/src/services/server_json_rpc.ts` accept injected dependencies and use crossws.
- **Crossws WebSocket**: `server/src/services/crossws_json_rpc.ts` creates WS hooks compatible with CF Workers + Node.
- **RPC middleware results**: core `module_api.ts` supports middleware results passed to action handlers.
- **HTTP KV client**: refactor adds safer `null` handling and removes `HttpKvStoreClient` alias.
- **Node entrypoint**: `platforms/node/entrypoints/node_entrypoint.ts` glues crossws + injected server resources.

## Target architecture (single package)
All runtime modules live under `packages/springboard/src`.

Proposed canonical paths (single package, no extra packages):
- **Server (platform-agnostic)**
  - `packages/springboard/src/server/hono_app.ts`
  - `packages/springboard/src/server/register.ts`
  - `packages/springboard/src/server/services/crossws_json_rpc.ts`
  - `packages/springboard/src/server/services/server_json_rpc.ts`
  - `packages/springboard/src/server/types/server_app_dependencies.ts`
- **Node platform (platform-specific)**
  - `packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts` (updated to crossws + new `initApp`)
  - `packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts` (move here from `src/server/`)
  - `packages/springboard/src/platforms/node/services/node_json_rpc.ts`
  - `packages/springboard/src/platforms/node/services/node_kvstore_service.ts`
  - `packages/springboard/src/platforms/node/services/node_file_storage_service.ts`
- **Browser platform (client-side)**
  - `packages/springboard/src/platforms/browser/services/browser_json_rpc.ts`

## File mapping plan (refactor -> this branch)
Use this mapping to port code while preserving the **single package** layout.

### Server (platform-agnostic)
| Refactor branch source | Target path (this branch) | Required import rewrites |
| --- | --- | --- |
| `packages/springboard/server/src/hono_app.ts` | `packages/springboard/src/server/hono_app.ts` | Replace package imports with local paths: `springboard/engine/engine` -> `../core/engine/engine`, `springboard/types/module_types` -> `../core/types/module_types`. Update `@springboardjs/platforms-node/services/ws_server_core_dependencies` to `../platforms/node/services/ws_server_core_dependencies` (or move path via new location). |
| `packages/springboard/server/src/register.ts` | `packages/springboard/src/server/register.ts` | Update `Springboard` import to `../core/engine/engine`.
| `packages/springboard/server/src/services/crossws_json_rpc.ts` | `packages/springboard/src/server/services/crossws_json_rpc.ts` | No path changes.
| `packages/springboard/server/src/services/server_json_rpc.ts` | `packages/springboard/src/server/services/server_json_rpc.ts` | Update `springboard/types/module_types` to `../core/types/module_types`.
| `packages/springboard/server/src/types/server_app_dependencies.ts` | `packages/springboard/src/server/types/server_app_dependencies.ts` | Update `springboard/types/module_types` to `../core/types/module_types`.

### Node platform (platform-specific)
| Refactor branch source | Target path (this branch) | Required import rewrites |
| --- | --- | --- |
| `packages/springboard/platforms/node/entrypoints/node_entrypoint.ts` | `packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts` (replace contents) | Update imports to single-package paths: `springboard-server/src/hono_app` -> `springboard/server/hono_app`, `@springboardjs/platforms-node/...` -> `springboard/platforms/node/...`, `springboard/engine/engine` -> `springboard/engine/engine` (exported). |
| `packages/springboard/platforms/node/services/ws_server_core_dependencies.ts` | `packages/springboard/src/platforms/node/services/ws_server_core_dependencies.ts` (new) | Update data-storage imports to `../../data-storage/...`.
| `packages/springboard/platforms/node/services/node_json_rpc.ts` | `packages/springboard/src/platforms/node/services/node_json_rpc.ts` | Ensure import uses `../../core/types/module_types`.
| `packages/springboard/platforms/node/services/node_kvstore_service.ts` | `packages/springboard/src/platforms/node/services/node_kvstore_service.ts` | Diff for any changes. |
| `packages/springboard/platforms/node/services/node_file_storage_service.ts` | `packages/springboard/src/platforms/node/services/node_file_storage_service.ts` | Diff for any changes. |

### Browser platform (client-side)
| Refactor branch source | Target path (this branch) | Required import rewrites |
| --- | --- | --- |
| `packages/springboard/platforms/webapp/services/browser_json_rpc.ts` | `packages/springboard/src/platforms/browser/services/browser_json_rpc.ts` | Update `springboard/types/module_types` to `../../core/types/module_types` (already matches). Ensure `PUBLIC_USE_WEBSOCKETS_FOR_RPC` toggle is retained if needed. |

### Core (RPC middleware + HTTP KV safety)
| Refactor branch source | Target path (this branch) | Required merge detail |
| --- | --- | --- |
| `packages/springboard/core/engine/module_api.ts` | `packages/springboard/src/core/engine/module_api.ts` | Apply refactor changes: add `RpcMiddlewareResults` interface and include middleware results in action callbacks; ensure action creation returns new functions instead of mutating input; align with local import paths. |
| `packages/springboard/core/services/http_kv_store_client.ts` | `packages/springboard/src/core/services/http_kv_store_client.ts` | Port null check for JSON response and remove `HttpKvStoreClient` alias (or keep alias for compatibility if needed). |

## Import path policy (single package)
All consumers (internal and external) should use `springboard/*` exports. No `springboard-server` or `/src` imports.

### Required internal updates (this repo)
- `apps/small_apps/app_with_server_module/app_with_server_module.tsx`: replace `springboard-server/src/register` with `springboard/server/register`.
- `apps/vite-test/virtual-entries/node-entry.template.ts` and `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`: update to new `initApp` signature and crossws wiring (see Vite plan below).
- `packages/springboard/cli/src/config/vite_config_generator.ts`: keep `springboard/server/entrypoints/local-server.entrypoint.ts` (ensure it remains valid).

### External example migration (ffmpeg-songdrive)
File: `/var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/de3c-make-tauri-file/ffmpeg-songdrive/build/esbuild.ts`
- Replace `springboard-cli/src/build` with **`springboard/legacy-cli`** (or `springboard/legacy-cli/build` if you want a narrower import).
- Replace `springboard-cli/src/esbuild_plugins/esbuild_plugin_platform_inject` with **`springboard/legacy-cli`** (via the named export `esbuildPluginPlatformInject`).
- If `buildServer` is still needed, reintroduce it as a compatibility wrapper in `packages/springboard/src/legacy-cli/build.ts` (see Legacy esbuild section).

## Single-package consolidation decisions
### Recommended structure changes
- **Remove sub-package boundaries** for:
  - `packages/springboard/vite-plugin/package.json`
  - `packages/springboard/cli/package.json`
- Move their `src/` contents into `packages/springboard/src/vite-plugin/` and `packages/springboard/src/cli/` (or fold `cli` into `legacy-cli` if it is purely esbuild).
- Update `packages/springboard/tsconfig.build.json` include paths if you add new directories.
- Keep `packages/springboard/create-springboard-app` as **its own package**; consider moving it to top-level `packages/create-springboard-app` to reduce confusion.

### Publishing policy
- Published packages: `springboard` and `create-springboard-app` only.
- If `springboard-cli` is still desired as a separate name, it should be a thin wrapper that re-exports from `springboard/legacy-cli` (optional, but conflicts with “single package” goal).

## Vite plan (server entry template + dev flow)
Update the Vite node entry template to use the refactor branch’s injected server and crossws hooks, while preserving `springboard/server` imports.

Key changes for `packages/springboard/vite-plugin/src/templates/node-entry.template.ts` and `apps/vite-test/virtual-entries/node-entry.template.ts`:
- Use `initApp({remoteKV, userAgentKV, broadcastMessage})` from `springboard/server/hono_app`.
- Create a crossws adapter (`crossws/adapters/node`) and wire `server.on('upgrade', ...)` for `/ws`.
- Use `createWebSocketHooks` from `crossws_json_rpc` (via `initApp` return) with `USE_WEBSOCKETS_FOR_RPC` flag.
- Call `injectResources({engine, serveStaticFile, getEnvValue})` to wire static file handling.

## Legacy esbuild compatibility plan
The ffmpeg-songdrive file uses `buildApplication`, `buildServer`, and platform configs from `springboard-cli/src/build`.

### Required steps
- **Restore `buildServer`** in `packages/springboard/src/legacy-cli/build.ts` as a compatibility wrapper, or update ffmpeg-songdrive to avoid `buildServer` entirely.
  - If restored, keep it deprecated and ensure it uses the new server entrypoint style (server as self-contained entrypoint). This can be a thin wrapper that builds a Node entry bundle that calls `springboard/platforms/node/entrypoints/node_server_entrypoint`.
- Ensure `legacy-cli/index.ts` re-exports all required functions and plugins:
  - `buildApplication`, `buildServer`, `platformBrowserBuildConfig`, `platformNodeBuildConfig`, etc.
  - `esbuildPluginPlatformInject` and other plugins used by the app.
- Update docs (`docs/*`, `README.md`, `create-springboard-app`) to stop advertising `springboard-cli` as a standalone dependency and instead point to `springboard/legacy-cli` for esbuild users.

## Dependency and export adjustments
Since we are not creating new packages, all dependencies should be declared in `packages/springboard/package.json`.

### Add or confirm dependencies
- `crossws` (runtime)
- `srvx` (if still used by server code)
- `json-rpc-2.0` already present

### Export map updates
Ensure these exist or remain valid in `packages/springboard/package.json`:
- `./server` and `./server/register`
- `./server/hono_app` (new if you want direct access)
- `./server/services/*` (if direct imports are needed)
- `./platforms/node/services/ws_server_core_dependencies` (new if moved)
- `./legacy-cli` (already present)

## Cross-branch correctness checklist (deep plan)
### Server wiring correctness
- `initApp` signature is changed to injected dependencies (remote KV, user agent KV, broadcast handler).
- RPC middleware results are correctly passed into `ServerJsonRpcClientAndServer.processRequest` and then forwarded to module action callbacks.
- WebSocket path `/ws` upgrade handler is installed in Node entrypoints.
- Static file handling is via `injectResources()` rather than Node-only filesystem logic inside `hono_app.ts`.

### Core API correctness
- `ModuleAPI.createActions` returns a new action map (not mutating input). This is important for predictable types and consistent behavior.
- `ActionCallback` signature includes middleware results for server-side RPC use cases.

### Client (browser) correctness
- Keep HTTP-first RPC path working (`/rpc/*`) with WebSocket optional fallback.
- Preserve `PUBLIC_USE_WEBSOCKETS_FOR_RPC` behavior (present in refactor branch version).

## Verified copy-lines ranges (refactor branch)
`copy-lines` is available and can be used for traceable imports. These ranges were verified against the refactor branch files.

- `packages/springboard/server/package.json`: `1-29`
- `packages/springboard/server/index.ts`: `1-3`
- `packages/springboard/server/src/register.ts`: `1-36`
- `packages/springboard/platforms/node/package.json`: `1-25`

Use `nl -ba <file>` before copying to confirm ranges have not drifted.

## Validation plan
- Typecheck the single package: `pnpm -C packages/springboard check-types`.
- Vite template smoke test: run the Vite test app and verify server + WS + RPC behavior.
- Legacy esbuild smoke test: update `ffmpeg-songdrive/build/esbuild.ts` imports and validate build outputs (browser + node + server).
- Runtime check: `/rpc/*` responds; `/ws` accepts connections; KV operations work (`/kv/get`, `/kv/get-all`).

## Open questions to resolve before implementation
- Do we want to keep a thin `springboard-cli` compatibility package on npm (re-exporting `springboard/legacy-cli`), or fully drop it?
- Should `create-springboard-app` move to top-level `packages/` to avoid appearing under the single-package umbrella?
- Do we want to export `server/hono_app` directly for power-users, or keep it behind `server` index only?
