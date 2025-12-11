# Springboard Package Structure

This document describes the consolidated package structure introduced in Springboard v1.0. It covers the export map, import patterns, tree-shaking, and TypeScript configuration.

---

## Table of Contents

- [Overview](#overview)
- [Package Architecture](#package-architecture)
- [Export Map](#export-map)
- [Import Patterns](#import-patterns)
- [Platform-Specific Imports](#platform-specific-imports)
- [Tree-Shaking](#tree-shaking)
- [TypeScript Configuration](#typescript-configuration)
- [Dependency Management](#dependency-management)
- [Development vs Production](#development-vs-production)

---

## Overview

Springboard v1.0 consolidates 14+ packages into a single unified package with subpath exports. This approach:

- **Simplifies installation**: `npm install springboard` replaces multiple package installs
- **Reduces version conflicts**: Single version for all framework code
- **Enables better tree-shaking**: Module-level granularity
- **Follows modern standards**: Uses Node.js subpath exports

### Package Summary

| Package | Purpose | Installation |
|---------|---------|--------------|
| `springboard` | Core framework + all platforms | `npm install springboard` |
| `springboard-cli` | Build tooling | `npm install -D springboard-cli` |
| `create-springboard-app` | Project scaffolding | `npx create-springboard-app` |
| `@springboardjs/data-storage` | Database utilities (optional) | `npm install @springboardjs/data-storage` |

---

## Package Architecture

### Directory Structure

```
packages/springboard/
├── package.json              # Main package config with exports
├── src/
│   ├── index.ts              # Main entry point
│   ├── core/                 # Core framework code
│   │   ├── index.ts
│   │   ├── engine/
│   │   ├── hooks/
│   │   ├── modules/
│   │   ├── services/
│   │   └── types/
│   ├── server/               # Server-side code
│   │   ├── index.ts
│   │   ├── hono_app.ts
│   │   ├── register.ts
│   │   ├── services/
│   │   ├── utils/
│   │   └── entrypoints/
│   └── platforms/            # Platform adapters
│       ├── browser/
│       │   ├── index.ts
│       │   ├── services/
│       │   └── entrypoints/
│       ├── node/
│       │   ├── index.ts
│       │   ├── services/
│       │   └── entrypoints/
│       ├── tauri/
│       │   ├── index.ts
│       │   └── entrypoints/
│       ├── partykit/
│       │   ├── index.ts
│       │   ├── services/
│       │   └── entrypoints/
│       └── react-native/
│           ├── index.ts
│           ├── services/
│           └── entrypoints/
└── dist/                     # Compiled output (when built)
```

---

## Export Map

The `exports` field in `package.json` defines all public entry points:

```json
{
  "name": "springboard",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./server": {
      "types": "./src/server/index.ts",
      "node": "./src/server/index.ts",
      "import": "./src/server/index.ts",
      "default": "./src/server/index.ts"
    },
    "./platforms/node": {
      "types": "./src/platforms/node/index.ts",
      "node": "./src/platforms/node/index.ts",
      "import": "./src/platforms/node/index.ts",
      "default": "./src/platforms/node/index.ts"
    },
    "./platforms/browser": {
      "types": "./src/platforms/browser/index.ts",
      "browser": "./src/platforms/browser/index.ts",
      "import": "./src/platforms/browser/index.ts",
      "default": "./src/platforms/browser/index.ts"
    },
    "./platforms/tauri": {
      "types": "./src/platforms/tauri/index.ts",
      "import": "./src/platforms/tauri/index.ts",
      "default": "./src/platforms/tauri/index.ts"
    },
    "./platforms/partykit": {
      "types": "./src/platforms/partykit/index.ts",
      "workerd": "./src/platforms/partykit/index.ts",
      "import": "./src/platforms/partykit/index.ts",
      "default": "./src/platforms/partykit/index.ts"
    },
    "./platforms/react-native": {
      "types": "./src/platforms/react-native/index.ts",
      "react-native": "./src/platforms/react-native/index.ts",
      "import": "./src/platforms/react-native/index.ts",
      "default": "./src/platforms/react-native/index.ts"
    },
    "./core": {
      "types": "./src/core/index.ts",
      "import": "./src/core/index.ts",
      "default": "./src/core/index.ts"
    },
    "./core/*": {
      "types": "./src/core/*.ts",
      "import": "./src/core/*.ts",
      "default": "./src/core/*.ts"
    },
    "./package.json": "./package.json"
  }
}
```

### Export Conditions Explained

Each export can have multiple conditions that bundlers use to select the appropriate file:

| Condition | Used By | Purpose |
|-----------|---------|---------|
| `types` | TypeScript | Type definitions |
| `import` | ESM bundlers | ES module entry |
| `node` | Node.js, Vite (SSR) | Node.js-specific code |
| `browser` | Vite, webpack | Browser-specific code |
| `workerd` | Cloudflare, PartyKit | Edge runtime code |
| `react-native` | Metro bundler | React Native code |
| `default` | Fallback | Default when no condition matches |

---

## Import Patterns

### Main Entry Point

```typescript
// Import the main springboard registry
import springboard from 'springboard';

// Or with named exports
import {
  springboard,
  Springboard,
  SpringboardProvider,
  SpringboardProviderPure,
  useSpringboardEngine,
  ModuleAPI,
  ModuleRegistry,
  useMount,
  generateId,
  SharedStateService,
  HttpKvStoreClient,
  BaseModule,
  FilesModule,
  IndexedDBFileStorageProvider,
  makeMockCoreDependencies,
} from 'springboard';
```

### Type Imports

```typescript
import type {
  // Core types
  CoreDependencies,
  ModuleDependencies,
  KVStore,
  Rpc,
  RpcArgs,
  FileStorageProvider,

  // Registry types
  SpringboardRegistry,
  RegisterModuleOptions,
  ModuleCallback,
  ClassModuleCallback,
  DocumentMetaFunction,
  RegisterRouteOptions,

  // Module types
  Module,
  ExtraModuleDependencies,
  DocumentMeta,

  // File types
  FileHandle,
  FileMetadata,

  // Response types
  ErrorResponse,
  SuccessResponse,
  SpringboardResponse,
} from 'springboard';
```

### Server Import

```typescript
// Server functionality
import createServer from 'springboard/server';

// Or with named exports
import {
  createHonoApp,
  ServerJsonRpc,
  injectMetadata,
  matchPath,
  // ... other server exports
} from 'springboard/server';
```

### Platform Imports

```typescript
// Browser platform
import {
  BrowserKVStore,
  BrowserJsonRpc,
} from 'springboard/platforms/browser';

// Node platform
import {
  NodeKVStore,
  NodeJsonRpc,
  NodeFileStorage,
  NodeRpcAsyncLocalStorage,
} from 'springboard/platforms/node';

// Tauri platform
import {
  TauriMaestroEntrypoint,
} from 'springboard/platforms/tauri';

// PartyKit platform
import {
  PartykitKVStore,
  PartykitRpcClient,
  PartykitRpcServer,
  createPartykitHonoApp,
} from 'springboard/platforms/partykit';

// React Native platform
import {
  RNKVStore,
  RNWebViewBridge,
  RNWebViewLocalTokenService,
} from 'springboard/platforms/react-native';
```

### Core Subpath Imports

For more granular imports from core:

```typescript
// Direct module imports
import { ModuleAPI } from 'springboard/core/engine/module_api';
import { SharedStateService } from 'springboard/core/services/states/shared_state_service';
import { generateId } from 'springboard/core/utils/generate_id';
```

---

## Platform-Specific Imports

### Automatic Platform Resolution

When using the Springboard CLI, platform-specific code is automatically resolved based on the build target. The `vitePluginSpringboardConditions` plugin sets the appropriate resolve conditions.

```typescript
// This import resolves differently based on build target:
import { getStorage } from 'springboard/platforms/browser';

// In browser builds: uses browser condition
// In node builds: uses node condition (stub or error)
```

### Manual Platform Selection

For advanced use cases where you need to explicitly import platform code:

```typescript
// Force browser imports (for SSR with browser simulation)
import { BrowserKVStore } from 'springboard/platforms/browser';

// Force node imports (for CLI tools)
import { NodeFileStorage } from 'springboard/platforms/node';
```

### Conditional Runtime Imports

For code that runs in multiple environments:

```typescript
// Detect platform at runtime
const isNode = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

// Dynamic import based on platform
async function getKVStore() {
  if (isNode) {
    const { NodeKVStore } = await import('springboard/platforms/node');
    return new NodeKVStore();
  } else {
    const { BrowserKVStore } = await import('springboard/platforms/browser');
    return new BrowserKVStore();
  }
}
```

---

## Tree-Shaking

### How Tree-Shaking Works

Springboard is configured for optimal tree-shaking:

1. **`sideEffects: false`**: Tells bundlers that imports have no side effects
2. **ES module format**: Uses pure ES imports/exports
3. **Granular exports**: Subpath exports allow importing only what you need

```json
{
  "sideEffects": false
}
```

### Maximizing Tree-Shaking

**Do**: Import only what you need

```typescript
// Good: Only ModuleAPI is included
import { ModuleAPI } from 'springboard';

// Good: Platform-specific import
import { BrowserKVStore } from 'springboard/platforms/browser';
```

**Don't**: Import everything when you need one thing

```typescript
// Bad: May include all exports in bundle
import * as Springboard from 'springboard';

// Then only using:
const api = new Springboard.ModuleAPI();
```

### Bundle Analysis

To verify tree-shaking is working:

```bash
# Using rollup-plugin-visualizer
npx vite build --mode analyze

# Or with source-map-explorer
npx source-map-explorer dist/browser/dist/index.js
```

### Expected Bundle Sizes

| Import Pattern | Approximate Size |
|----------------|------------------|
| Core only | ~50KB |
| Core + Browser | ~65KB |
| Core + Browser + Server | ~85KB |
| Full framework | ~120KB |

*Sizes are minified, before gzip*

---

## TypeScript Configuration

### typesVersions

The `typesVersions` field enables TypeScript to find type definitions for subpath imports:

```json
{
  "typesVersions": {
    "*": {
      "server": ["./src/server/index.ts"],
      "platforms/node": ["./src/platforms/node/index.ts"],
      "platforms/browser": ["./src/platforms/browser/index.ts"],
      "platforms/tauri": ["./src/platforms/tauri/index.ts"],
      "platforms/partykit": ["./src/platforms/partykit/index.ts"],
      "platforms/react-native": ["./src/platforms/react-native/index.ts"],
      "core": ["./src/core/index.ts"],
      "core/*": ["./src/core/*"]
    }
  }
}
```

### tsconfig.json Recommendations

For applications using Springboard:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "jsx": "react-jsx",
    "types": ["node"],
    "paths": {
      "springboard": ["./node_modules/springboard/src/index.ts"],
      "springboard/*": ["./node_modules/springboard/src/*"]
    }
  }
}
```

### Path Aliases (Optional)

For shorter imports in large projects:

```json
{
  "compilerOptions": {
    "paths": {
      "@sb": ["./node_modules/springboard/src/index.ts"],
      "@sb/*": ["./node_modules/springboard/src/*"]
    }
  }
}
```

Then in your code:

```typescript
import springboard from '@sb';
import { BrowserKVStore } from '@sb/platforms/browser';
```

---

## Dependency Management

### Required Dependencies

These are always included with `springboard`:

```json
{
  "dependencies": {
    "dexie": "^4.2.1",
    "json-rpc-2.0": "^1.7.1",
    "reconnecting-websocket": "^4.4.0"
  }
}
```

### Peer Dependencies

These must be installed by the user based on their needs:

```json
{
  "peerDependencies": {
    "react": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
    "react-dom": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
    "react-router": "^7",
    "rxjs": "^7.0.0",
    "immer": "^10.0.0"
  }
}
```

All peer dependencies are marked optional:

```json
{
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true },
    "react-router": { "optional": true }
  }
}
```

### Platform-Specific Dependencies

Install only the dependencies you need:

```bash
# Browser app with React
npm install springboard react react-dom react-router

# Server-side only
npm install springboard hono @hono/node-server @hono/node-ws

# Tauri desktop app
npm install springboard @tauri-apps/api @tauri-apps/plugin-shell

# PartyKit edge app
npm install springboard partysocket hono
```

### Optional Dependencies

Heavy dependencies are optional and only loaded when used:

```json
{
  "optionalDependencies": {
    "@hono/node-server": "^1.19.6",
    "@hono/node-ws": "^1.2.0",
    "better-sqlite3": "^12.4.1",
    "hono": "^4.6.0",
    "partysocket": "^1.1.6",
    "ws": "^8.0.0",
    "zod": "^3.0.0"
  }
}
```

---

## Development vs Production

### Development Mode

In development, Springboard ships TypeScript source files directly. This enables:

- **Source maps**: Debug directly in TypeScript
- **Fast rebuilds**: No compilation step needed
- **HMR support**: Full hot module replacement

```json
{
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts"
}
```

### Production Builds

When the package is built for production (e.g., for npm publishing), it produces:

```
dist/
├── index.js        # Compiled JavaScript
├── index.d.ts      # Type declarations
├── index.js.map    # Source maps
├── server/
│   ├── index.js
│   ├── index.d.ts
│   └── ...
├── platforms/
│   ├── browser/
│   ├── node/
│   └── ...
└── core/
    └── ...
```

### Build Commands

```bash
# Development build (watch mode)
npm run build:watch

# Production build
npm run build

# Type checking only
npm run check-types
```

---

## Migration from Multi-Package

### Old Structure (v0.x)

```
node_modules/
├── springboard/
├── springboard-server/
├── springboard-cli/
├── @springboardjs/
│   ├── platforms-browser/
│   ├── platforms-node/
│   ├── platforms-tauri/
│   ├── platforms-partykit/
│   ├── platforms-react-native/
│   ├── data-storage/
│   ├── plugin-svelte/
│   ├── mantine/
│   └── shoelace/
```

### New Structure (v1.0)

```
node_modules/
├── springboard/                # Everything in one package
│   └── src/
│       ├── index.ts
│       ├── server/
│       ├── platforms/
│       │   ├── browser/
│       │   ├── node/
│       │   ├── tauri/
│       │   ├── partykit/
│       │   └── react-native/
│       └── core/
├── springboard-cli/            # Build tooling (separate)
└── @springboardjs/data-storage/ # Database (separate)
```

### Import Migration Table

| Old Import | New Import |
|------------|------------|
| `from 'springboard'` | `from 'springboard'` |
| `from 'springboard-server'` | `from 'springboard/server'` |
| `from '@springboardjs/platforms-browser'` | `from 'springboard/platforms/browser'` |
| `from '@springboardjs/platforms-node'` | `from 'springboard/platforms/node'` |
| `from '@springboardjs/platforms-tauri'` | `from 'springboard/platforms/tauri'` |
| `from '@springboardjs/platforms-partykit'` | `from 'springboard/platforms/partykit'` |
| `from '@springboardjs/platforms-react-native'` | `from 'springboard/platforms/react-native'` |

---

## References

- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) - Step-by-step migration instructions
- [Node.js Subpath Exports](https://nodejs.org/api/packages.html#subpath-exports)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [Vite Library Mode](https://vitejs.dev/guide/build.html#library-mode)
