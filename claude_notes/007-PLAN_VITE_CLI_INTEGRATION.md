# Vite CLI Integration Strategy for Springboard

## Executive Summary

Springboard's current build system uses esbuild with a custom CLI wrapper that manages platform-specific builds (browser, node, PartyKit, desktop, etc.). Migrating to Vite requires careful architectural decisions to maintain developer experience while leveraging Vite's strengths in HMR, plugin ecosystem, and modern tooling.

This document outlines the current system, analyzes 5 architectural options, and recommends an optimal migration path.

---

## Part 1: Current System Analysis

### 1.1 CLI Commands Overview

Springboard CLI exposes three main commands:

```typescript
sb dev <entrypoint>           // Development mode with watch and HMR
sb build <entrypoint>         // Production build
sb start                       // Start the pre-built server
```

### 1.2 Platform Flag Architecture

The `--platforms` flag controls which builds to execute:

```bash
sb build src/index.tsx --platforms browser,node          # Build browser + node
sb build src/index.tsx --platforms all                   # Build all platforms
sb build src/index.tsx --platforms partykit              # Build only PartyKit
```

**Supported Platforms:**
- `main` - Default: browser + node + server
- `browser` - Online browser build
- `browser_offline` - Offline-capable browser build
- `node` - Node.js/Maestro runtime
- `desktop` - Tauri desktop app (webview + maestro)
- `partykit` - Edge deployment (server + browser)
- `mobile` - React Native (partially implemented)

### 1.3 Build Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    sb build/dev src/index.tsx                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
   │ Browser  │      │    Node      │     │  PartyKit   │
   │ Platform │      │   Platform   │     │  Platform   │
   └────┬─────┘      └──────┬───────┘     └──────┬──────┘
        │                    │                    │
   ┌────▼──────────────────────────────────────────┴──────┐
   │  Platform Entry Point Injection (@platform macro)    │
   └────┬──────────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────┐
   │  esbuild with Custom Plugins:             │
   │  • esbuildPluginLogBuildTime              │
   │  • esbuildPluginPlatformInject            │
   │  • esbuildPluginHtmlGenerate              │
   │  • esbuildPluginPartykitConfig            │
   │  • esbuildPluginTransformAwaitImportToRequire │
   └────┬──────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────┐
   │  Output Structure:                           │
   │  dist/                                       │
   │  ├── server/dist/local-server.cjs           │
   │  ├── browser/dist/index.{js,css,html}       │
   │  ├── node/dist/index.js                     │
   │  ├── browser_offline/dist/...               │
   │  ├── tauri/                                 │
   │  │   ├── browser/dist/...                   │
   │  │   └── node/dist/...                      │
   │  └── partykit/                              │
   │      ├── browser/dist/...                   │
   │      └── neutral/dist/...                   │
   └────────────────────────────────────────────┘
```

### 1.4 Key esbuild Plugins & Their Functions

#### esbuildPluginPlatformInject
- **Purpose:** Handles platform-specific code branches using `// @platform` comments
- **Pattern:** Strips out code for non-target platforms
- **Supported targets:** browser, node, fetch (neutral), react-native
- **Critical:** This pattern allows shared TypeScript files with platform-specific implementations

Example:
```typescript
// @platform "browser"
  export function getStorage() {
    return localStorage;
  }
// @platform end

// @platform "node"
  export function getStorage() {
    return nodeFsBasedStorage();
  }
// @platform end
```

#### esbuildPluginHtmlGenerate
- **Purpose:** Generates `index.html` by injecting script/link tags
- **Behavior:** Reads template HTML, finds output bundles, injects them into `<head>` and `<body>`
- **Meta support:** Injects documentMeta (title, og tags, CSP headers, etc.)

#### esbuildPluginPartykitConfig
- **Purpose:** Generates `partykit.json` config after build completes
- **Behavior:** Finds output JS file and creates PartyKit configuration

#### esbuildPluginTransformAwaitImportToRequire
- **Purpose:** Transforms dynamic imports for Tauri's Maestro (Node backend)
- **Pattern:** Converts `await import()` to `require()` for CJS compatibility

### 1.5 Plugin System

Springboard supports custom plugins through a plugin interface:

```typescript
type Plugin = (buildConfig: BuildConfig) => PluginConfig;

type PluginConfig = {
  editBuildOptions?: (options: EsbuildOptions) => void;
  esbuildPlugins?: (args: {
    outDir: string;
    nodeModulesParentDir: string;
    documentMeta?: DocumentMeta;
  }) => EsbuildPlugin[];
  externals?: () => string[];
  name?: string;
  additionalFiles?: Record<string, string>;
};
```

Plugins can:
- Hook into esbuild options
- Provide custom esbuild plugins
- Define external dependencies
- Add additional files to output

### 1.6 Development Mode Features

Current `sb dev` behavior:
- Watches all platforms in parallel
- Runs `esbuild.context().watch()` for each platform
- Optionally serves via `esbuild.serve()` if `dev.reloadCss` or `dev.reloadJs` is enabled
- Spawns node server via `concurrently` to watch server changes
- **No built-in HMR** - relies on file refresh watching

### 1.7 Current Limitations

1. **No true HMR** - Only file watching, no hot module replacement
2. **Sequential builds** - Each platform builds independently; no parallelization
3. **esbuild serves** - Not a full dev server ecosystem (no Vite plugins)
4. **Plugin system** - Custom plugins tightly coupled to esbuild API
5. **Configuration** - Platform-specific logic hardcoded in CLI
6. **Multi-process complexity** - Server and client builds are separate, hard to coordinate

---

## Part 2: Vite Integration Patterns & Research

### 2.1 Vite Capabilities Relevant to Springboard

#### Strengths:
- **Native ESM in dev** - Faster dev server via native ES modules
- **Lightning-fast HMR** - File-level hot module replacement
- **Rich plugin ecosystem** - React, Vue, Svelte, and custom plugins
- **Pre-configured dev server** - Handles dev HTTP, proxy, CORS, etc.
- **SSR-ready** - Built-in SSR support with separate environments
- **Modern build output** - ES2015+, smaller bundles with tree-shaking

#### Limitations for Springboard:
- **Single platform focus** - Designed for one frontend + one backend
- **ESM-first dev** - Node platforms need CommonJS or conditional handling
- **Environments API** - Experimental; may change in future Vite versions
- **Plugin system** - Different from esbuild, requires learning new patterns

### 2.2 Vite Environments API (Experimental)

Vite 5.1+ offers experimental "Environments" API for multi-target builds:

```typescript
// vite.config.ts
export default defineConfig({
  environments: {
    ssr: {
      resolve: { conditions: ['node'] },
      ssr: true,
      build: { outDir: 'dist/ssr' }
    },
    client: {
      build: { outDir: 'dist/client' }
    }
  }
});
```

**Status:** Experimental, API not finalized, subject to breaking changes.

**Use cases:** SSR + client or multiple entry points with different configs.

### 2.3 Framework Comparison: How Nuxt, Astro, Remix Use Vite

#### Nuxt 3
- **Approach:** Wraps Vite with unified config API
- **CLI:** `nuxi dev`, `nuxi build` - Hides Vite CLI
- **Multi-target:** Auto-generates separate configs for server/client
- **HMR:** Built-in, handles SSR invalidation
- **Plugin system:** Via `addPlugin()`, abstracted from Vite
- **Lesson:** Powerful abstraction layer is helpful for complex multi-target scenarios

#### Astro 4
- **Approach:** Uses Vite internally, exposes `astro dev`, `astro build`
- **Multi-target:** Handles multiple pages/routes seamlessly
- **Unique:** Each page is a separate entry point, intelligently bundled
- **Lesson:** Can hide Vite complexity while maintaining flexibility

#### SvelteKit
- **Approach:** Vite wrapper with custom CLI
- **Env separation:** Separate `config.kit.{ adapter, files }` 
- **Lesson:** Clear separation of concerns (adapter = platform)

#### Remix
- **Approach:** Building own dev server using Vite (future v3)
- **Multi-target:** Server + client bundles from single config
- **Lesson:** Can spawn multiple Vite instances with different configs

#### Astro File-based Routing
- **Pattern:** `src/pages/` → `/{page}.html`; `src/api/` → API endpoints
- **Lesson:** Framework doesn't always need explicit entry points

### 2.4 Multi-Target Build Patterns in Wild

**Pattern 1: Separate Vite Instances**
```typescript
// Multiple vite instances for different targets
const clientVite = await vite.build(clientConfig);
const serverVite = await vite.build(serverConfig);
```
Used by: Remix, Next.js (mostly), SvelteKit
Pros: Full control, clear separation
Cons: Duplicated config, harder to share dependencies

**Pattern 2: Environments API**
```typescript
// Single config, multiple environments
// vite.config.ts with environments: { ssr, client, ... }
```
Used by: Experimental Vite features, emerging pattern
Pros: Single config, unified
Cons: Immature API, may change

**Pattern 3: Monolithic CLI Wrapper**
```typescript
// Single CLI command, handles multiple builds internally
// sb build → orchestrates N Vite instances + post-processing
```
Used by: Nuxt, Astro
Pros: Simple UX, flexible internals
Cons: More code to maintain

**Pattern 4: Expose Vite Directly**
```bash
vite build         # Uses vite.config.ts directly
vite dev           # Dev server for specific target
```
Used by: VitePress, Simple projects
Pros: Zero overhead, standard tooling
Cons: Requires manual platform switching

### 2.5 Server Process Management

**Current state:** Server (`local-server.cjs`) spawned separately via `concurrently`

**Vite patterns:**
1. **Vite middleware approach:** Dev server as middleware (Nuxt, SvelteKit)
2. **Separate process:** Server builds separately, CLI spawns (Remix, Astro)
3. **Single process:** Dev server handles both (less common for full-stack)

---

## Part 3: Platform-Specific Vite Considerations

### 3.1 Browser Platform (Primary Use Case)

**Current esbuild approach:**
- Single `platformBrowserBuildConfig` entry
- Injects HTML with script/link tags via plugin
- Supports documentMeta injection

**Vite approach:**
- Native HTML entry point (`index.html`)
- Automatic script tag injection
- Works out-of-the-box with plugin system
- HMR built-in

**Migration complexity:** Low - Vite handles this natively.

### 3.2 Node Platform

**Current esbuild approach:**
- CommonJS output (CJS)
- Separate entry point
- Externals defined (better-sqlite3, midi, etc.)

**Vite approach:**
- ESM native, CJS requires configuration
- SSR mode available
- Middleware pattern for dev

**Challenges:**
- Node platform expects `.cjs` but Vite outputs `.mjs` or `.js`
- Need to force CommonJS output for backwards compatibility
- `DISABLE_IO` environment variables not standard Vite pattern

**Migration complexity:** Medium - Needs output config tuning.

### 3.3 PartyKit Platform

**Current approach:**
- Separate server build (`platformPartykitServerBuildConfig`)
- Separate browser build (`platformPartykitBrowserBuildConfig`)
- `partykit.json` auto-generated post-build

**Vite approach:**
- Could use Environments API for server + client split
- PartyKit has Vite plugin: `@partykit/vite`
- Vite builds server as function, client as browser bundle

**Challenges:**
- Requires PartyKit Vite plugin
- Automatic config generation may not work
- Need plugin to emit `partykit.json`

**Migration complexity:** High - Requires new plugin and workflow changes.

### 3.4 Tauri Platform

**Current approach:**
- Browser webview build (`platformTauriWebviewBuildConfig`)
- Node maestro build (`platformTauriMaestroBuildConfig`)
- Post-build file copying to `apps/desktop_*`
- `await import()` → `require()` transformation

**Vite approach:**
- Vite for webview (native HTML support)
- Node for maestro (CJS needed)
- Hook into Tauri CLI or post-build process

**Challenges:**
- Multiple targets from single app
- Tauri has its own build system, Vite is supplementary
- File copying post-build needs Vite plugin

**Migration complexity:** High - Requires custom post-build plugin.

---

## Part 4: Architectural Options

### Option A: Environments API (If Stable)

**What it is:** Use Vite's experimental `environments` to define multiple build targets.

**Configuration:**
```typescript
// vite.config.ts
export default defineConfig({
  environments: {
    // Browser
    'client': {
      outDir: 'dist/browser/dist',
      root: process.cwd(),
      build: { outDir: 'dist/browser/dist' }
    },
    // Node
    'node': {
      resolve: { conditions: ['node'] },
      ssr: true,
      outDir: 'dist/node/dist',
      build: { outDir: 'dist/node/dist' }
    },
    // PartyKit server
    'partykit-server': {
      resolve: { conditions: ['node'] },
      ssr: true,
      outDir: 'dist/partykit/neutral/dist'
    }
  },
  plugins: [
    react(),
    vitePluginPlatformInject(),
    vitePluginHtmlGenerate(),
  ]
});
```

**CLI:**
```bash
sb build src/index.tsx --platform browser       # Build specific environment
sb build src/index.tsx --platforms all          # Build all environments
```

**Internally:**
```typescript
// Each platform gets own environment
const clientEnv = await vite.build(
  vite.mergeConfig(baseConfig, { environment: 'client' })
);
const nodeEnv = await vite.build(
  vite.mergeConfig(baseConfig, { environment: 'node' })
);
```

**Pros:**
- Single vite.config.ts
- Shared plugins and dependencies across targets
- Future-proof if Environments stabilizes
- Simplest conceptually

**Cons:**
- Environments API is experimental (Vite 5.1+)
- May change in future Vite versions
- Limited control per environment
- Not widely adopted yet
- Breaking changes possible

**Developer Experience:**
```
✓ One config file
✓ `sb dev` and `sb build` work as expected
✗ Limited transparency into environment behavior
```

**Technical Feasibility:** Medium (depends on Vite stability)

**Recommended If:** You're willing to track experimental Vite APIs and update CLI as needed.

---

### Option B: Separate Vite Instances (Explicit)

**What it is:** Orchestrate multiple independent Vite builds from CLI, each with its own config.

**Configuration:**

```typescript
// vite.config.browser.ts
export default defineConfig({
  build: {
    outDir: 'dist/browser/dist',
    lib: { entry: 'dynamic-entry.js', formats: ['es'] }
  },
  plugins: [
    react(),
    vitePluginPlatformInject('browser'),
    vitePluginHtmlGenerate()
  ]
});

// vite.config.node.ts
export default defineConfig({
  ssr: { target: 'node' },
  build: { 
    outDir: 'dist/node/dist',
    lib: { entry: 'dynamic-entry.js', formats: ['cjs'] }
  },
  plugins: [
    vitePluginPlatformInject('node')
  ]
});
```

**CLI:**
```bash
sb build src/index.tsx --platforms browser,node
```

**Internally:**
```typescript
async function buildPlatforms(platforms: string[], entrypoint: string) {
  for (const platform of platforms) {
    const config = loadConfigForPlatform(platform);
    await vite.build(
      mergeConfig(config, {
        define: { APPLICATION_ENTRYPOINT: entrypoint }
      })
    );
  }
}
```

**Pros:**
- Explicit, easy to understand
- No dependency on experimental APIs
- Full control per platform
- Works with stable Vite versions
- Easier debugging (separate build per config)

**Cons:**
- Multiple config files (vite.config.browser.ts, vite.config.node.ts, etc.)
- Duplicated config across files
- No automatic environment sharing
- Plugin system needs wrapping for Vite API

**Developer Experience:**
```
✓ Clear separation of concerns
✓ Familiar Vite workflow (can run `vite build --config vite.config.browser.ts`)
✗ More files to manage
✗ Config duplication
```

**Technical Feasibility:** High (stable, proven pattern)

**Recommended If:** You want maximum stability and clarity.

---

### Option C: Single Config with Conditional Logic

**What it is:** One vite.config.ts that switches behavior based on environment variable or command-line flag.

**Configuration:**

```typescript
// vite.config.ts
const platform = process.env.VITE_PLATFORM || 'browser';

const platformConfigs = {
  browser: {
    build: { outDir: 'dist/browser/dist' },
    plugins: [vitePluginHtmlGenerate()]
  },
  node: {
    ssr: { target: 'node' },
    build: { outDir: 'dist/node/dist', lib: { formats: ['cjs'] } }
  },
  partykit: {
    build: { outDir: 'dist/partykit/neutral/dist' }
  }
};

export default defineConfig(
  mergeConfig({
    plugins: [
      react(),
      vitePluginPlatformInject(platform),
    ],
    define: {
      CURRENT_PLATFORM: platform
    }
  }, platformConfigs[platform])
);
```

**CLI:**
```bash
VITE_PLATFORM=browser vite build
VITE_PLATFORM=node vite build
```

**Wrapper CLI:**
```typescript
async function buildPlatforms(platforms: string[]) {
  for (const platform of platforms) {
    process.env.VITE_PLATFORM = platform;
    await vite.build({ configFile: 'vite.config.ts' });
  }
}
```

**Pros:**
- Single config file (simpler to manage)
- Conditional logic is straightforward
- Reduced duplication
- Easy to share config defaults

**Cons:**
- Config file contains all platform logic (harder to read)
- Environment variable coupling
- Less explicit about platform differences
- Can become unmaintainable with many platforms

**Developer Experience:**
```
✓ Single config file
✓ Easy to add new platforms
✗ Config logic can get complex
✗ Harder to run individual platform manually
```

**Technical Feasibility:** High (standard Vite pattern)

**Recommended If:** You have few platforms and want to minimize files.

---

### Option D: Monolithic CLI Wrapper (Nuxt-style)

**What it is:** Hide Vite entirely behind a custom CLI. `sb dev/build` handles all complexity, spawning Vite internally.

**CLI User Experience:**
```bash
sb dev src/index.tsx                    # Starts dev server (browser + server HMR)
sb build src/index.tsx                  # Builds all platforms
sb build src/index.tsx --platforms node # Builds only node
```

**Implementation:**

```typescript
// cli.ts
async function dev(entrypoint: string, options) {
  const buildConfigs = resolvePlatformConfigs(options.platforms);
  
  // Start Vite dev server for browser platform
  const viteServer = await createViteServer({
    config: buildConfigs.browser,
    server: { middlewareMode: true }
  });
  
  // Start Node server for backend
  const nodeServer = createNodeDevServer(buildConfigs.node);
  
  // Coordinate HMR between them
  coordinateHMR(viteServer, nodeServer);
  
  // Start HTTP server
  const app = express();
  app.use(viteServer.middlewares);
  app.listen(5173);
}

async function build(entrypoint: string, options) {
  // Sequential or parallel builds
  const builds = options.platforms.map(p => 
    vite.build(resolvePlatformConfig(p))
  );
  await Promise.all(builds);
}
```

**Config Generation:**
```typescript
function resolvePlatformConfig(platform: string): ViteConfig {
  const baseConfig = {
    plugins: [
      react(),
      vitePluginPlatformInject(platform),
      vitePluginPostBuildHooks(platform)
    ]
  };
  
  return mergeConfig(baseConfig, getPlatformDefaults(platform));
}
```

**Pros:**
- Maximum abstraction (hide Vite complexity)
- Simplified UX (familiar `sb` commands)
- Easy to add cross-cutting concerns (HMR coordination, post-build, etc.)
- Full control over build orchestration
- Plugin system can wrap Vite plugins elegantly

**Cons:**
- More CLI code to maintain
- Can't use standard `vite` command easily
- Harder for users to debug Vite issues
- Opinionated (less flexibility for advanced users)

**Developer Experience:**
```
✓ Simple, familiar commands
✓ Coordinated HMR across platforms
✓ Can add opinionated features (auto-restart server, etc.)
✗ Can't debug with standard Vite tools
✗ Larger maintenance burden
```

**Technical Feasibility:** High (proven by Nuxt, Astro)

**Recommended If:** You prioritize developer experience and are willing to maintain more CLI code.

---

### Option E: Vite-First with Optional CLI

**What it is:** Embrace Vite directly, minimal wrapper. Users can run `vite` commands directly or use `sb` for convenience.

**User Options:**

```bash
# Standard Vite (works directly)
vite build
vite dev
vite preview

# Or use CLI wrapper for convenience
sb build src/index.tsx --platforms browser,node
sb dev src/index.tsx --platforms browser,node
```

**Implementation:**

```typescript
// vite.config.ts - handles all platforms via Vite API
const platformEnv = process.env.VITE_PLATFORM || 'browser';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sb-platform-inject',
      resolveId(id) {
        if (id === 'virtual-platform') {
          return id;
        }
      },
      load(id) {
        if (id === 'virtual-platform') {
          return `export const platform = '${platformEnv}';`;
        }
      }
    }
  ],
  build: {
    outDir: `dist/${platformEnv}/dist`,
    lib: platformEnv === 'node' ? { formats: ['cjs'] } : undefined
  }
});

// cli.ts - minimal wrapper
program
  .command('build')
  .action(async (entrypoint, options) => {
    for (const platform of options.platforms.split(',')) {
      process.env.VITE_PLATFORM = platform;
      await vite.build();
    }
  });
```

**Pros:**
- Minimal CLI code
- Users can mix Vite and CLI commands
- Forwards-compatible with Vite ecosystem
- Less abstraction = fewer surprises
- Standard Vite plugins work directly

**Cons:**
- Less coordinated dev experience
- Users see Vite directly (HMR, build output, etc.)
- Less opinionated (users must know Vite)
- Platform switching requires env vars

**Developer Experience:**
```
✓ Standard Vite experience
✓ Can use Vite plugins directly
✓ Simpler to debug
✗ Less hand-holding
✗ Multiple ways to accomplish same thing
```

**Technical Feasibility:** High (very straightforward)

**Recommended If:** You want to gradually adopt Vite and maintain minimal code.

---

## Part 5: Comparison Matrix

| Aspect | Option A (Envs) | Option B (Instances) | Option C (Conditional) | Option D (Wrapper) | Option E (Vite-First) |
|--------|-----------------|---------------------|------------------------|--------------------|-----------------------|
| **Config Files** | 1 | N | 1 | 1 | 1 |
| **Learning Curve** | High | Medium | Medium | High | Medium |
| **Stability** | Low | High | High | High | High |
| **CLI Code** | Low | Medium | Low | High | Very Low |
| **Extensibility** | Medium | High | High | High | Medium |
| **HMR Support** | Good | Good | Good | Excellent | Fair |
| **Post-Build Hooks** | Fair | Good | Good | Excellent | Fair |
| **Debug Experience** | Fair | Good | Fair | Poor | Good |
| **Future-Proof** | High | High | High | High | High |
| **Migration Effort** | High | High | Medium | Very High | Low |
| **Multi-Target UX** | Good | Fair | Fair | Excellent | Fair |

---

## Part 6: Detailed Developer Experience Comparison

### Option A: Environments API

**Development Flow:**
```bash
sb dev src/index.tsx
# Vite starts, detects environments: client, node, partykit-server
# Auto-handles HMR for browser platform
# Separate watch for Node (esbuild-like)
```

**Build Flow:**
```bash
sb build src/index.tsx --platforms all
# Sequentially or parallel: calls vite.build for each environment
# Output: dist/{platform}/dist/
```

**Pros for Devs:**
- If Environments API stabilizes, very elegant
- Single config paradigm
- Progressive enhancement

**Cons for Devs:**
- Documentation for Environments is sparse
- If API breaks, major refactor needed
- Feature parity with esbuild plugins uncertain

---

### Option B: Separate Vite Instances

**Development Flow:**
```bash
sb dev src/index.tsx
# Spawns: vite dev (browser)
# Spawns: esbuild watch (node) or separate vite instance
# Shows output: "Browser ready at ..."
```

**Build Flow:**
```bash
sb build src/index.tsx --platforms all
# For each platform:
#   $ VITE_PLATFORM=browser vite build
#   $ VITE_PLATFORM=node vite build
```

**Manual Usage:**
```bash
VITE_PLATFORM=browser vite build --config vite.config.browser.ts
VITE_PLATFORM=node vite build --config vite.config.node.ts
```

**Pros for Devs:**
- Can run individual platforms independently
- Clear file organization
- Easier to search for platform-specific config

**Cons for Devs:**
- Must know which config corresponds to which platform
- More files to manage
- Duplicated code in configs

---

### Option C: Single Config with Conditional Logic

**Development Flow:**
```bash
sb dev src/index.tsx
# Knows to build browser + node from options
# Conditional logic in vite.config.ts handles each
```

**Build Flow:**
```bash
sb build src/index.tsx --platforms browser,node
# For each platform:
#   $ VITE_PLATFORM=browser vite build
#   $ VITE_PLATFORM=node vite build
```

**Manual Usage (Not Typical):**
```bash
VITE_PLATFORM=browser vite build  # Works, but not documented
```

**Pros for Devs:**
- Single source of truth (vite.config.ts)
- Less boilerplate
- Easier to understand overall structure

**Cons for Devs:**
- Config is more complex (branching logic)
- Hard to reason about all platform combinations
- Less modular

---

### Option D: Monolithic CLI Wrapper

**Development Flow:**
```bash
sb dev src/index.tsx
# Starts unified dev experience
# Browser HMR + Node HMR coordinate
# Output shows both
```

**Build Flow:**
```bash
sb build src/index.tsx
# Builds all platforms (configurable)
# Post-processing (HTML injection, etc.) automatic
```

**Manual Usage:**
```bash
# Not typical - CLI is the interface
# Power users could dig into vite.config.ts but not recommended
```

**Pros for Devs:**
- Single command does everything
- Coordinated HMR for all platforms
- Opinionated defaults work well
- Clear output/logging

**Cons for Devs:**
- Can't easily customize individual platform builds
- Requires CLI code changes for extensions
- Harder to debug (abstraction layer)

---

### Option E: Vite-First Minimal CLI

**Development Flow:**
```bash
# Recommended: Use Vite directly
vite dev  # For browser platform
# Server: separate command or esbuild watch

# Or use CLI for convenience
sb dev src/index.tsx  # Wraps Vite, adds orchestration
```

**Build Flow:**
```bash
# Recommended: Standard Vite
VITE_PLATFORM=browser vite build
VITE_PLATFORM=node vite build

# Or use CLI
sb build src/index.tsx --platforms all
```

**Manual Usage:**
```bash
# Fully supported
VITE_PLATFORM=browser vite dev
VITE_PLATFORM=node vite build
# Users can leverage entire Vite ecosystem
```

**Pros for Devs:**
- Standard Vite workflow
- Can use plugins from Vite ecosystem without CLI overhead
- Familiar to Vite users
- Low CLI opinionation

**Cons for Devs:**
- Must manage environment variables
- Less coordinated dev experience
- More responsibility on user

---

## Part 7: Technical Feasibility Assessment

### Plugin System Migration

**Current Plugin Interface:**
```typescript
type Plugin = (buildConfig: BuildConfig) => PluginConfig;
```

**Plugin Hook into esbuild plugins:**
```typescript
esbuildPlugins?: (args: {...}) => EsbuildPlugin[];
```

**Vite Plugin Interface:**
```typescript
// Vite plugins are rollup plugins
export interface Plugin {
  name: string;
  resolveId?(id: string): any;
  load?(id: string): any;
  transform?(code: string, id: string): any;
  // ... many more hooks
}
```

**Migration Strategy:**
1. Keep Springboard plugin interface compatible
2. Implement adapter layer: Springboard Plugin → Vite Plugin
3. For existing esbuild plugins, provide esbuild-compatible plugin wrapper

```typescript
// Plugin adapter
function convertToVitePlugin(sbPlugin: Plugin): VitePlugin {
  return {
    name: sbPlugin.name || 'springboard-plugin',
    apply: 'build',
    async transform(code, id) {
      // Call esbuild plugin's transform
      // if available
    }
  };
}
```

**Feasibility:** Medium - Most plugins work with both esbuild and Vite (Rollup-compatible), but some edge cases may need handling.

### Environment Variable Injection

**Current approach:**
```typescript
define: {
  'process.env.NODE_ENV': '"production"',
  'process.env.WS_HOST': '"..."',
  // etc.
}
```

**Vite approach:**
```typescript
define: {
  __WS_HOST__: '"..."',  // Vite convention
  // OR
  'process.env.WS_HOST': '"..."'  // Also works
}
```

**Feasibility:** High - Vite `define` option works identically.

### PostBuild Hooks

**Current:**
```typescript
// esbuild plugin
{
  name: 'onBuildEnd',
  setup(build) {
    build.onEnd(async (result) => {
      // Copy files, generate config, etc.
    });
  }
}
```

**Vite:**
```typescript
// Vite plugin
{
  name: 'on-build-end',
  apply: 'build',
  async closeBundle() {
    // Copy files, generate config, etc.
  }
}
```

**Feasibility:** High - Vite has equivalent hooks (`closeBundle`, `writeBundle`).

### Platform-Specific Macro Injection

**Current approach:**
```typescript
// @platform "browser"
export function foo() { ... }
// @platform end

// @platform "node"
export function bar() { ... }
// @platform end
```

**Current implementation:** esbuild `onLoad` hook with regex replacement.

**Vite implementation:**
```typescript
{
  name: 'platform-inject',
  resolveId(id) { return id === 'virtual-platform' ? id : null; },
  load(id) {
    if (id === 'virtual-platform') {
      return `export const platform = '${platformEnv}';`;
    }
  },
  transform(code, id) {
    // Same regex replacement as esbuild
    const platformRegex = new RegExp(`\\/\\/ @platform "${platform}"([\\s\\S]*?)\\/\\/ @platform end`, 'g');
    return code.replace(platformRegex, '$1');
  }
}
```

**Feasibility:** High - Vite plugins have `transform` hook equivalent to esbuild's `onLoad`.

### HTML Generation & Injection

**Current approach:**
```typescript
// esbuild plugin reads HTML, injects script/link tags
// After build, replaces </head> and </body>
```

**Vite approach:**
```typescript
// Option 1: Use Vite's HTML input directly
// index.html is entry point, scripts injected automatically

// Option 2: Plugin hook writeBundle
{
  name: 'html-generate',
  apply: 'build',
  async writeBundle(options, bundle) {
    const html = readFileSync(...);
    // Inject tags
    writeFileSync(...);
  }
}
```

**Feasibility:** High - Vite's HTML handling is first-class; plugins can hook into generation.

### File Watching & Rebuild

**Current approach:**
```typescript
const ctx = await esbuild.context(options);
await ctx.watch();
```

**Vite approach:**
```typescript
await vite.build({ watch: { include: '**/*' } });
// OR
const server = await vite.createServer();
// Server handles watching
```

**Feasibility:** High - Both have watch modes.

### CommonJS Output (for Node Platform)

**esbuild:**
```typescript
platform: 'node',
format: 'cjs'  // Implicit
```

**Vite:**
```typescript
build: {
  lib: {
    formats: ['cjs']  // Explicit
  }
}
```

**Feasibility:** High - Vite supports CJS output via `lib.formats`.

### Dynamic Entry Point Generation

**Current approach:**
```typescript
// CLI writes dynamic-entry.js combining platform + app entrypoints
const allImports = `
import initApp from '${coreFile}';
import '${applicationEntrypoint}';
export default initApp;
`;
fs.writeFileSync(dynamicEntryPath, allImports);

// Then esbuild bundles that file
```

**Vite approach:**
```typescript
// Option 1: Pre-generate same way (works fine)
// Option 2: Use Vite plugin to generate virtual entry
{
  name: 'virtual-entry',
  resolveId(id) {
    return id === 'virtual-entry' ? id : null;
  },
  load(id) {
    if (id === 'virtual-entry') {
      return `
import initApp from '${coreFile}';
import '${applicationEntrypoint}';
export default initApp;
`;
    }
  }
}

// Then build.lib.entry: 'virtual-entry'
```

**Feasibility:** High - Both approaches work.

---

## Part 8: Real-World Examples & Case Studies

### Case Study 1: Nuxt 3 (Similar Multi-Platform Problem)

**Problem:** Nuxt needed to handle server + client rendering, multiple entry points, plugins, middleware.

**Solution:** Wraps Vite completely with high-level API.

**Relevant patterns:**
- `nuxi dev` - Starts HMR-enabled server + client build
- `nuxi build` - Builds server + client separately
- Plugin system (`addPlugin()`) - Abstracted from Vite
- Auto-entry generation - Plugins add routes automatically

**Lessons:**
1. Abstraction layer is powerful but requires maintenance
2. Can hide Vite complexity effectively
3. Users don't need to know Vite details
4. Good for opinionated frameworks

**Why Nuxt chose wrapping:**
- Multi-target (SSR) is complex
- Plugin system needs unification
- Options API and composables need special handling

---

### Case Study 2: SvelteKit (Vite-based but with Adapters)

**Problem:** Need to support multiple deployment targets (Node, Vercel, Netlify, etc.) from same codebase.

**Solution:** 
- Core: Vite-based dev server
- Target-specific: "Adapters" that post-process build

**Relevant patterns:**
- `svelte.config.js` - High-level config
- `config.kit.adapter` - Pluggable adapters
- `vite` option within svelte config

**Lessons:**
1. Adapters are post-build hooks (not dev-time)
2. Vite handles dev, adapters handle platform-specific output
3. Clear separation: Vite = universal, Adapter = platform

**How it could apply to Springboard:**
```typescript
// Similar pattern
export default defineConfig({
  platforms: ['browser', 'node', 'partykit'],
  platformAdapters: {
    node: nodeAdapter(),
    partykit: partykitAdapter(),
  },
  vite: {
    plugins: [react()]
  }
});
```

---

### Case Study 3: Astro (Route-based Multi-Platform)

**Problem:** Build static + SSR pages, multiple output formats (HTML, API endpoints, markdown).

**Solution:** File-based routing + Vite integration.

**Relevant patterns:**
- `src/pages/` directory → auto-routes
- `src/api/` → API endpoints
- `astro.config.mjs` - Single config
- `astro dev` + `astro build` - Simple CLI

**Lessons:**
1. Convention over configuration reduces complexity
2. File structure can drive build process
3. Single CLI command can hide multiple sub-builds

**Why Astro didn't need custom multi-target logic:**
- Each page/route is separate entry point
- Vite's `rollupOptions.input` can handle it
- No real runtime sharing between targets (unlike Springboard)

---

### Case Study 4: Remix (Transitioning from esbuild to Vite)

**Current:** Custom esbuild-based build system.

**Future (Remix v3):** Migrating to Vite.

**Challenges they faced:**
1. Server + client builds must coordinate
2. Manifest generation (route metadata)
3. Loader/action convention needs compile-time magic
4. Watch mode must rebuild routes, not just esbuild

**Their approach:**
- Wrap Vite with `remix build` / `remix dev`
- Vite handles code splitting and HMR
- CLI orchestrates multiple Vite instances
- Plugins for Remix-specific conventions

**Lessons:**
1. Migration is non-trivial for complex frameworks
2. Abstraction layer helps, but requires thought
3. Convention-based frameworks fit Vite well
4. Watch mode integration is key for DX

---

### Case Study 5: PartyKit (Edge + Browser)

**Problem:** Build server for edge runtime + browser bundle from same code.

**Solution:** 
- Native Vite support via `@partykit/vite` plugin
- `party.config.ts` configuration
- Entry points: server as worker, browser as normal

**Implementation:**
```typescript
// party.config.ts
export default defineConfig({
  name: "my-partykit",
  main: "src/server.ts",
  workers: [],
  serve: {
    path: "src/client"
  }
});
```

**Relevant pattern:**
- Vite plugin handles special build logic
- Separate entry points for server/client
- Output to `dist/server` and `dist/client`

**Why this works for PartyKit:**
- Clear separation: server (Worker) vs client (browser)
- Vite plugin provides convention
- No runtime sharing needed

---

## Part 9: Migration Path

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up Vite infrastructure, maintain esbuild compatibility.

**Tasks:**
1. Create `vite.config.ts` alongside existing esbuild setup
2. Implement Vite plugin for platform injection (copy esbuild logic)
3. Implement Vite plugin for HTML generation
4. Configure Vite for browser platform build
5. Update CLI to support `--vite` flag for testing

**Deliverables:**
- `vite.config.ts` for browser platform
- Vite plugins mirror esbuild functionality
- `sb build --vite src/index.tsx --platforms browser` works
- Output matches esbuild output

**No breaking changes:**
- `sb build src/index.tsx` still uses esbuild
- New flag allows gradual testing

---

### Phase 2: Multi-Platform (Weeks 3-4)

**Goal:** Add Vite support for all platforms.

**Choose one of the architectural options (Recommendation: Option D or E):**

**If Option D (Monolithic Wrapper):**
1. Migrate all platforms to Vite configs
2. Update CLI to orchestrate Vite builds
3. Implement coordinated HMR for dev mode
4. Add post-build hooks for PartyKit, Tauri

**If Option E (Vite-First):**
1. Migrate all platforms to single vite.config.ts with conditional logic
2. Keep minimal CLI wrapper
3. Focus on environment variable handling

**Deliverables:**
- All platforms building via Vite
- `sb build src/index.tsx --platforms all` works with Vite
- Output structure identical to esbuild
- Plugin system compatibility maintained

---

### Phase 3: Development Mode (Weeks 5-6)

**Goal:** Implement dev server with HMR.

**Tasks:**
1. Create Vite dev server for browser platform
2. Implement fast refresh / HMR
3. Coordinate server rebuilds (Node platform)
4. Ensure `sb dev` experience is better than esbuild

**Deliverables:**
- `sb dev src/index.tsx` starts Vite HMR server
- Changes to browser code hot-reload
- Server restarts on backend changes
- No full-page reloads unless necessary

---

### Phase 4: Plugin Migration (Weeks 7-8)

**Goal:** Migrate ecosystem plugins to Vite.

**Tasks:**
1. Document Springboard plugin API for Vite
2. Provide plugin adapter (Springboard → Vite)
3. Update all built-in plugins to support both esbuild and Vite
4. Test with community plugins

**Deliverables:**
- All plugins work with Vite
- Plugin documentation updated
- Adapter layer for backwards compatibility

---

### Phase 5: Cleanup & Stabilization (Weeks 9-10)

**Goal:** Remove esbuild, finalize migration.

**Tasks:**
1. Remove esbuild dependency
2. Clean up temporary `--vite` flags
3. Update documentation
4. Performance benchmarking
5. Stress test with complex apps

**Deliverables:**
- esbuild completely removed
- All tests passing
- Documentation updated
- Performance equivalent or better

---

## Part 10: Recommendation

**RECOMMENDED APPROACH: Option D (Monolithic CLI Wrapper)**

### Reasoning:

1. **Developer Experience:** `sb dev` and `sb build` provide a simple, unified interface. The coordinated HMR across platforms (browser + Node + PartyKit) is hard to achieve with other options.

2. **Maintenance:** While more CLI code, the abstraction is clean. Users don't need to understand Vite; they use familiar `sb` commands. Future changes to Vite API don't affect users directly.

3. **Precedent:** Nuxt and Astro prove this pattern works at scale. It's battle-tested.

4. **Multi-target complexity:** Springboard has 5-7 distinct platforms with different output requirements. A wrapper handles this elegantly.

5. **Plugin system:** Can create a clean Springboard plugin interface that abstracts away Vite details, similar to how current system hides esbuild.

6. **Post-build hooks:** PartyKit config generation, Tauri file copying, and HTML injection are easier to manage in CLI code than scattered Vite plugins.

7. **Stability:** Not dependent on experimental Vite APIs (Environments). Works with stable Vite versions.

### Architecture:

```
┌─────────────────────────────────────────┐
│          User: sb dev/build              │
└────────────────────┬────────────────────┘
                     │
        ┌────────────▼────────────┐
        │    CLI Orchestrator     │
        │  • Parse --platforms    │
        │  • Resolve configs      │
        │  • Coordinate HMR       │
        │  • Post-process builds  │
        └────────────┬────────────┘
                     │
        ┌────────────▼─────────────────────┬────────────────┐
        │                                  │                │
   ┌────▼─────────┐  ┌────────────────┐  ┌▼──────────────┐
   │ Vite Dev     │  │ Vite Dev       │  │ esbuild watch │
   │ (browser)    │  │ (other HTML)   │  │ (legacy Node) │
   │ Native HMR   │  │ Native HMR     │  │              │
   └──────────────┘  └────────────────┘  └───────────────┘
        │
   ┌────▼──────────────────────────┐
   │  Vite Plugins:                 │
   │  • vitePluginPlatformInject    │
   │  • vitePluginHtmlGenerate      │
   │  • vitePluginPartykitConfig    │
   │  • vitePluginTauriPostBuild    │
   └────────────────────────────────┘
```

### Alternative: Option E (Vite-First) as Secondary Option

If the team prefers minimal CLI code and is comfortable with users understanding Vite, **Option E** is a good fallback. It provides maximum flexibility and minimal maintenance burden, at the cost of less coordinated developer experience.

---

## Part 11: Vite Configuration Template

Based on Option D recommendation, here's a template `vite.config.ts`:

```typescript
import path from 'path';
import { defineConfig, mergeConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Import Springboard Vite plugins
import { vitePluginPlatformInject } from './cli/src/vite_plugins/vite_plugin_platform_inject';
import { vitePluginHtmlGenerate } from './cli/src/vite_plugins/vite_plugin_html_generate';
import { vitePluginPartykitConfig } from './cli/src/vite_plugins/vite_plugin_partykit_config';

const platformConfigs = {
  // Browser - Online
  'browser': {
    build: {
      outDir: 'dist/browser/dist',
      rollupOptions: {
        input: 'packages/springboard/platforms/webapp/index.html',
      }
    },
    plugins: [
      vitePluginHtmlGenerate('packages/springboard/platforms/webapp/index.html'),
    ]
  },
  
  // Browser - Offline
  'browser_offline': {
    build: {
      outDir: 'dist/browser_offline/dist',
      rollupOptions: {
        input: 'packages/springboard/platforms/webapp/index.html',
      }
    },
    plugins: [
      vitePluginHtmlGenerate('packages/springboard/platforms/webapp/index.html'),
    ]
  },

  // Node - CommonJS
  'node': {
    lib: {
      entry: 'dynamic-entry.js',
      formats: ['cjs']
    },
    ssr: {
      target: 'node'
    },
    build: {
      outDir: 'dist/node/dist',
      minify: process.env.NODE_ENV === 'production'
    }
  },

  // PartyKit - Server
  'partykit-server': {
    lib: {
      entry: 'dynamic-entry.js',
      formats: ['es']
    },
    build: {
      outDir: 'dist/partykit/neutral/dist',
      minify: process.env.NODE_ENV === 'production'
    },
    plugins: [
      vitePluginPartykitConfig(),
    ]
  },

  // PartyKit - Browser
  'partykit-browser': {
    build: {
      outDir: 'dist/partykit/browser/dist',
      rollupOptions: {
        input: 'packages/springboard/platforms/webapp/index.html',
      }
    },
    plugins: [
      vitePluginHtmlGenerate('packages/springboard/platforms/webapp/index.html'),
    ]
  },

  // Tauri - Webview
  'tauri-webview': {
    build: {
      outDir: 'dist/tauri/browser/dist',
      rollupOptions: {
        input: 'packages/springboard/platforms/tauri/index.html',
      }
    },
    plugins: [
      vitePluginHtmlGenerate('packages/springboard/platforms/tauri/index.html'),
    ]
  },

  // Tauri - Maestro (Node)
  'tauri-maestro': {
    lib: {
      entry: 'dynamic-entry.js',
      formats: ['cjs']
    },
    build: {
      outDir: 'dist/tauri/node/dist',
      minify: process.env.NODE_ENV === 'production'
    }
  },
};

const platform = process.env.VITE_PLATFORM || 'browser';
const platformConfig = platformConfigs[platform];

if (!platformConfig) {
  throw new Error(`Unknown platform: ${platform}`);
}

const baseConfig = {
  plugins: [
    react(),
    vitePluginPlatformInject(platform),
  ],
  resolve: {
    alias: {
      '@springboard': path.resolve(__dirname, 'packages/springboard'),
    }
  },
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    'process.env.WS_HOST': `"${process.env.WS_HOST || ''}"`,
    'process.env.DATA_HOST': `"${process.env.DATA_HOST || ''}"`,
    'process.env.DISABLE_IO': `"${process.env.DISABLE_IO || ''}"`,
    'process.env.IS_SERVER': `"${process.env.IS_SERVER || ''}"`,
    'process.env.DEBUG_LOG_PERFORMANCE': `"${process.env.DEBUG_LOG_PERFORMANCE || ''}"`,
    'process.env.RELOAD_CSS': `"${process.env.RELOAD_CSS || ''}"`,
    'process.env.RELOAD_JS': `"${process.env.RELOAD_JS || ''}"`,
  },
};

export default defineConfig(mergeConfig(baseConfig, platformConfig));
```

---

## Part 12: Next Steps

### Immediate Actions:

1. **Review & Feedback:** Share this document with team, gather feedback on recommended approach
2. **Prototype Phase 1:** Build `vite.config.ts` + browser platform plugin to validate approach
3. **Benchmark:** Compare esbuild vs Vite build times on real app
4. **Plugin Audit:** List all custom esbuild plugins, assess Vite compatibility

### Decision Points:

1. **Confirm Option D or E:** Team consensus on architectural approach
2. **Timeline:** Allocate 10-week development window
3. **Backwards compatibility:** Decide on esbuild sunset date
4. **Plugin ecosystem:** Plan for third-party plugin migration

### Risk Mitigation:

1. **Parallel running:** Maintain esbuild until Vite fully stable
2. **Canary testing:** Test with small apps first (empty_app, etc.)
3. **Performance validation:** Ensure Vite is faster/equivalent to esbuild
4. **Documentation:** Write migration guide for plugin developers

---

## Appendix: Resources

### Vite Documentation
- [Vite Guide](https://vitejs.dev/guide/)
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)
- [Vite Config Reference](https://vitejs.dev/config/)
- [Vite Environments (Experimental)](https://vitejs.dev/guide/ssr.html#setting-up-the-dev-server)

### Framework References
- [Nuxt 3 Architecture](https://nuxt.com/docs/guide/concepts/auto-imports)
- [Astro Build Process](https://docs.astro.build/en/concepts/why-astro/)
- [SvelteKit Adapters](https://kit.svelte.dev/docs/adapters)
- [Remix Architecture](https://remix.run/docs)

### Related Tools
- [Rollup (Vite's bundler)](https://rollupjs.org/)
- [esbuild (current tool)](https://esbuild.github.io/)
- [PartyKit Vite Plugin](https://docs.partykit.io/)
- [Tauri Build](https://tauri.app/v1/guides/building/)

---

## Document Metadata

**Created:** December 11, 2024
**Status:** Comprehensive Research & Planning
**Audience:** Springboard Development Team
**Revision:** 1.0

**Key Takeaway:**
Springboard should migrate to Vite using **Option D (Monolithic CLI Wrapper)** to maintain excellent developer experience while gaining modern build tooling. This requires 10 weeks of development but is lower-risk than alternatives and provides a foundation for future growth.

