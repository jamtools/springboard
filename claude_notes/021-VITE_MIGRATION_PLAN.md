# Vite Migration Plan: Use @hono/vite-dev-server

## Overview

Migrate from spawning separate Node.js process to using `@hono/vite-dev-server` for running the Hono server integrated with Vite dev server. This enables:

- ✅ Single process (no spawning)
- ✅ Single port (5173)
- ✅ Both browser + server in one `vite dev` command
- ✅ Vite-native architecture
- ✅ No proxy middleware needed
- ✅ Simpler plugin code

## Architecture Changes

### Current (Spawning)
```
Vite Process (5173)
  ↓ spawns
Node Process (1337) running tsx node-dev-server.ts
  ↓ proxied via http-proxy-middleware
Browser requests → Vite
API requests → Node server via proxy
```

### Target (@hono/vite-dev-server)
```
Single Vite Process (5173)
  ├─ Vite dev server (HTML, JS, CSS)
  └─ @hono/vite-dev-server
     └─ Hono app from springboard/platforms/node/entrypoints/node_dev_entrypoint
        ├─ /rpc/* routes
        ├─ /kv/* routes
        └─ /ws WebSocket
```

## Tasks

### Phase 1: Create Node Dev Entrypoint in Springboard

**File:** `packages/springboard/src/platforms/node/entrypoints/node_dev_entrypoint.ts`

**Purpose:** Generic entrypoint for dev mode that exports a Hono app (not starts a server)

**Key Points:**
- Use top-level await for async initialization (SQLite, etc.)
- Export the Hono app as default
- Use `@hono/node-ws` for WebSocket (not manual server injection)
- No app-specific code - fully generic and reusable
- Gets transpiled to `dist/platforms/node/entrypoints/node_dev_entrypoint.js`

**Structure:**
```typescript
// Top-level await for async initialization
const coreDeps = await makeWebsocketServerCoreDependenciesWithSqlite();
const { app, injectWebSocket, nodeAppDependencies } = initApp(coreDeps);
const engine = await startNodeApp(nodeAppDependencies);

// Export for @hono/vite-dev-server
export default app;
```

**WebSocket Challenge:**
- Current code uses `injectWebSocket(server)` which needs HTTP server instance
- With `@hono/vite-dev-server`, we don't create the server - Vite does
- **Solution:** Refactor to use `@hono/node-ws` middleware pattern instead

**Dependencies to Add:**
```json
{
  "dependencies": {
    "@hono/node-ws": "^1.0.0"
  }
}
```

---

### Phase 2: Add Package Export

**File:** `packages/springboard/package.json`

**Add export entry:**
```json
"./platforms/node/entrypoints/node_dev_entrypoint": {
  "types": "./dist/platforms/node/entrypoints/node_dev_entrypoint.d.ts",
  "import": "./dist/platforms/node/entrypoints/node_dev_entrypoint.js"
}
```

---

### Phase 3: Update Springboard Vite Plugin

**File:** `test-apps/esbuild-legacy-test/springboard-vite-plugin.ts`

#### Changes to Make:

**1. Add import at top:**
```typescript
import devServer from '@hono/vite-dev-server'
```

**2. Remove imports:**
```typescript
// DELETE:
import { spawn, ChildProcess } from 'child_process';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
```

**3. Remove plugin option:**
```typescript
// DELETE from SpringboardPluginOptions:
nodeServerPort?: number;
```

**4. Update `config()` hook:**

**BEFORE:** Either/or logic (web OR node)
```typescript
const buildPlatform = hasWeb ? 'web' : hasNode ? 'node' : null;

if (buildPlatform === 'node') {
  // Node config
} else {
  // Web config
}
```

**AFTER:** Handle three cases
```typescript
config(config, env) {
  isDevMode = env.command === 'serve';

  // Case 1: Dev mode with BOTH platforms
  if (isDevMode && hasNode && hasWeb) {
    return {
      plugins: [
        devServer({
          entry: 'springboard/platforms/node/entrypoints/node_dev_entrypoint',
          exclude: [
            /^\/@.+$/,              // Vite internals
            /.*\.(ts|tsx|vue)($|\?)/,  // Source files
            /.*\.(s?css|less)($|\?)/,  // Styles
            /^\/$/,                 // Root (let Vite serve index.html)
            /^\/index.html/,        // Index HTML
            /^\/src\//,             // Source directory
            /^\/.springboard\//,    // Generated entries
          ],
        })
      ],
      build: {
        rollupOptions: {
          input: DEV_ENTRY_FILE,  // Browser entry
        }
      }
    };
  }

  // Case 2: Node-only build (SSR)
  if (buildPlatform === 'node') {
    return {
      build: {
        ssr: true,
        rollupOptions: {
          input: NODE_ENTRY_FILE,
          external: [/* ... */],
        },
      },
    };
  }

  // Case 3: Web-only build
  if (buildPlatform === 'web') {
    const entryFile = isDevMode ? DEV_ENTRY_FILE : BUILD_ENTRY_FILE;
    return {
      build: {
        rollupOptions: {
          input: entryFile,
        },
      },
    };
  }
}
```

**5. Simplify `configureServer()` hook:**

**DELETE lines 210-387:** All process spawning, proxy middleware, WebSocket upgrade handling

**KEEP only:**
```typescript
configureServer(server: ViteDevServer) {
  return () => {
    // Serve HTML for / and /index.html
    server.middlewares.use((req, res, next) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        server.transformIndexHtml(req.url, generateHtml())
          .then(transformed => res.end(transformed))
          .catch(next);
        return;
      }
      next();
    });

    // That's it! @hono/vite-dev-server handles:
    // - Running the Hono app
    // - Mounting /rpc, /kv, /ws routes
    // - WebSocket upgrades
    // - Process lifecycle
  };
}
```

**6. Remove from `buildStart()` if needed:**

The node entry generation might not be needed anymore since we're pointing directly to springboard's entrypoint. Review and potentially remove the node-specific file generation.

---

### Phase 4: Add @hono/vite-dev-server Dependency

**File:** `test-apps/esbuild-legacy-test/package.json`

```json
{
  "devDependencies": {
    "@hono/vite-dev-server": "^0.15.0"
  }
}
```

**Remove:**
```json
{
  "devDependencies": {
    "http-proxy-middleware": "^X.X.X"  // No longer needed
  }
}
```

---

### Phase 5: Delete Test App Node Server File

**File to DELETE:** `test-apps/esbuild-legacy-test/node-dev-server.ts`

**Reason:** No longer needed - using springboard's generic entrypoint instead

---

### Phase 6: Update Environment Variable Handling

**File:** `test-apps/esbuild-legacy-test/vite.config.ts`

Add Vite's `define` config for `process.env` values:

```typescript
export default defineConfig({
  plugins: [
    springboard({ entry: './src/tic_tac_toe.tsx' })
  ],
  define: {
    'process.env.DEBUG_LOG_PERFORMANCE': JSON.stringify(
      process.env.DEBUG_LOG_PERFORMANCE === 'true'
    ),
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development'
    ),
  }
})
```

**Alternative:** Install `vite-plugin-environment` for quick/dirty fix:
```typescript
import EnvironmentPlugin from 'vite-plugin-environment'

export default defineConfig({
  plugins: [
    springboard({ entry: './src/tic_tac_toe.tsx' }),
    EnvironmentPlugin({
      DEBUG_LOG_PERFORMANCE: process.env.DEBUG_LOG_PERFORMANCE || 'false',
      NODE_ENV: process.env.NODE_ENV || 'development',
    })
  ]
})
```

---

### Phase 7: Clean Up Node Entrypoints

**Directory:** `packages/springboard/src/platforms/node/entrypoints/`

**Current files:**
- `node_flexible_entrypoint.ts` - Review if still needed
- `node_server_entrypoint.ts` - Keep for production builds
- `node_dev_entrypoint.ts` - NEW (create in Phase 1)

**Actions:**
- Review and potentially remove `node_flexible_entrypoint` if unused
- Keep `node_server_entrypoint` for production
- Ensure only necessary entrypoints are exported in package.json

---

## Testing Plan

### Test 1: Dev Mode with Both Platforms

```bash
cd test-apps/esbuild-legacy-test
SPRINGBOARD_PLATFORM=node,web vite dev
```

**Expected:**
- ✅ Vite starts on port 5173
- ✅ Browser app loads at http://localhost:5173
- ✅ Hono server initializes (SQLite, etc.)
- ✅ `/rpc/*` routes work
- ✅ `/kv/*` routes work
- ✅ WebSocket at `/ws` works
- ✅ Single process, single port
- ✅ No proxy errors

### Test 2: Dev Mode Web Only

```bash
SPRINGBOARD_PLATFORM=web vite dev
```

**Expected:**
- ✅ Only browser app runs
- ✅ No Hono server initialized
- ✅ Mock RPC/KV used (offline mode)

### Test 3: Build Mode

```bash
SPRINGBOARD_PLATFORM=web vite build
SPRINGBOARD_PLATFORM=node vite build
```

**Expected:**
- ✅ Two separate builds created
- ✅ `dist/browser/` contains client bundle
- ✅ `dist/node/` contains server bundle

### Test 4: Verify React Optimization

**Check:**
- Open browser devtools
- Verify no "does not provide an export named 'useEffect'" error
- Check network tab: `springboard/platforms/browser/entrypoints/react_entrypoint` is pre-bundled

---

## Migration Risks & Mitigation

### Risk 1: WebSocket Not Working

**Issue:** `@hono/vite-dev-server` might not support WebSocket upgrades properly

**Mitigation:**
- Test WebSocket connection after migration
- If broken, document that WS only works in production builds
- Or refactor to use `@hono/node-ws` middleware pattern

### Risk 2: SQLite Initialization Timing

**Issue:** Top-level await might cause issues with Vite's module loading

**Mitigation:**
- Test thoroughly
- If issues occur, wrap in lazy initialization function
- Consider using a factory pattern instead of top-level await

### Risk 3: Route Conflicts

**Issue:** Hono routes might conflict with Vite routes

**Mitigation:**
- Use comprehensive `exclude` patterns in `@hono/vite-dev-server` config
- Test all route paths (`/`, `/src/`, `/rpc/`, etc.)
- Ensure Vite serves static assets and Hono serves API routes

### Risk 4: Error Isolation

**Issue:** Server crash would kill entire dev server (unlike separate process)

**Mitigation:**
- Add better error handling in node_dev_entrypoint
- Consider try/catch around initialization
- Document that server errors require full restart

---

## Rollback Plan

If migration fails, revert by:

1. Restore `node-dev-server.ts`
2. Restore process spawning code in plugin
3. Restore `http-proxy-middleware` dependency
4. Remove `@hono/vite-dev-server` dependency
5. Revert plugin `config()` and `configureServer()` changes

Git commits should be atomic for each phase to enable easy rollback.

---

## Success Criteria

✅ Single `vite dev` command runs both browser + server
✅ No separate process spawning
✅ No proxy middleware
✅ All routes work (`/`, `/rpc/*`, `/kv/*`, `/ws`)
✅ React dependency optimization working (no CommonJS errors)
✅ WebSocket connections work
✅ ~200 lines of code removed from plugin
✅ Test app has no `node-dev-server.ts` file
✅ Architecture consistent between browser and node

---

## Timeline Estimate

- **Phase 1-2:** Create node_dev_entrypoint (2-3 hours)
  - Includes WebSocket refactoring to `@hono/node-ws`
- **Phase 3:** Update plugin (1-2 hours)
- **Phase 4-5:** Dependencies and cleanup (30 min)
- **Phase 6:** Environment variables (30 min)
- **Phase 7:** Clean up entrypoints (1 hour)
- **Testing:** Comprehensive testing (2-3 hours)

**Total:** ~8-12 hours

---

## Notes

- The browser entry generation (`.springboard/dev-entry.js`) stays the same
- The transpilation to `dist/` is already working
- package.json exports are already updated
- This migration is about **runtime architecture**, not build configuration
- The key insight: node entrypoint should be in springboard package, not test app
