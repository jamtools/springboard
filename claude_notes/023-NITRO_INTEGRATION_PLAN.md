# Nitro Integration Plan for Springboard

## Executive Summary

This document analyzes the `refactor-springboard-server` branch work and outlines the path forward for integrating Nitro with Springboard's Vite plugin to enable universal deployment (Node.js, Cloudflare Workers, Vercel, etc.).

**Key Goal**: Use Nitro as the universal build/deployment layer while preserving Springboard's platform abstraction and Hono-based architecture.

---

## Analysis of `refactor-springboard-server` Branch

### Repository Location
- Path: `/Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree`
- Branch: `refactor-springboard-server`
- Latest commit: `52f19fa - fix cf workers deployment by using 'party: my-server'`

### Key Architectural Changes

#### 1. Package Structure Separation

**Server Package** (`packages/springboard/server/`)
```
server/
├── package.json          # Platform-agnostic server package
├── index.ts              # Exports serverRegistry
└── src/
    ├── register.ts       # ServerModuleAPI definition
    ├── hono_app.ts       # Platform-agnostic Hono app initialization
    ├── services/         # Shared server services (RPC, etc.)
    └── types/            # Server type definitions
```

**Platform Packages** (`packages/springboard/platforms/`)
```
platforms/
├── node/
│   ├── package.json
│   ├── entrypoints/
│   │   └── node_entrypoint.ts     # Node.js-specific startup
│   └── services/
│       └── ws_server_core_dependencies.ts
├── cf-workers/
│   ├── package.json
│   ├── entrypoints/
│   │   ├── cf_worker_entrypoint.ts
│   │   └── wrangler.toml
│   └── src/
│       ├── hono_app.ts            # CF-specific Hono setup
│       └── services/
│           ├── kv_store.ts        # Uses Durable Objects storage
│           └── rpc_server.ts
├── webapp/
├── tauri/
├── react-native/
└── deno/
```

**Key Insight**: Server logic is separated from platform-specific runtime dependencies.

---

#### 2. ServerModuleAPI Evolution

**Before** (current branch):
```typescript
// packages/springboard/src/server/register.ts
export type ServerModuleAPI = {
    hono: Hono;
    hooks: ServerHooks;
    getEngine: () => Springboard;
}
```

**After** (refactor branch):
```typescript
// packages/springboard/server/src/register.ts
export type ServerModuleAPI = {
    hono: Hono;
    hooks: ServerHooks;
    getEngine: () => Springboard;
}

export type ServerModuleCallback = (server: ServerModuleAPI) => void;

export const serverRegistry: ServerModuleRegistry = {
    registerServerModule,
};
```

**With Nitro** (proposed):
```typescript
export type ServerModuleAPI = {
    hono: Hono;
    nitroApp?: H3App;              // NEW: Access to Nitro's H3 app
    hooks: ServerHooks;
    getEngine: () => Springboard;
}
```

---

#### 3. Platform Abstraction Pattern

**Node.js Entrypoint** (`platforms/node/entrypoints/node_entrypoint.ts`):
```typescript
// Platform-specific dependencies injection
const nodeKvDeps = await makeWebsocketServerCoreDependenciesWithSqlite();

// Call platform-agnostic init
const {app, serverAppDependencies, injectResources, createWebSocketHooks} = initApp({
    broadcastMessage: (message) => wsNode.publish('event', message),
    remoteKV: nodeKvDeps.kvStoreFromKysely,
    userAgentKV: new LocalJsonNodeKVStoreService('userAgent'),
});

// Platform-specific server startup
const server = serve({
    fetch: app.fetch,
    port: parseInt(port),
});

// Inject platform-specific resources
injectResources({
    engine,
    serveStaticFile: async (c, fileName, headers) => { /* Node fs.readFile */ },
    getEnvValue: name => process.env[name],
});
```

**Cloudflare Workers Entrypoint** (`platforms/cf-workers/entrypoints/cf_worker_entrypoint.ts`):
```typescript
export class MyServer extends Server {
    async onStart() {
        // CF-specific dependencies
        const roomAdapter = {
            storage: this.ctx.storage,        // Durable Objects storage
            broadcast: (message) => this.broadcast(message),
        };

        // Call platform-agnostic init
        const {app, serverAppDependencies, rpcService} = initApp({
            kvForHttp: this.makeKvStoreForHttp(),
            room: roomAdapter,
        });

        this.app = app;
    }

    async onRequest(req: Request) {
        // Route through Hono app
        return this.app.fetch(newReq);
    }
}
```

**Key Pattern**:
1. Platform-specific dependency injection
2. Platform-agnostic `initApp()` returns Hono app
3. Platform-specific runtime wraps the Hono app

---

#### 4. Dependency Injection Architecture

**Platform-Agnostic Init** (`server/src/hono_app.ts`):
```typescript
type InitServerAppArgs = {
    remoteKV: KVStore;
    userAgentKV: KVStore;
    broadcastMessage: (message: string) => void;
};

export const initApp = (initArgs: InitServerAppArgs): InitAppReturnValue => {
    const app = new Hono();
    // ... setup app with injected dependencies

    return {
        app,
        serverAppDependencies,
        injectResources,      // Callback for late resource injection
        createWebSocketHooks,
    };
};
```

**Late Resource Injection**:
```typescript
type InjectResourcesArgs = {
    engine: Springboard;
    serveStaticFile: (c: Context, fileName: string, headers: Record<string, string>) => Promise<Response>;
    getEnvValue: (name: string) => string | undefined;
};
```

**Why This Matters**: The `injectResources` callback allows the platform to provide runtime-specific implementations (Node.js file system, CF Durable Objects, etc.) after the app is initialized.

---

#### 5. Migration from PartyKit to Partyserver

**Commit**: `118e0c3 - remove partykit library`

**Change**: Switched from PartyKit to Partyserver (open-source alternative) for Cloudflare Workers WebSocket handling.

**Relevance to Nitro**: Demonstrates the need for platform-specific WebSocket adapters. Nitro provides WebSocket support, but it varies by preset:
- `node-server`: Full WebSocket support via crossws
- `cloudflare`: WebSocket support via Durable Objects
- `vercel`: Limited/no WebSocket support on some plans

---

## Key Learnings for Nitro Integration

### 1. **Nitro Should Replace Platform-Specific Entrypoints**

**Current State** (refactor branch):
```
User Code → Platform Entrypoint (node_entrypoint.ts) → initApp() → Hono App → serve()
```

**With Nitro**:
```
User Code → Nitro Plugin → initApp() → Hono App → Nitro Build → .output/
```

Nitro handles:
- Platform detection/selection (preset system)
- Bundling and optimization
- Static asset serving
- Runtime adapter injection

**Springboard Keeps**:
- Hono app initialization (`initApp()`)
- ServerModuleAPI registry
- Springboard engine lifecycle

---

### 2. **Resource Injection Must Become Nitro-Aware**

**Current Pattern**:
```typescript
injectResources({
    serveStaticFile: async (c, fileName) => {
        // Node.js: fs.readFile
        // CF Workers: fetch from R2 or static assets
    },
    getEnvValue: name => process.env[name],
});
```

**Nitro-Compatible Pattern**:
```typescript
injectResources({
    serveStaticFile: async (c, fileName) => {
        // Nitro provides unified asset serving
        return await useAsset(fileName);  // Nitro's asset helper
    },
    getEnvValue: name => useRuntimeConfig()[name],  // Nitro's config API
});
```

---

### 3. **WebSocket Handling Needs Platform Abstraction**

**Refactor Branch Approach**:
- Node.js: Uses `crossws` with `crosswsNode` adapter
- CF Workers: Uses Partyserver with Durable Objects

**Nitro Approach**:
- Nitro includes `crossws` support for WebSockets
- Different adapters per preset automatically
- Springboard should use Nitro's WebSocket hooks instead of platform-specific code

**Proposed**:
```typescript
// In Nitro plugin for Springboard
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('request', async (event) => {
        if (event.path === '/ws') {
            // Use Nitro's crossws integration
            return handleWebSocketUpgrade(event);
        }
    });
});
```

---

### 4. **Package Dependencies Should Be Peer-Based**

**Refactor Branch Pattern**:
```json
// packages/springboard/server/package.json
{
  "peerDependencies": {
    "hono": "catalog:",
    "springboard": "workspace:*"
  }
}

// packages/springboard/platforms/node/package.json
{
  "peerDependencies": {
    "@springboardjs/data-storage": "workspace:*",
    "springboard": "workspace:*",
    "springboard-server": "workspace:*"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.2",
    "crossws": "catalog:"
  }
}
```

**With Nitro**:
```json
// packages/springboard/vite-plugin/package.json
{
  "dependencies": {
    "hono": "^4.x",
    "nitro": "^3.x"
  },
  "peerDependencies": {
    "vite": "^5.x"
  }
}
```

Platform-specific packages become **internal implementation details** that Nitro manages via presets.

---

## Files/Directories to Copy

### Priority 1: Core Server Abstraction

#### Copy Entire Directory
```bash
# Server package (platform-agnostic)
cp -r /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server \
      phone2daw-jamtools-worktree/packages/springboard/server
```

**Why**: This is the foundation of the platform abstraction. Contains:
- `register.ts` - ServerModuleAPI definition
- `hono_app.ts` - Platform-agnostic Hono initialization
- Shared services (RPC, WebSocket hooks)

#### Using copy-lines for Specific Changes

**Copy ServerModuleAPI Definition**:
```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts:1-37 \
  --to phone2daw-jamtools-worktree/packages/springboard/src/server/register.ts:1
```

**Copy initApp signature** (to understand the abstraction):
```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/hono_app.ts:18-36 \
  --to phone2daw-jamtools-worktree/packages/springboard/src/server/hono_app.ts:1
```

---

### Priority 2: Node Platform Reference

**Copy Node Entrypoint** (as reference for Nitro template):
```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts:1-100 \
  --to phone2daw-jamtools-worktree/packages/springboard/vite-plugin/src/templates/nitro-node-reference.ts:1
```

**Why**: This shows how to inject Node.js-specific dependencies. We'll adapt this pattern for Nitro.

---

### Priority 3: CF Workers Reference (for multi-platform understanding)

**Copy CF Workers Entrypoint**:
```bash
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/cf-workers/entrypoints/cf_worker_entrypoint.ts:1-116 \
  --to phone2daw-jamtools-worktree/packages/springboard/vite-plugin/src/templates/nitro-cf-reference.ts:1
```

**Why**: Shows how the same `initApp()` works with CF Workers. Helps validate that our Nitro integration maintains platform neutrality.

---

## Next Steps: Implementation Roadmap

### Phase 1: Setup Nitro in Vite Plugin (Week 1)

#### 1.1 Add Nitro Dependencies
```bash
cd phone2daw-jamtools-worktree/packages/springboard/vite-plugin
pnpm add nitro@^3.x
pnpm add -D @types/node
```

#### 1.2 Create Nitro Config Template
**File**: `packages/springboard/vite-plugin/src/templates/nitro.config.template.ts`

```typescript
import { defineConfig } from 'nitro';

export default defineConfig({
  preset: process.env.NITRO_PRESET || 'node-server',

  // Springboard-specific config
  serverDir: './.springboard',

  output: {
    dir: '.output',
    serverDir: '.output/server',
    publicDir: '.output/public'
  },

  // Runtime config (accessible via useRuntimeConfig())
  runtimeConfig: {
    springboard: {
      port: process.env.PORT || 3001,
      webappFolder: process.env.WEBAPP_FOLDER || './dist',
    }
  },

  // Allow user overrides via vite.config.ts
  ...(__USER_NITRO_CONFIG__ || {})
});
```

#### 1.3 Update Springboard Plugin Config
**File**: `packages/springboard/vite-plugin/src/index.ts`

Add to plugin options:
```typescript
export interface SpringboardVitePluginOptions {
  entry: string;
  nodeServerPort?: number;
  buildTarget?: 'standalone' | 'nitro';  // NEW
  nitroConfig?: NitroConfig;             // NEW: User overrides
}
```

#### 1.4 Modify Plugin to Generate Nitro-Compatible Entry
**File**: `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`

Change from:
```typescript
export async function start() {
  const server = serve({ fetch: app.fetch, port });
  // ...
}
start();  // Auto-execute
```

To:
```typescript
// Export Hono app for Nitro to wrap
export default app;
```

**Alternatively** (if Nitro needs event handler format):
```typescript
import { defineEventHandler } from 'nitro';
import { initApp } from 'springboard/server';

const { app } = initApp(coreDeps);

export default defineEventHandler(async (event) => {
  return app.fetch(event.node.req);
});
```

---

### Phase 2: Copy Server Abstraction from Refactor Branch (Week 1-2)

#### 2.1 Copy Server Package Structure
```bash
# Create server directory structure
mkdir -p phone2daw-jamtools-worktree/packages/springboard/server/src/{services,types}

# Copy files
copy-lines \
  --from /Users/mickmister/.../refactor-springboard-jamtools-worktree/packages/springboard/server/package.json:1-30 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/package.json:1

copy-lines \
  --from /Users/mickmister/.../refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts:1-37 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/src/register.ts:1

# Copy entire hono_app.ts (it's large)
cp /Users/mickmister/.../refactor-springboard-jamtools-worktree/packages/springboard/server/src/hono_app.ts \
   phone2daw-jamtools-worktree/packages/springboard/server/src/hono_app.ts
```

#### 2.2 Update ServerModuleAPI with Nitro Support
**File**: `packages/springboard/server/src/register.ts`

```typescript
export type ServerModuleAPI = {
    hono: Hono;
    nitroApp?: H3App;              // NEW
    hooks: ServerHooks;
    getEngine: () => Springboard;
}
```

#### 2.3 Create Nitro-Aware Resource Injector
**File**: `packages/springboard/server/src/nitro_resources.ts`

```typescript
import { useAsset, useRuntimeConfig } from 'nitro';

export const createNitroResourceInjector = () => ({
    serveStaticFile: async (c, fileName, headers) => {
        // Use Nitro's unified asset serving
        const asset = await useAsset(fileName);
        // Apply headers and return
    },
    getEnvValue: (name) => {
        const config = useRuntimeConfig();
        return config.springboard[name] || process.env[name];
    },
});
```

---

### Phase 3: Integrate Nitro Build Process (Week 2)

#### 3.1 Add Nitro Plugin to Vite Config
**File**: `packages/springboard/vite-plugin/src/index.ts`

```typescript
import { nitro } from 'nitro/vite';

export const springboard = (options: SpringboardVitePluginOptions): Plugin[] => {
  const plugins: Plugin[] = [
    // Existing Springboard plugin
    springboardCore(options),
  ];

  // Add Nitro if buildTarget is 'nitro'
  if (options.buildTarget === 'nitro') {
    plugins.push(
      nitro({
        preset: process.env.NITRO_PRESET,
        ...options.nitroConfig,
      })
    );
  }

  return plugins;
};
```

#### 3.2 Generate Nitro Config File
In the plugin's `buildStart` hook:

```typescript
buildStart() {
  if (this.buildTarget === 'nitro') {
    const nitroConfigPath = path.join(projectRoot, 'nitro.config.ts');

    // Only generate if it doesn't exist
    if (!fs.existsSync(nitroConfigPath)) {
      const nitroConfigContent = generateNitroConfig(options);
      fs.writeFileSync(nitroConfigPath, nitroConfigContent);
    }
  }
}
```

#### 3.3 Update Build Scripts
**File**: `apps/vite-test/package.json`

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "node .output/server/index.mjs",
    "build:cf": "NITRO_PRESET=cloudflare vite build",
    "build:vercel": "NITRO_PRESET=vercel vite build"
  }
}
```

---

### Phase 4: Handle WebSockets with Nitro (Week 3)

#### 4.1 Create Nitro WebSocket Plugin
**File**: `packages/springboard/vite-plugin/src/templates/nitro-websocket-plugin.ts`

```typescript
import { defineNitroPlugin } from 'nitro';
import { createCommonWebSocketHooks } from 'springboard-server/services/crossws_json_rpc';

export default defineNitroPlugin((nitroApp) => {
  const useWebSocketsForRpc = process.env.USE_WEBSOCKETS_FOR_RPC === 'true';

  const wsHooks = createCommonWebSocketHooks(useWebSocketsForRpc);

  // Register WebSocket upgrade handler
  nitroApp.hooks.hook('request', async (event) => {
    if (event.path === '/ws') {
      return wsHooks.upgrade(event);
    }
  });
});
```

#### 4.2 Copy WebSocket Services
```bash
# Copy crossws integration
cp -r /Users/mickmister/.../refactor-springboard-jamtools-worktree/packages/springboard/server/src/services \
      phone2daw-jamtools-worktree/packages/springboard/server/src/services
```

---

### Phase 5: Testing & Validation (Week 3-4)

#### 5.1 Test Node.js Preset
```bash
cd apps/vite-test
pnpm build
node .output/server/index.mjs
# Verify: http://localhost:3001 works
```

#### 5.2 Test Cloudflare Workers Preset
```bash
NITRO_PRESET=cloudflare pnpm build
cd .output
npx wrangler dev
# Verify: Worker runs locally
```

#### 5.3 Test Vercel Preset
```bash
NITRO_PRESET=vercel pnpm build
vercel dev
# Verify: Serverless functions work
```

#### 5.4 Validate WebSocket Support
- Test WS connections on Node.js preset
- Test WS with CF Durable Objects
- Document limitations per preset

---

### Phase 6: Documentation & Developer Experience (Week 4)

#### 6.1 Update vite-test Example
```typescript
// apps/vite-test/vite.config.ts
import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';

export default defineConfig({
  plugins: [
    springboard({
      entry: './src/tic_tac_toe.tsx',
      buildTarget: 'nitro',  // Enable Nitro
      nitroConfig: {
        preset: process.env.NITRO_PRESET || 'node-server',
      }
    })
  ]
});
```

#### 6.2 Create Migration Guide
**File**: `docs/NITRO_MIGRATION.md`

Topics:
- Why Nitro? (multi-platform deployment)
- Breaking changes from standalone builds
- How to customize presets
- Platform-specific considerations (WebSockets, file system, etc.)
- Environment variable configuration

#### 6.3 Update Plugin README
Document:
- `buildTarget: 'nitro'` option
- `nitroConfig` options
- Environment variable overrides (`NITRO_PRESET`, etc.)
- Preset-specific features/limitations

---

## Configuration Examples

### Simple Node.js Only
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    springboard({
      entry: './src/app.tsx',
      buildTarget: 'nitro',  // That's it!
    })
  ]
});
```

### Multi-Platform with Preset Override
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    springboard({
      entry: './src/app.tsx',
      buildTarget: 'nitro',
      nitroConfig: {
        preset: process.env.NITRO_PRESET || 'node-server',
        // Runtime config accessible via useRuntimeConfig()
        runtimeConfig: {
          database: {
            url: process.env.DATABASE_URL
          }
        }
      }
    })
  ]
});
```

### Advanced: Separate Nitro Config File
```typescript
// nitro.config.ts
import { defineConfig } from 'nitro';

export default defineConfig({
  preset: process.env.NITRO_PRESET || 'node-server',

  serverDir: './.springboard',

  // Cloudflare-specific
  cloudflare: {
    wrangler: {
      compatibility_date: '2025-01-01',
      compatibility_flags: ['nodejs_compat'],
    }
  },

  // Vercel-specific
  vercel: {
    regions: ['sfo1', 'iad1'],
  },

  rollupConfig: {
    // Custom Rollup config for advanced users
  }
});
```

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    springboard({
      entry: './src/app.tsx',
      buildTarget: 'nitro',
      // Will read from nitro.config.ts
    })
  ]
});
```

---

## Platform Support Matrix

| Platform | Preset | WebSockets | File System | Notes |
|----------|--------|-----------|-------------|-------|
| Node.js | `node-server` | ✅ Full (crossws) | ✅ Full | Default, production-ready |
| Cloudflare Workers | `cloudflare` | ✅ Durable Objects | ❌ No FS (use R2/KV) | Need Durable Objects for WS |
| Cloudflare Pages | `cloudflare-pages` | ⚠️ Limited | ❌ No FS | Static + Functions |
| Vercel | `vercel` | ❌ No (serverless) | ❌ No FS | Use `/tmp` for ephemeral files |
| AWS Lambda | `aws-lambda` | ❌ No | ⚠️ `/tmp` only | Ephemeral storage |
| Netlify | `netlify` | ❌ No | ❌ No FS | Serverless functions |
| Deno Deploy | `deno-deploy` | ✅ Full | ⚠️ Limited | Deno APIs only |

**Key Takeaway**: Springboard must handle platform limitations gracefully:
- Detect preset at runtime
- Provide fallbacks (e.g., in-memory KV if no Durable Objects)
- Document feature availability per platform

---

## Risk Assessment

### High Risk ⚠️

1. **WebSocket Support Variance**
   - Each preset handles WS differently
   - CF Workers need Durable Objects setup
   - Vercel/Lambda don't support persistent connections
   - **Mitigation**: Provide adapter pattern, document clearly

2. **Breaking Changes for Users**
   - Current standalone build → Nitro output structure changes
   - New dependency (`nitro`) required
   - **Mitigation**: Maintain `buildTarget: 'standalone'` as option during transition

3. **Bundle Size Overhead**
   - Nitro adds ~500KB to output
   - **Mitigation**: Tree-shaking, preset-specific optimizations

### Medium Risk ⚙️

4. **Learning Curve**
   - Developers need to understand presets
   - Nitro-specific quirks (H3 event handlers, etc.)
   - **Mitigation**: Comprehensive docs, examples per preset

5. **Refactor Branch Merge Conflicts**
   - Diverged from main significantly
   - **Mitigation**: Cherry-pick specific files using `copy-lines` tool

### Low Risk ✅

6. **Hono Compatibility**
   - Nitro works well with Hono
   - Proven in examples (e.g., `_debug/nitro/examples/hono/`)

---

## Success Metrics

1. **Developer Experience**
   - Single command deploys to any platform: `NITRO_PRESET=cloudflare pnpm build`
   - Zero config for Node.js deployments
   - Clear error messages when platform features unavailable

2. **Performance**
   - Production builds <10s
   - Cold start <500ms on serverless platforms
   - Zero performance regression vs standalone builds

3. **Compatibility**
   - All existing Springboard features work on Node.js preset
   - 80% of features work on CF Workers/Vercel
   - Clear documentation of platform limitations

4. **Migration Path**
   - Existing apps can migrate in <30 minutes
   - No code changes required for basic apps
   - Opt-in via `buildTarget: 'nitro'` flag

---

## Open Questions

1. **How to handle Springboard's SQLite dependency on serverless platforms?**
   - Option A: Use platform KV stores (CF KV, Vercel KV)
   - Option B: External database (Postgres via connection pooler)
   - Option C: In-memory fallback (loses state between requests)

2. **Should we maintain the `platforms/` packages structure?**
   - Pro: Clear separation of platform logic
   - Con: Nitro already provides this abstraction
   - **Recommendation**: Keep for platform-specific services (KV adapters, etc.)

3. **How to handle user-uploaded files?**
   - Node: File system (as is)
   - CF: R2 storage
   - Vercel: S3/Blob storage
   - **Recommendation**: Provide storage adapter API

4. **Preset auto-detection in CI/CD**
   - Nitro can auto-detect hosting platform
   - Should Springboard override or trust Nitro?
   - **Recommendation**: Trust Nitro's detection, allow override via env var

---

## Copy-Lines Command Reference

### Copy Entire Server Package
```bash
# Package.json
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/package.json:1-30 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/package.json:1

# Register.ts
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/register.ts:1-37 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/src/register.ts:1

# Index.ts
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/index.ts:1-4 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/index.ts:1
```

### Copy Platform References
```bash
# Node entrypoint (reference only)
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts:1-100 \
  --to phone2daw-jamtools-worktree/docs/reference/nitro-node-entrypoint-reference.ts:1

# CF Workers entrypoint (reference only)
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/cf-workers/entrypoints/cf_worker_entrypoint.ts:1-116 \
  --to phone2daw-jamtools-worktree/docs/reference/nitro-cf-entrypoint-reference.ts:1
```

### Copy Specific Patterns
```bash
# Copy initApp signature
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/server/src/hono_app.ts:18-36 \
  --to phone2daw-jamtools-worktree/packages/springboard/server/src/hono_app.ts:1

# Copy resource injection pattern
copy-lines \
  --from /Users/mickmister/code/jamtools-worktrees/refactor-springboard-jamtools-worktree/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts:69-92 \
  --to phone2daw-jamtools-worktree/packages/springboard/vite-plugin/src/templates/nitro-resource-injection-example.ts:1
```

---

## Recommended Reading Order for Implementation

1. **This document** - Overall strategy
2. **Refactor branch files**:
   - `/packages/springboard/server/src/register.ts` - API definition
   - `/packages/springboard/server/src/hono_app.ts` - Platform abstraction
   - `/packages/springboard/platforms/node/entrypoints/node_entrypoint.ts` - Node.js example
   - `/packages/springboard/platforms/cf-workers/entrypoints/cf_worker_entrypoint.ts` - CF Workers example
3. **Nitro docs**:
   - https://nitro.build/config - Configuration
   - https://nitro.build/deploy - Deployment presets
   - https://nitro.build/guide - Getting started
4. **This repo's Nitro examples**:
   - `/phone2daw-jamtools-worktree/_debug/nitro/examples/hono/` - Hono + Nitro integration

---

## Timeline Estimate

- **Week 1**: Setup Nitro plugin, copy server abstraction
- **Week 2**: Integrate Nitro build, test Node.js preset
- **Week 3**: WebSocket support, CF Workers testing
- **Week 4**: Documentation, migration guide, final testing

**Total**: ~4 weeks to MVP (Node.js + CF Workers presets working)

Additional presets (Vercel, AWS, etc.) can be added incrementally after MVP.
