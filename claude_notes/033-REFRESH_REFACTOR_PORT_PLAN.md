# Refactor Branch Full-Port Plan (Reset + Reapply)

  **Status**: Draft for execution
  **Audience**: Developer onboarding to re-port refactor branch work into current Vite branch
  **Intent**: Replace piecemeal changes with a single, refactor-first copy, then do a deliberate fit-and-finish for single-package + Vite
  conventions.

  ---

  ## Why we are backtracking (debrief)

  We have good work in the refactor branch, but in this branch we tried to adapt it by hand and ended up with mismatches:

  - **Server layer is still Node-specific** in this branch, while the refactor branch has the platform-agnostic, injected `initApp`
  architecture.
  - **RPC middleware results** were partially merged; the refactor plumbing (inject results into RPC params and forward to action callbacks) is
  not intact here.
  - **Node entrypoint** is still using the old `initApp(kvDeps)` shape and `@hono/node-ws`, not the refactor crossws pattern.
  - **Browser RPC toggle** (`PUBLIC_USE_WEBSOCKETS_FOR_RPC`) was lost here.

  Given this, any incremental fixes are likely to miss details and cause rework. The safest, fastest path is to copy refactor branch files
  wholesale using `cp`, then apply only the minimal, intentional adjustments (single-package imports, Vite-specific details).

  ---

  ## Scope of the full port

  **Goal**: Bring the refactor branch behavior into this branch as-is, then adapt for:
  1) single-package layout (`springboard/*` exports),
  2) Vite support (templates + asset routing),
  3) existing Vite-specific behaviors we want to preserve.

  **We are not preserving current partial progress** if it conflicts with refactor behavior. This is a reset.

  ---

  ## Ground rules

  - Use `cp` for all file transfers (no `copy-lines`).
  - After copying, do explicit import rewrites and targeted feature re-adds only.
  - Do not add new abstractions or architecture changes beyond refactor.

  ---

  ## Phase 0: Pre-flight (awareness)

  1) Refactor branch location:
     `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree`

  2) Current branch root:
     `<WORKTREE_ROOT>`

  3) Be ready to overwrite files in `packages/springboard/src`.

  ---

  ## Phase 1: Copy refactor server layer (overwrite)

  ```bash
  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/* \
    <WORKTREE_ROOT>/packages/springboard/src/server/

  Why: This brings in the platform-agnostic initApp, crossws hooks, injected resources, and RPC middleware flow.

  ———

  ## Phase 2: Copy refactor platforms (overwrite)

  Node

  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/* \
    <WORKTREE_ROOT>/packages/springboard/src/platforms/node/

  Browser (webapp)

  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/webapp/* \
    <WORKTREE_ROOT>/packages/springboard/src/platforms/browser/

  Cloudflare Workers

  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/cf-workers/* \
    <WORKTREE_ROOT>/packages/springboard/src/platforms/cloudflare-workers/

  React Native

  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/react-native/* \
    <WORKTREE_ROOT>/packages/springboard/src/platforms/react-native/

  Tauri

  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/tauri/* \
    <WORKTREE_ROOT>/packages/springboard/src/platforms/tauri/

  Deno (if desired)

  cp -R /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/deno/* \
    <WORKTREE_ROOT>/packages/springboard/src/platforms/deno/

  ———

  ## Phase 3: Copy core changes from refactor (overwrite)

  cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/core/engine/module_api.ts \
    <WORKTREE_ROOT>/packages/springboard/src/core/engine/module_api.ts

  cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/core/services/http_kv_store_client.ts
  \
    <WORKTREE_ROOT>/packages/springboard/src/core/services/http_kv_store_client.ts

  ———

  ## Phase 4: Remove refactor package metadata (single-package cleanup)

  Remove after copy:

  - packages/springboard/src/platforms/**/package.json
  - packages/springboard/src/platforms/**/tsconfig.json
  - packages/springboard/src/platforms/**/vite.config.ts

  ———

  ## Phase 5: Import rewrites (single-package paths)

  Replace:

  - springboard/engine/engine -> ../core/engine/engine
  - springboard/types/module_types -> ../core/types/module_types
  - springboard/module_registry/module_registry -> ../module_registry/module_registry
  - @springboardjs/platforms-node/... -> ../platforms/node/...
  - springboard-server/... -> springboard/server/...

  ———

  ## Phase 6: Vite template updates (match refactor entrypoint)

  Update:

  - packages/springboard/vite-plugin/src/templates/node-entry.template.ts
  - apps/vite-test/virtual-entries/node-entry.template.ts

  Match the refactor entrypoint pattern:

  - initApp({remoteKV, userAgentKV, broadcastMessage})
  - crossws adapter + upgrade handler
  - injectResources to serve static files + env
  - runtime PORT override

  ———

  ## Phase 7: Re-apply Vite-specific behaviors that refactor lacks

  Re-apply after copy:

  - dynamic index.html metadata injection
  - /assets/* or other Vite static routing
  - OTEL trace endpoint (if kept)

  ———

  ## Phase 8: Export map adjustments (dist-first)

  Ensure new entrypoints are exported only from dist/ outputs. No src/* exports.

  ———

  ## Validation checklist

  1. No springboard-server or @springboardjs/platforms-* imports.
  2. pnpm -C packages/springboard check-types
  3. Build/run apps/vite-test and validate /rpc/*, /ws, /kv/*.

  ———

  ## End state

  - Server layer matches refactor branch behavior (DI, crossws, middleware results).
  - Platforms match refactor branch implementations (node/webapp/tauri/RN/CF/deno).
  - Vite branch retains single-package exports and Vite-specific behaviors through explicit re-additions.
