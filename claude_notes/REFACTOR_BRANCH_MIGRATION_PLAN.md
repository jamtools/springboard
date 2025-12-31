# Refactor Branch Migration Plan

## Executive Summary

This document provides a detailed plan for migrating the platform abstraction work from the `refactor-springboard-server` branch to the current `vite-support` branch. The refactor branch contains a proven, debugged implementation of platform-agnostic server code that works with both Node.js and Cloudflare Workers.

**Branch Location**: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree`
**Current Branch**: `refactor-springboard-server`
**Latest Commit**: `52f19fa - fix cf workers deployment by using 'party: 'my-server'`

---

## Key Architectural Changes in Refactor Branch

### 1. Package Structure

The refactor branch separates server code into distinct packages:

```
packages/springboard/
├── server/                    # Platform-agnostic server logic
│   ├── package.json           # Standalone package
│   ├── index.ts               # Exports serverRegistry
│   └── src/
│       ├── register.ts        # ServerModuleAPI definition
│       ├── hono_app.ts        # Platform-agnostic Hono app
│       ├── services/
│       │   ├── crossws_json_rpc.ts     # WebSocket RPC handling
│       │   └── server_json_rpc.ts      # HTTP RPC handling
│       └── types/
│           └── server_app_dependencies.ts
│
└── platforms/                 # Platform-specific implementations
    ├── node/
    │   ├── package.json
    │   ├── entrypoints/
    │   │   └── node_entrypoint.ts      # Node.js startup
    │   └── services/
    │       ├── node_json_rpc.ts
    │       ├── node_kvstore_service.ts
    │       ├── node_file_storage_service.ts
    │       └── ws_server_core_dependencies.ts
    │
    ├── cf-workers/
    │   ├── package.json
    │   ├── entrypoints/
    │   │   ├── cf_worker_entrypoint.ts
    │   │   ├── cf_worker_browser_entrypoint.tsx
    │   │   └── wrangler.toml
    │   └── src/
    │       ├── hono_app.ts    # CF-specific Hono setup
    │       └── services/
    │           ├── kv_store.ts         # Uses Durable Objects
    │           └── rpc_server.ts
    │
    └── webapp/                # Browser/client platform
        └── services/
            ├── browser_json_rpc.ts     # HTTP-based RPC client
            └── browser_kvstore_service.ts
```

**Current Branch** (vite-support):
```
packages/springboard/
├── src/
│   ├── server/
│   │   ├── hono_app.ts               # Node-specific
│   │   ├── register.ts
│   │   └── (mixed platform code)
│   └── platforms/
│       ├── node/                      # Old structure
│       ├── browser/                   # Old structure
│       └── (platform-specific mixed with core)
```

---

## Critical Commits to Migrate

### Commit Timeline (Chronological)

| Commit | Date | Description | Impact |
|--------|------|-------------|--------|
| `10c0e49` | Aug 9, 2025 | Change RPC to use HTTP (#39) | ✅ **CRITICAL** - Replaces WebSocket-only RPC with HTTP |
| `0f86a3b` | Aug 12, 2025 | Introduce crossws to support cf workers | ✅ **CRITICAL** - Universal WebSocket abstraction |
| `d5104da` | Aug 25, 2025 | Fix registerServerModule race condition (#48) | ✅ **CRITICAL** - Prevents initialization bugs |
| `118e0c3` | Sep 16, 2025 | Remove partykit library | ⚠️ **IMPORTANT** - Cleanup, not essential |
| `3f7ceb3` | Sep 25, 2025 | Address review feedback: clean up code | ⚠️ **IMPORTANT** - Code cleanup |
| `52f19fa` | Sep 25, 2025 | Fix cf workers deployment using party server | ⚠️ **IMPORTANT** - CF Workers fix |

---

## Detailed File-by-File Migration Plan

### Phase 1: Core Server Abstraction (Priority 1)

#### File 1: `packages/springboard/server/package.json`
**Status**: New file (doesn't exist in current branch)

**Action**: Create new file

```bash
mkdir -p phone2daw-jamtools-worktree/packages/springboard/server/src/{services,types}
```

**Content to copy**:
```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/package.json:1-29 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/package.json:1
```

**Key Changes**:
- Peer dependencies on `hono` and `springboard`
- Dependency on `crossws` for WebSocket abstraction
- Dependency on `json-rpc-2.0` for RPC
- Dependency on `srvx` (service utilities)

---

#### File 2: `packages/springboard/server/index.ts`
**Status**: New file

**Action**: Create export file

```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/index.ts:1-4 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/index.ts:1
```

**Content**:
```typescript
import {serverRegistry} from './src/register';

export default serverRegistry;
```

---

#### File 3: `packages/springboard/server/src/register.ts`
**Status**: EXISTS in current branch at `packages/springboard/src/server/register.ts`

**Current Location**: `phone2daw-jamtools-worktree/packages/springboard/src/server/register.ts`
**Target Location**: `phone2daw-jamtools-worktree/packages/springboard/server/src/register.ts`

**Action**: REPLACE current file with refactor branch version

**Key Differences**:
1. Refactor branch has cleaner type definitions
2. Adds `RpcMiddleware` type (used for authentication/authorization)
3. Adds `ServerHooks` type with `registerRpcMiddleware`

```bash
# Option A: Direct copy (overwrites)
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts \
   phone2daw-jamtools-worktree/packages/springboard/server/src/register.ts

# Option B: Using copy-lines
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts:1-36 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/src/register.ts:1
```

**Manual Integration**: Update old location to re-export:
```typescript
// packages/springboard/src/server/register.ts (keep for backward compat)
export * from '../../../server/src/register';
```

---

#### File 4: `packages/springboard/server/src/hono_app.ts`
**Status**: EXISTS in current branch at `packages/springboard/src/server/hono_app.ts`

**Current**: Node.js-specific implementation (192 lines)
**Refactor**: Platform-agnostic implementation (353 lines)

**Action**: REPLACE with refactor branch version

**Key Differences**:
| Feature | Current Branch | Refactor Branch |
|---------|---------------|-----------------|
| WebSocket | `@hono/node-ws` | `crossws` (platform-agnostic) |
| Static files | Node.js `fs` directly | Injected via callback |
| KV Store | Direct `KVStoreFromKysely` | Injected `KVStore` interface |
| RPC | Node-specific | Platform-agnostic `ServerJsonRpcClientAndServer` |
| Initialization | Self-contained | Dependency injection pattern |

**Critical Changes**:
1. **Dependency Injection**: `initApp(initArgs: InitServerAppArgs)` instead of `initApp(kvDeps: WebsocketServerCoreDependencies)`
2. **Resource Injection**: `injectResources()` callback for platform-specific logic
3. **WebSocket Hooks**: Returns `createWebSocketHooks()` instead of `injectWebSocket()`
4. **RPC Middleware**: Support for middleware chain (auth, logging, etc.)

```bash
# Full file copy
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/hono_app.ts \
   phone2daw-jamtools-worktree/packages/springboard/server/src/hono_app.ts
```

**Type Signatures to Note**:
```typescript
// OLD (current branch)
export const initApp = (kvDeps: WebsocketServerCoreDependencies): InitAppReturnValue

// NEW (refactor branch)
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

export const initApp = (initArgs: InitServerAppArgs): InitAppReturnValue
```

---

#### File 5: `packages/springboard/server/src/services/crossws_json_rpc.ts`
**Status**: NEW file (doesn't exist in current branch)

**Purpose**: Platform-agnostic WebSocket handling using crossws

**Action**: Copy entire file

```bash
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/services/crossws_json_rpc.ts \
   phone2daw-jamtools-worktree/packages/springboard/server/src/services/crossws_json_rpc.ts
```

**What it does**:
- Provides `createCommonWebSocketHooks()` that works with any crossws adapter
- Handles JSON-RPC over WebSocket
- Platform-agnostic (Node, CF Workers, Deno, etc.)

**Key Export**:
```typescript
export const createCommonWebSocketHooks = (enableRpc?: boolean) => {
    return {
        open(peer: Peer) { /* ... */ },
        message(peer: Peer, message: Message) { /* ... */ },
        close(peer: Peer, details: CloseDetails) { /* ... */ },
        error(peer: Peer, error: Error) { /* ... */ }
    };
};
```

---

#### File 6: `packages/springboard/server/src/services/server_json_rpc.ts`
**Status**: EXISTS at `packages/springboard/src/server/services/server_json_rpc.ts`

**Action**: REPLACE with refactor branch version

**Key Changes**:
1. Renamed from `NodeJsonRpcServer` to `ServerJsonRpcClientAndServer` (platform-agnostic name)
2. Adds support for RPC context (middleware results)
3. Better error handling

```bash
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/services/server_json_rpc.ts \
   phone2daw-jamtools-worktree/packages/springboard/server/src/services/server_json_rpc.ts
```

---

#### File 7: `packages/springboard/server/src/types/server_app_dependencies.ts`
**Status**: NEW file

**Purpose**: Type definitions for server dependencies

**Action**: Copy entire file

```bash
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/types/server_app_dependencies.ts \
   phone2daw-jamtools-worktree/packages/springboard/server/src/types/server_app_dependencies.ts
```

---

### Phase 2: Node Platform Implementation (Priority 1)

#### Directory: `packages/springboard/platforms/node/`
**Status**: EXISTS but has old structure

**Action**: Create new platform package structure

```bash
mkdir -p phone2daw-jamtools-worktree/packages/springboard/platforms/node/{entrypoints,services}
```

---

#### File 8: `packages/springboard/platforms/node/package.json`
**Status**: Needs update

**Action**: Copy and merge

```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/package.json:1-25 \
  --to phone2daw-jamtools-worktree/packages/springboard/platforms/node/package.json:1
```

**Key Dependencies**:
- `@hono/node-server` - Node.js HTTP server
- `crossws` - WebSocket abstraction
- `json-rpc-2.0` - RPC protocol
- Peer deps on `springboard`, `springboard-server`, `@springboardjs/data-storage`

---

#### File 9: `packages/springboard/platforms/node/entrypoints/node_entrypoint.ts`
**Status**: NEW file (critical!)

**Purpose**: Node.js startup logic that uses platform-agnostic `initApp()`

**Action**: Copy entire file

```bash
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts \
   phone2daw-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts
```

**What it does** (99 lines):
1. Imports platform-agnostic `initApp()` from `springboard-server`
2. Creates Node.js-specific dependencies (SQLite KV, file system)
3. Calls `initApp()` with injected dependencies
4. Sets up `crosswsNode` adapter for WebSockets
5. Injects Node.js-specific resource handlers (file serving, env vars)
6. Starts Springboard engine

**Key Pattern**:
```typescript
// 1. Create platform deps
const nodeKvDeps = await makeWebsocketServerCoreDependenciesWithSqlite();

// 2. Create WebSocket adapter
let wsNode: ReturnType<typeof crosswsNode>;

// 3. Call platform-agnostic init
const {app, serverAppDependencies, injectResources, createWebSocketHooks} = initApp({
    broadcastMessage: (message) => wsNode.publish('event', message),
    remoteKV: nodeKvDeps.kvStoreFromKysely,
    userAgentKV: new LocalJsonNodeKVStoreService('userAgent'),
});

// 4. Create WS hooks
wsNode = crosswsNode({
    hooks: createWebSocketHooks(useWebSocketsForRpc)
});

// 5. Start server
const server = serve({
    fetch: app.fetch,
    port: parseInt(port),
});

// 6. Inject resources
injectResources({
    engine,
    serveStaticFile: async (c, fileName, headers) => {
        // Node.js fs.readFile implementation
    },
    getEnvValue: name => process.env[name],
});
```

---

#### File 10: `packages/springboard/platforms/node/services/ws_server_core_dependencies.ts`
**Status**: NEW file

**Purpose**: SQLite-backed KV store for Node.js

**Action**: Copy entire file

```bash
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/services/ws_server_core_dependencies.ts \
   phone2daw-jamtools-worktree/packages/springboard/platforms/node/services/ws_server_core_dependencies.ts
```

---

#### File 11: `packages/springboard/platforms/node/services/node_kvstore_service.ts`
**Status**: EXISTS

**Action**: Compare and merge if needed

```bash
# View differences
diff /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/services/node_kvstore_service.ts \
     phone2daw-jamtools-worktree/packages/springboard/src/platforms/node/services/node_kvstore_service.ts
```

---

### Phase 3: Webapp/Browser Platform (Priority 2)

#### File 12: `packages/springboard/platforms/webapp/services/browser_json_rpc.ts`
**Status**: EXISTS

**Current**: WebSocket-only RPC
**Refactor**: HTTP-based RPC with WebSocket fallback

**Action**: REPLACE with refactor branch version

**Why Critical**:
- Refactor branch uses HTTP for RPC (more reliable, works everywhere)
- WebSockets are optional (controlled by `PUBLIC_USE_WEBSOCKETS_FOR_RPC`)
- Better error handling and retry logic

```bash
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/webapp/services/browser_json_rpc.ts \
   phone2daw-jamtools-worktree/packages/springboard/platforms/webapp/services/browser_json_rpc.ts
```

**Key Changes**:
```typescript
// OLD: WebSocket-only
export class BrowserJsonRpcClient {
    constructor(wsUrl: string) { /* ... */ }
}

// NEW: HTTP-first, WebSocket optional
export class BrowserJsonRpcClient {
    constructor(
        rpcUrl: string,  // HTTP endpoint
        wsUrl?: string   // Optional WebSocket
    ) { /* ... */ }

    // HTTP RPC request
    async request(method: string, params: unknown) {
        const response = await fetch(this.rpcUrl, {
            method: 'POST',
            body: JSON.stringify({ jsonrpc: '2.0', method, params })
        });
        // ...
    }
}
```

---

### Phase 4: Core Package Updates (Priority 2)

#### File 13: `packages/springboard/core/services/http_kv_store_client.ts`
**Status**: EXISTS

**Action**: Merge changes from refactor branch

**Changes in Refactor Branch**:
```bash
cd /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree && \
git diff main...refactor-springboard-server packages/springboard/core/services/http_kv_store_client.ts
```

**Expected Changes**: Better error handling, retry logic

---

#### File 14: `packages/springboard/core/engine/module_api.ts`
**Status**: EXISTS

**Action**: Review and merge changes

**Changes**: Likely related to module registration timing

```bash
cd /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree && \
git diff main...refactor-springboard-server packages/springboard/core/engine/module_api.ts
```

---

### Phase 5: Cloudflare Workers Platform (Priority 3 - Optional)

**Note**: Only migrate if you plan to support CF Workers deployment immediately. Can be deferred.

#### Directory: `packages/springboard/platforms/cf-workers/`
**Status**: NEW

**Files to Copy**:
1. `package.json`
2. `entrypoints/cf_worker_entrypoint.ts`
3. `entrypoints/cf_worker_browser_entrypoint.tsx`
4. `entrypoints/wrangler.toml`
5. `src/hono_app.ts` (CF-specific Hono setup)
6. `src/services/kv_store.ts` (Durable Objects integration)
7. `src/services/rpc_server.ts`

**Action**: Copy entire directory if needed

```bash
cp -r /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/cf-workers \
      phone2daw-jamtools-worktree/packages/springboard/platforms/cf-workers
```

---

## Integration with Vite Plugin

### Current Vite Plugin Template

**File**: `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`

**Current Approach** (your recent work):
```typescript
import { serve } from '@hono/node-server';
import { initApp } from 'springboard/server';

const { app } = initApp(coreDeps);

const server = serve({
    fetch: app.fetch,
    port: __PORT__,
});
```

**Needs to Change To** (refactor branch pattern):
```typescript
import { serve } from '@hono/node-server';
import crosswsNode from 'crossws/adapters/node';
import { initApp } from 'springboard-server/src/hono_app';
import { makeWebsocketServerCoreDependenciesWithSqlite } from '@springboardjs/platforms-node/services/ws_server_core_dependencies';
import { LocalJsonNodeKVStoreService } from '@springboardjs/platforms-node/services/node_kvstore_service';
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
        console.log(`Server listening on http://localhost:${info.port}`);
    });

    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        if (url.pathname === '/ws') {
            wsNode.handleUpgrade(request, socket, head);
        } else {
            socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
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
            const fullPath = `${webappDistFolder}/${fileName}`;
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

**Why This Matters**:
- WebSocket support via `crossws`
- Proper dependency injection
- Allows platform switching (Node → CF Workers → Deno) without changing user code

---

## Dependency Changes

### New Dependencies to Add

#### For `packages/springboard/server/`
```json
{
  "dependencies": {
    "crossws": "catalog:",
    "json-rpc-2.0": "catalog:",
    "srvx": "^0.8.6"
  },
  "peerDependencies": {
    "hono": "catalog:",
    "springboard": "workspace:*"
  }
}
```

#### For `packages/springboard/platforms/node/`
```json
{
  "dependencies": {
    "@hono/node-server": "^1.13.2",
    "crossws": "catalog:",
    "json-rpc-2.0": "catalog:",
    "reconnecting-websocket": "catalog:"
  },
  "peerDependencies": {
    "@springboardjs/data-storage": "workspace:*",
    "springboard": "workspace:*",
    "springboard-server": "workspace:*"
  }
}
```

#### For `packages/springboard/vite-plugin/`
```json
{
  "dependencies": {
    "crossws": "catalog:",
    "@springboardjs/platforms-node": "workspace:*",
    "springboard-server": "workspace:*"
  }
}
```

---

## Migration Execution Plan

### Step-by-Step Execution

#### Step 1: Create Server Package Structure (30 min)
```bash
cd phone2daw-jamtools-worktree

# Create directory structure
mkdir -p packages/springboard/server/src/{services,types}

# Copy package.json
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/package.json:1-29 \
  --to packages/springboard/server/package.json:1

# Copy index.ts
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/index.ts:1-4 \
  --to packages/springboard/server/index.ts:1

# Copy register.ts
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts \
   packages/springboard/server/src/register.ts

# Copy hono_app.ts
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/hono_app.ts \
   packages/springboard/server/src/hono_app.ts

# Copy services
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/services/crossws_json_rpc.ts \
   packages/springboard/server/src/services/crossws_json_rpc.ts

cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/services/server_json_rpc.ts \
   packages/springboard/server/src/services/server_json_rpc.ts

# Copy types
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/types/server_app_dependencies.ts \
   packages/springboard/server/src/types/server_app_dependencies.ts

# Add tsconfig
cat > packages/springboard/server/tsconfig.json << 'EOF'
{
  "extends": "../../../configs/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src/**/*", "index.ts"]
}
EOF
```

#### Step 2: Create Node Platform Package (30 min)
```bash
# Create directory structure
mkdir -p packages/springboard/platforms/node/{entrypoints,services}

# Copy package.json
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/package.json:1-25 \
  --to packages/springboard/platforms/node/package.json:1

# Copy entrypoint
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts \
   packages/springboard/platforms/node/entrypoints/node_entrypoint.ts

# Copy services
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/services/ws_server_core_dependencies.ts \
   packages/springboard/platforms/node/services/ws_server_core_dependencies.ts

# Check if node_kvstore_service needs updates
diff /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/services/node_kvstore_service.ts \
     packages/springboard/src/platforms/node/services/node_kvstore_service.ts || \
  cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/services/node_kvstore_service.ts \
     packages/springboard/platforms/node/services/node_kvstore_service.ts
```

#### Step 3: Update Webapp Platform (15 min)
```bash
# Create webapp services directory if needed
mkdir -p packages/springboard/platforms/webapp/services

# Copy browser RPC client
cp /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/webapp/services/browser_json_rpc.ts \
   packages/springboard/platforms/webapp/services/browser_json_rpc.ts
```

#### Step 4: Update Core Package (15 min)
```bash
# Review changes to http_kv_store_client.ts
cd /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree
git show refactor-springboard-server:packages/springboard/core/services/http_kv_store_client.ts > /tmp/http_kv_store_client.refactor.ts

# Compare with current
diff /tmp/http_kv_store_client.refactor.ts \
     phone2daw-jamtools-worktree/packages/springboard/src/core/services/http_kv_store_client.ts

# If changes are minimal, copy over
cp /tmp/http_kv_store_client.refactor.ts \
   phone2daw-jamtools-worktree/packages/springboard/src/core/services/http_kv_store_client.ts
```

#### Step 5: Update Vite Plugin Template (30 min)
```bash
# Back up current template
cp packages/springboard/vite-plugin/src/templates/node-entry.template.ts \
   packages/springboard/vite-plugin/src/templates/node-entry.template.ts.backup

# Use node_entrypoint.ts from refactor branch as reference
# Manually adapt it to template format (replace hardcoded values with __PORT__, etc.)
```

**Manual Step**: Edit `node-entry.template.ts` to match the pattern from `node_entrypoint.ts`

Key replacements:
- `process.env.PORT` → `__PORT__`
- `import '../user-app'` → `import '__USER_ENTRY__'`
- Add WebSocket upgrade handling
- Add resource injection

#### Step 6: Install Dependencies (5 min)
```bash
cd phone2daw-jamtools-worktree

# Add catalog entries for new deps (if not already present)
# Edit pnpm-workspace.yaml or package.json catalog

pnpm install
```

#### Step 7: Update Package Exports (10 min)
```bash
# Update main springboard package.json exports
# Add:
# "exports": {
#   "./server": "./server/index.ts",
#   "./platforms/node": "./platforms/node/...",
#   ...
# }
```

#### Step 8: Test Build (15 min)
```bash
cd apps/vite-test

# Build
pnpm build

# Check output
ls -la dist/
ls -la .output/  # if using Nitro later

# Run
node dist/node/index.mjs
```

#### Step 9: Verify WebSockets Work (10 min)
```bash
# Start server
node dist/node/index.mjs

# In another terminal, test WebSocket connection
# (Use browser console or websocat tool)
```

---

## Testing Checklist

### Unit Tests
- [ ] `packages/springboard/server/src/register.ts` - ServerModuleAPI registration
- [ ] `packages/springboard/server/src/hono_app.ts` - HTTP/WS routing
- [ ] `packages/springboard/server/src/services/server_json_rpc.ts` - RPC handling

### Integration Tests
- [ ] Node.js server starts successfully
- [ ] HTTP RPC requests work (`/rpc` endpoint)
- [ ] WebSocket connections work (`/ws` endpoint)
- [ ] KV store operations (get, set, get-all)
- [ ] Static file serving
- [ ] Springboard engine initializes
- [ ] User modules register correctly

### Platform Tests
- [ ] Node.js: SQLite KV store persists data
- [ ] Node.js: File system serving works
- [ ] Browser: HTTP RPC client works
- [ ] (Optional) CF Workers: Durable Objects work

---

## Rollback Plan

If migration fails:

### Option 1: Revert Individual Files
```bash
git checkout HEAD -- packages/springboard/server/
git checkout HEAD -- packages/springboard/platforms/node/
```

### Option 2: Keep Backup Branch
```bash
# Before starting migration
git checkout -b backup-before-refactor-migration

# After migration, if issues arise
git checkout backup-before-refactor-migration
```

### Option 3: Incremental Rollback
Keep `.backup` copies of critical files:
- `node-entry.template.ts.backup`
- `hono_app.ts.backup`
- `register.ts.backup`

---

## Risk Assessment

### High Risk ⚠️

1. **Breaking Changes to initApp()**
   - Old signature vs new signature
   - **Mitigation**: Provide adapter shim during transition

2. **WebSocket Behavior Changes**
   - `@hono/node-ws` → `crossws`
   - Different upgrade mechanism
   - **Mitigation**: Test thoroughly, document differences

3. **Vite Plugin Template Changes**
   - Major restructuring of node-entry.template.ts
   - **Mitigation**: Keep backup, test in isolation first

### Medium Risk ⚙️

4. **Dependency Version Conflicts**
   - New `crossws`, `srvx` dependencies
   - **Mitigation**: Use catalog versions, pin if needed

5. **RPC Middleware Breaking Changes**
   - New middleware system
   - **Mitigation**: Provide no-op middleware by default

6. **Path/Import Changes**
   - `springboard/server` → `springboard-server`
   - **Mitigation**: Use package.json exports for backward compat

### Low Risk ✅

7. **Additional Features**
   - RPC middleware, resource injection are additive
   - Old code will continue working with defaults

---

## Success Criteria

1. ✅ Node.js server starts without errors
2. ✅ HTTP RPC endpoint (`/rpc`) responds correctly
3. ✅ WebSocket endpoint (`/ws`) accepts connections
4. ✅ KV store operations work
5. ✅ Static assets are served correctly
6. ✅ Springboard engine initializes and modules register
7. ✅ Existing vite-test app works unchanged
8. ✅ Production build creates standalone Node.js server
9. ✅ (Stretch) CF Workers deployment works

---

## Timeline Estimate

| Phase | Task | Time | Cumulative |
|-------|------|------|------------|
| 1 | Create server package structure | 30 min | 30 min |
| 1 | Copy server files | 15 min | 45 min |
| 2 | Create node platform package | 30 min | 1h 15min |
| 2 | Copy node platform files | 15 min | 1h 30min |
| 3 | Update webapp platform | 15 min | 1h 45min |
| 4 | Update core package | 15 min | 2h |
| 5 | Update Vite plugin template | 30 min | 2h 30min |
| 6 | Install dependencies | 5 min | 2h 35min |
| 7 | Update package exports | 10 min | 2h 45min |
| 8 | Test build | 15 min | 3h |
| 9 | Debug issues | 1h | **4h total** |

**Total Estimate**: 3-4 hours for core migration

---

## Post-Migration Next Steps

### Immediate (Week 1)
1. ✅ Verify all tests pass
2. ✅ Update documentation
3. ✅ Publish updated packages to npm

### Short-term (Week 2-3)
1. Integrate with Nitro (use NITRO_INTEGRATION_PLAN.md)
2. Add CF Workers deployment example
3. Add Vercel deployment example

### Long-term (Month 1)
1. Migrate other platforms (Deno, Tauri, React Native)
2. Add platform-specific optimizations
3. Create platform migration guide

---

## Notes

- **Don't skip the server package**: It's the foundation of platform abstraction
- **Test incrementally**: After each file copy, run type checking
- **Keep backups**: Backup current working templates before replacing
- **Reference commits**: Key commits are `0f86a3b` (crossws), `d5104da` (race fix), `10c0e49` (HTTP RPC)
- **Use copy-lines tool**: Helps track what was copied from where
