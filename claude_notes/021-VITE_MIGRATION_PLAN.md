# Vite Dev Server Migration Plan

## Overview

Migrate from `http-proxy-middleware` to Vite's built-in proxy, and generate physical node entry files consistently with the browser pattern. This enables:

- ✅ Both browser + server in one `vite dev` command
- ✅ Vite-native proxy architecture
- ✅ Node watch mode for auto-restart
- ✅ Physical entry generation (consistent with browser)
- ✅ No app-specific server files
- ✅ WebSocket support maintained

## Architecture

### Current
```
Vite Process (5173)
  ↓ spawns
Node Process (1337) running tsx node-dev-server.ts
  ↓ proxied via http-proxy-middleware
Browser requests → Vite
API requests → Node server via http-proxy-middleware
```

### Target
```
Vite Process (5173) + Node Process (1337)
  ├─ Vite dev server (HTML, JS, CSS)
  │   ↓ proxies via Vite's server.proxy
  └─ Node process running .springboard/node-entry.js
     └─ Hono app from springboard/dist/platforms/node/entrypoints/node_server_entrypoint.js
        ├─ /rpc/* routes
        ├─ /kv/* routes
        └─ /ws WebSocket
```

**Key Insight:** WebSocket doesn't work with `@hono/vite-dev-server` (see [issue #253](https://github.com/honojs/vite-plugins/issues/253)), so we keep separate processes but use Vite's native proxy.

## Tasks

### Phase 1: Update Springboard Vite Plugin

**File:** `test-apps/esbuild-legacy-test/springboard-vite-plugin.ts`

#### 1. Remove http-proxy-middleware

**Delete import:**
```typescript
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
```

**Delete from `configureServer()` hook:**
- Lines 312-376: All proxy middleware code
- Lines 369-377: Manual WebSocket upgrade handling

#### 2. Add Vite's server.proxy config

**In `config()` hook, when `isDevMode && hasNode && hasWeb`:**

```typescript
config(config, env) {
  isDevMode = env.command === 'serve';

  // Dev mode with both platforms
  if (isDevMode && hasNode && hasWeb) {
    const nodePort = options.nodeServerPort ?? 1337;

    return {
      server: {
        proxy: {
          '/rpc': {
            target: `http://localhost:${nodePort}`,
            changeOrigin: true,
          },
          '/kv': {
            target: `http://localhost:${nodePort}`,
            changeOrigin: true,
          },
          '/ws': {
            target: `ws://localhost:${nodePort}`,
            ws: true,
            changeOrigin: true,
          },
        },
      },
      build: {
        rollupOptions: {
          input: DEV_ENTRY_FILE,  // Browser entry
        }
      }
    };
  }

  // Existing node-only and web-only cases remain
  // ...
}
```

#### 3. Update node entry generation

**In `buildStart()` hook, for node platform:**

```typescript
if (buildPlatform === 'node') {
  const nodeEntryCode = `
import initApp from 'springboard/dist/platforms/node/entrypoints/node_server_entrypoint.js';

// Note: User entry not needed - modules register in browser
initApp();
`;
  writeFileSync(NODE_ENTRY_FILE, nodeEntryCode, 'utf-8');
  console.log('[springboard] Generated node entry file in .springboard/');
}
```

#### 4. Update spawn command

**In `configureServer()` hook, update spawn:**

```typescript
nodeProcess = spawn('node', ['--watch', NODE_ENTRY_FILE], {
  cwd: __dirname,
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

**Change from:**
- ❌ `spawn('npx', ['tsx', nodeServerPath], ...)`

**Change to:**
- ✅ `spawn('node', ['--watch', NODE_ENTRY_FILE], ...)`

---

### Phase 2: Remove http-proxy-middleware Dependency

**File:** `test-apps/esbuild-legacy-test/package.json`

```json
{
  "devDependencies": {
    "http-proxy-middleware": "^X.X.X"  // DELETE this line
  }
}
```

---

### Phase 3: Keep node-dev-server.ts for Reference

**File:** `test-apps/esbuild-legacy-test/node-dev-server.ts`

**Action:** Keep this file as a reference but it will no longer be used. The plugin now generates `.springboard/node-entry.js` instead.

**Add comment at top:**
```typescript
/**
 * REFERENCE ONLY - Not used in production
 *
 * This file is kept for reference. The actual dev server entry is now
 * generated at .springboard/node-entry.js by the Springboard Vite plugin.
 */
```

---

### Phase 4: Publish and Test

Run the publish workflow to test:

```bash
cd test-apps/esbuild-legacy-test
./scripts/test-publish-workflow.sh
```

This will:
1. Build TypeScript (already configured in script)
2. Publish to Verdaccio
3. Update test app dependencies
4. Test the build

---

## Testing Plan

### Test 1: Dev Mode with Both Platforms

```bash
cd test-apps/esbuild-legacy-test
SPRINGBOARD_PLATFORM=node,web vite dev
```

**Expected:**
- ✅ Vite starts on port 5173
- ✅ Node server starts on port 1337 (separate process)
- ✅ Browser app loads at http://localhost:5173
- ✅ Node server auto-restarts on `.springboard/node-entry.js` changes
- ✅ `/rpc/*` routes work (proxied via Vite)
- ✅ `/kv/*` routes work (proxied via Vite)
- ✅ WebSocket at `/ws` works (proxied via Vite)
- ✅ No proxy errors

### Test 2: Dev Mode Web Only

```bash
SPRINGBOARD_PLATFORM=web vite dev
```

**Expected:**
- ✅ Only browser app runs
- ✅ No node server spawned
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

## Key Differences from Original Plan

**What Changed:**
- ❌ Not using `@hono/vite-dev-server` (WebSocket incompatibility)
- ✅ Using Vite's built-in `server.proxy` instead
- ✅ Keeping separate processes (better error isolation)
- ✅ Using `node --watch` for auto-restart (native Node.js)
- ✅ Generating `.springboard/node-entry.js` (consistent with browser)

**What Stayed:**
- ✅ Single `vite dev` command for both platforms
- ✅ Physical entry files (consistent architecture)
- ✅ Generic entrypoints in springboard package
- ✅ WebSocket support maintained

---

## Success Criteria

✅ Single `vite dev` command runs both browser + server
✅ Use Vite's native `server.proxy` (no http-proxy-middleware)
✅ Physical node entry generated in `.springboard/`
✅ All routes work (`/`, `/rpc/*`, `/kv/*`, `/ws`)
✅ React dependency optimization working (no CommonJS errors)
✅ WebSocket connections work
✅ Node server auto-restarts on changes (`node --watch`)
✅ Architecture consistent between browser and node

---

## Timeline Estimate

- **Phase 1:** Update plugin (1-2 hours)
  - Remove http-proxy-middleware
  - Add Vite's server.proxy
  - Update node entry generation
  - Update spawn command
- **Phase 2:** Remove dependency (5 min)
- **Phase 3:** Update node-dev-server.ts comment (5 min)
- **Phase 4:** Publish and test (30 min)

**Total:** ~2-3 hours

---

## Notes

- The browser entry generation (`.springboard/dev-entry.js`) stays the same
- The transpilation to `dist/` is already working
- package.json exports are already updated to point to `dist/`
- This migration is about **dev server runtime**, not build configuration
- Node entrypoint lives in springboard package at `dist/platforms/node/entrypoints/node_server_entrypoint.js`
