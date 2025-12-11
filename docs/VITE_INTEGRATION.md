# Vite Integration Architecture

This document provides a comprehensive technical overview of Springboard's Vite-based build system. It covers the architecture, plugin system, dev server, and build orchestration.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Build Orchestration](#build-orchestration)
- [Vite Plugin System](#vite-plugin-system)
- [Dev Server Architecture](#dev-server-architecture)
- [Platform-Specific Builds](#platform-specific-builds)
- [Export Conditions](#export-conditions)
- [Configuration Generation](#configuration-generation)
- [Advanced Topics](#advanced-topics)

---

## Overview

Springboard v1.0 uses Vite as its build tool, implementing **Option D: Monolithic CLI Wrapper** from the planning documents. This approach:

1. **Hides Vite complexity** behind a simple `sb` CLI
2. **Orchestrates multiple Vite instances** for multi-platform builds
3. **Provides coordinated HMR** across browser and server platforms
4. **Handles platform-specific transformations** via custom Vite plugins

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Monolithic CLI wrapper | Simplifies DX while maintaining flexibility |
| Multiple Vite instances | Clear separation between platform builds |
| Pre-compiled dependencies | Vite's pre-bundling works correctly |
| Custom plugin system | Maintains Springboard's plugin interface |

---

## Architecture

### High-Level Architecture

```
+------------------------------------------+
|              User: sb dev/build           |
+--------------------+---------------------+
                     |
         +----------v-----------+
         |   CLI Orchestrator   |
         |  - Parse --platforms |
         |  - Resolve configs   |
         |  - Coordinate HMR    |
         |  - Post-process      |
         +----------+-----------+
                    |
     +--------------+---------------+---------------+
     |              |               |               |
+----v----+   +-----v-----+   +-----v-----+   +-----v-----+
|  Vite   |   |   Vite    |   |   Vite    |   |  esbuild  |
| Browser |   |   Node    |   | PartyKit  |   |  (watch)  |
|   HMR   |   |   Build   |   |   Build   |   |   Node    |
+---------+   +-----------+   +-----------+   +-----------+
     |              |               |               |
+----v--------------v---------------v---------------v----+
|                    Vite Plugins                        |
|  - vitePluginPlatformInject                           |
|  - vitePluginHtmlGenerate                             |
|  - vitePluginPartykitConfig                           |
|  - vitePluginTransformAwaitImport                     |
|  - vitePluginCopyFiles                                |
|  - vitePluginLogBuildTime                             |
|  - vitePluginSpringboardConditions                    |
+--------------------------------------------------------+
```

### Directory Structure

```
packages/springboard/cli/
├── src/
│   ├── cli.ts                      # Main CLI entry point
│   ├── types.ts                    # Type definitions
│   ├── build/
│   │   └── vite_build.ts           # Build orchestrator
│   ├── dev/
│   │   └── vite_dev_server.ts      # Dev server orchestrator
│   ├── config/
│   │   └── vite_config_generator.ts # Config generation
│   └── vite_plugins/
│       ├── index.ts                # Plugin exports
│       ├── utils.ts                # Shared utilities
│       ├── vite_plugin_platform_inject.ts
│       ├── vite_plugin_html_generate.ts
│       ├── vite_plugin_partykit_config.ts
│       ├── vite_plugin_transform_await_import.ts
│       ├── vite_plugin_copy_files.ts
│       ├── vite_plugin_log_build_time.ts
│       └── vite_plugin_springboard_conditions.ts
└── dist/                           # Compiled CLI output
```

---

## Build Orchestration

The build orchestrator (`vite_build.ts`) manages multi-platform builds by:

1. **Resolving platform configurations**
2. **Generating Vite configs for each platform**
3. **Executing builds sequentially or in parallel**
4. **Collecting and reporting results**

### Build Flow

```
sb build src/index.tsx --platforms main
            |
            v
    +---------------+
    | Parse Options |
    +-------+-------+
            |
            v
    +---------------+
    | Resolve       |
    | Platforms     |
    | (main = browser|
    |  + node +     |
    |  server)      |
    +-------+-------+
            |
     +------+------+------+
     |      |      |      |
     v      v      v      v
  browser node  server  ...
     |      |      |
     v      v      v
  Generate Vite Config
     |      |      |
     v      v      v
  vite.build()
     |      |      |
     v      v      v
    dist/browser dist/node dist/server
```

### Platform Resolution

```typescript
// Platform shortcuts expand to multiple targets
const platformMappings = {
  'main': ['browser', 'node', 'server'],
  'desktop': ['tauri_webview', 'tauri_maestro', 'server'],
  'partykit': ['partykit_browser', 'partykit_server'],
  'all': ['browser', 'browser_offline', 'node', 'partykit_browser',
          'partykit_server', 'tauri_webview', 'tauri_maestro', 'server'],
};
```

### Build Results

Each platform build returns a `BuildResult`:

```typescript
interface BuildResult {
  platform: string;    // Platform name
  outDir: string;      // Output directory
  duration: number;    // Build time in ms
  success: boolean;    // Whether build succeeded
  error?: string;      // Error message if failed
}
```

---

## Vite Plugin System

Springboard provides several custom Vite plugins that replicate and enhance the functionality of the previous esbuild plugins.

### vitePluginPlatformInject

**Purpose**: Transform platform-specific code blocks at build time.

**File**: `vite_plugin_platform_inject.ts`

This plugin handles the `@platform` directive, stripping code for non-target platforms:

```typescript
// Source code:
// @platform "browser"
export function getStorage() {
  return localStorage;
}
// @platform end

// @platform "node"
export function getStorage() {
  return require('fs');
}
// @platform end

// After transformation (target: browser):
export function getStorage() {
  return localStorage;
}
```

**Key Features**:
- Runs in `enforce: 'pre'` phase (before other plugins)
- Only transforms userland code (not node_modules)
- Quick check for `// @platform` before full transformation
- Supports debug logging

**Usage**:
```typescript
plugins: [
  vitePluginPlatformInject({ platform: 'browser' })
]
```

### vitePluginHtmlGenerate

**Purpose**: Generate HTML entry point with script/link tag injection.

**File**: `vite_plugin_html_generate.ts`

This plugin:
1. Reads the HTML template
2. Injects document metadata (title, OG tags, CSP, etc.)
3. Injects script and link tags for bundled assets
4. Writes the final HTML to the output directory

**Usage**:
```typescript
plugins: [
  vitePluginHtmlGenerate({
    templatePath: '/path/to/index.html',
    documentMeta: { title: 'My App' },
    outDir: 'dist/browser/dist',
  })
]
```

### vitePluginPartykitConfig

**Purpose**: Generate `partykit.json` configuration after build.

**File**: `vite_plugin_partykit_config.ts`

Generates the PartyKit configuration file pointing to the built server bundle.

### vitePluginTransformAwaitImport

**Purpose**: Transform `await import()` to `require()` for CJS compatibility.

**File**: `vite_plugin_transform_await_import.ts`

Used specifically for Tauri's Maestro (Node backend) which requires CommonJS.

### vitePluginCopyFiles

**Purpose**: Copy files to specified destinations after build.

**File**: `vite_plugin_copy_files.ts`

Used to copy Tauri webview builds to the Tauri app directory.

### vitePluginLogBuildTime

**Purpose**: Log build timing information.

**File**: `vite_plugin_log_build_time.ts`

### vitePluginSpringboardConditions

**Purpose**: Set resolve conditions for platform-specific dependency resolution.

**File**: `vite_plugin_springboard_conditions.ts`

This plugin configures Vite's resolve conditions to select the correct exports from dependencies based on the target platform.

---

## Dev Server Architecture

The dev server orchestrator (`vite_dev_server.ts`) manages development builds with HMR.

### Dev Server Components

```
+-------------------------------------------+
|           Dev Server Orchestrator         |
+-------------------------------------------+
|                                           |
|  +-------------+    +-----------------+   |
|  | Browser Dev |    | Node/Server     |   |
|  | Server      |    | Build Watchers  |   |
|  | (Vite HMR)  |    | (Vite watch)    |   |
|  +------+------+    +--------+--------+   |
|         |                    |            |
|         v                    v            |
|  +-------------+    +-----------------+   |
|  | WebSocket   |    | File System     |   |
|  | Connection  |    | Watch           |   |
|  +-------------+    +-----------------+   |
|                                           |
|  +--------------------------------------+ |
|  |          Node Server Process         | |
|  |  (spawned with --watch flag)         | |
|  +--------------------------------------+ |
+-------------------------------------------+
```

### HMR Flow

1. **Browser Platform**: Uses Vite's native HMR via WebSocket
2. **Node Platform**: Uses Vite build watch mode
3. **Server**: Uses Node.js `--watch` flag for automatic restart

### Starting the Dev Server

```typescript
// Simplified flow
async function startDevServer(options) {
  // 1. Start browser dev server with HMR
  const browserServer = await createServer(browserConfig);
  await browserServer.listen();

  // 2. Start node build in watch mode
  await viteBuild({ ...nodeConfig, watch: {} });

  // 3. Start server build in watch mode
  await viteBuild({ ...serverConfig, watch: {} });

  // 4. Wait for initial builds
  await sleep(1500);

  // 5. Start Node server process with watch
  spawn('node', ['--watch', 'dist/server/dist/local-server.cjs']);
}
```

### Graceful Shutdown

The dev server handles `SIGINT` and `SIGTERM` signals to:
1. Close all Vite dev servers
2. Kill the Node server process
3. Exit cleanly

---

## Platform-Specific Builds

### Browser Platform

**Target**: `browser`
**Format**: ESM
**Output**: `dist/browser/dist/`

Features:
- Fingerprinted filenames for cache busting
- HTML template with injected scripts
- CSS extraction
- Source maps

### Node Platform

**Target**: `node`
**Format**: CommonJS (CJS)
**Output**: `dist/node/dist/`

Features:
- SSR mode enabled
- External dependencies (native modules)
- Source maps

Externals:
```typescript
externals: ['@julusian/midi', 'easymidi', 'jsdom', 'better-sqlite3']
```

### PartyKit Platform

**Browser Target**: `browser`
**Server Target**: `neutral` (workerd)
**Output**: `dist/partykit/browser/` and `dist/partykit/neutral/`

Features:
- Browser bundle for client
- Edge-compatible server bundle
- Auto-generated `partykit.json`

Server externals:
```typescript
externals: ['@julusian/midi', 'easymidi', 'jsdom', 'node:async_hooks']
```

### Tauri Platform

**Webview Target**: `browser`
**Maestro Target**: `node`
**Output**: `dist/tauri/browser/` and `dist/tauri/node/`

Features:
- Custom environment variables for localhost connection
- File copying to Tauri app directory
- `await import()` to `require()` transformation

---

## Export Conditions

Springboard uses export conditions to provide platform-specific code to consumers.

### How Export Conditions Work

The `package.json` exports field defines conditional exports:

```json
{
  "exports": {
    "./platforms/browser": {
      "browser": "./src/platforms/browser/index.ts",
      "default": "./src/platforms/browser/index.ts"
    },
    "./platforms/node": {
      "node": "./src/platforms/node/index.ts",
      "default": "./src/platforms/node/index.ts"
    },
    "./platforms/partykit": {
      "workerd": "./src/platforms/partykit/index.ts",
      "default": "./src/platforms/partykit/index.ts"
    }
  }
}
```

### Vite Resolution

Vite resolves exports based on conditions. The `vitePluginSpringboardConditions` plugin sets:

```typescript
// For browser builds
resolve.conditions = ['browser', 'import', 'module', 'default']

// For node builds
resolve.conditions = ['node', 'import', 'module', 'default']

// For workerd (PartyKit) builds
resolve.conditions = ['workerd', 'import', 'module', 'default']
```

---

## Configuration Generation

The config generator (`vite_config_generator.ts`) creates Vite configurations programmatically.

### Platform Configurations

```typescript
const platformConfigs: Record<string, PlatformBuildConfig> = {
  browser: {
    target: 'browser',
    name: 'browser',
    platformEntrypoint: '@springboardjs/platforms-browser/entrypoints/online_entrypoint.ts',
    platformMacro: 'browser',
    outDir: 'browser/dist',
    fingerprint: true,
    htmlTemplate: '@springboardjs/platforms-browser/index.html',
    format: 'es',
  },
  node: {
    target: 'node',
    name: 'node',
    platformEntrypoint: '@springboardjs/platforms-node/entrypoints/node_flexible_entrypoint.ts',
    platformMacro: 'node',
    outDir: 'node/dist',
    format: 'cjs',
    externals: ['@julusian/midi', 'easymidi', 'jsdom', 'better-sqlite3'],
  },
  // ... other platforms
};
```

### Dynamic Entry Generation

The build system creates a virtual entry point that combines:
1. Platform initialization code
2. User's application entrypoint

```typescript
function createVirtualEntry(platformEntrypoint, applicationEntrypoint) {
  const entryContent = `
import initApp from '${platformEntrypoint}';
import '${applicationEntrypoint}';
export default initApp;
`;
  // Write to dist/{platform}/dist/dynamic-entry.js
}
```

### Generated Vite Config

The generator produces a complete Vite `InlineConfig`:

```typescript
const config: InlineConfig = {
  root: rootDir,
  mode: dev ? 'development' : 'production',
  plugins: [/* platform-specific plugins */],
  define: {
    'process.env.WS_HOST': /* ... */,
    'process.env.DATA_HOST': /* ... */,
    // ... other env vars
  },
  resolve: {
    alias: { '@springboard': '...' },
    conditions: ['browser', 'import', 'module', 'default'],
  },
  build: {
    outDir: 'dist/browser/dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: !dev,
    target: 'es2020',
    rollupOptions: {
      input: '/path/to/dynamic-entry.js',
      output: { format: 'es', /* ... */ },
      external: [/* externals */],
    },
  },
};
```

---

## Advanced Topics

### Custom Springboard Plugins

Springboard plugins can provide Vite plugins and modify configuration:

```typescript
import type { Plugin } from 'springboard-cli';

export default function myPlugin(): Plugin {
  return (buildConfig) => ({
    name: 'my-plugin',

    // Add Vite plugins
    vitePlugins: (args) => [
      myVitePlugin(args.outDir),
    ],

    // Define external dependencies
    externals: () => ['my-external-package'],

    // Modify Vite config
    editViteConfig: (config) => {
      config.define = {
        ...config.define,
        MY_CUSTOM_DEFINE: '"value"',
      };
    },
  });
}
```

### Environment Variables

Build-time environment variables are injected via Vite's `define`:

| Variable | Description |
|----------|-------------|
| `process.env.NODE_ENV` | `'development'` or `'production'` |
| `process.env.WS_HOST` | WebSocket host URL |
| `process.env.DATA_HOST` | Data/API host URL |
| `process.env.DISABLE_IO` | Disable I/O operations |
| `process.env.IS_SERVER` | Running on server |
| `process.env.RELOAD_CSS` | Enable CSS hot reload |
| `process.env.RELOAD_JS` | Enable JS hot reload |

### Source Maps

Source maps are enabled by default in all builds:
- Development: Full source maps for debugging
- Production: Source maps for error tracking

### Watch Mode

Watch mode uses Vite's built-in watch functionality:

```typescript
// Build with watch
await viteBuild({
  ...config,
  build: {
    ...config.build,
    watch: {}, // Empty object enables watch mode
  },
});
```

### Parallel Builds

Currently, builds are executed sequentially to avoid resource contention. Future versions may support parallel builds for independent platforms.

---

## Troubleshooting

### Debug Logging

Enable debug logging for plugins:

```typescript
vitePluginPlatformInject({
  platform: 'browser',
  debug: true,
})
```

### Common Issues

1. **Missing node_modules**: The config generator searches up the directory tree for `node_modules`. Ensure you've run `npm install`.

2. **External resolution**: If a package should be external but is being bundled, add it to the platform's `externals` array.

3. **HMR not working**: Check that the browser dev server is running and WebSocket connections aren't blocked.

4. **Build failures**: Check the build output for specific error messages. Source maps help locate issues.

---

## References

- [Vite Documentation](https://vitejs.dev/)
- [Rollup Plugin API](https://rollupjs.org/plugin-development/)
- [PLAN_VITE_PRECOMPILATION.md](../PLAN_VITE_PRECOMPILATION.md)
- [PLAN_VITE_CLI_INTEGRATION.md](../PLAN_VITE_CLI_INTEGRATION.md)
- [PLAN_PACKAGE_CONSOLIDATION.md](../PLAN_PACKAGE_CONSOLIDATION.md)
