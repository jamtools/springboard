# Springboard v1.0 Migration Guide

## Overview

Springboard v1.0 represents a **complete architectural overhaul** of the framework. This is a **clean break** from the previous version with no backward compatibility. The migration involves three major changes:

1. **Build System**: Migration from esbuild to Vite
2. **Package Structure**: Consolidation from 14+ packages to a single `springboard` package
3. **CLI Rewrite**: Complete rewrite using Vite's build orchestration

**Important**: This is NOT a gradual migration. You must update all imports and configurations at once.

---

## Table of Contents

- [Breaking Changes Summary](#breaking-changes-summary)
- [Quick Start Migration Checklist](#quick-start-migration-checklist)
- [Package Import Changes](#package-import-changes)
- [CLI Command Changes](#cli-command-changes)
- [Configuration Migration](#configuration-migration)
- [Platform-Specific Notes](#platform-specific-notes)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Breaking Changes Summary

### Package Changes

| Old Package | New Import Path | Notes |
|-------------|-----------------|-------|
| `springboard` (core) | `springboard` | Main entry unchanged |
| `springboard-server` | `springboard/server` | Now a subpath export |
| `@springboardjs/platforms-browser` | `springboard/platforms/browser` | Consolidated |
| `@springboardjs/platforms-node` | `springboard/platforms/node` | Consolidated |
| `@springboardjs/platforms-tauri` | `springboard/platforms/tauri` | Consolidated |
| `@springboardjs/platforms-partykit` | `springboard/platforms/partykit` | Consolidated |
| `@springboardjs/platforms-react-native` | `springboard/platforms/react-native` | Consolidated |
| `@springboardjs/data-storage` | Separate package (unchanged) | Still standalone |
| `springboard-cli` | `springboard-cli` | Package name unchanged, internals rewritten |

### Build System Changes

| Aspect | Old (esbuild) | New (Vite) |
|--------|---------------|------------|
| Build tool | esbuild | Vite (Rollup under the hood) |
| Dev server | esbuild.serve() | Vite dev server with HMR |
| Config file | None (CLI flags) | Optional `vite.config.ts` for customization |
| Plugin format | esbuild plugins | Vite plugins |
| Hot Module Replacement | File watching only | True HMR with state preservation |

### CLI Changes

The CLI commands remain similar but the underlying implementation is completely different:

```bash
# Commands are the same
sb dev src/index.tsx
sb build src/index.tsx
sb start

# Platform flags work the same
sb build src/index.tsx --platforms browser,node
sb build src/index.tsx --platforms all
```

---

## Quick Start Migration Checklist

Follow these steps to migrate your Springboard application:

### Step 1: Update package.json

Remove all old Springboard packages and install the new unified package:

```bash
# Remove old packages
npm uninstall springboard springboard-server springboard-cli \
  @springboardjs/platforms-browser @springboardjs/platforms-node \
  @springboardjs/platforms-tauri @springboardjs/platforms-partykit \
  @springboardjs/platforms-react-native @springboardjs/plugin-svelte \
  @springboardjs/mantine @springboardjs/shoelace

# Install new unified package
npm install springboard@^1.0.0

# Install CLI (if using)
npm install -D springboard-cli@^1.0.0
```

### Step 2: Update Imports

Update all import statements in your codebase:

```typescript
// BEFORE (v0.x)
import springboard from 'springboard';
import server from 'springboard-server';
import { BrowserKVStore } from '@springboardjs/platforms-browser';
import { NodeKVStore } from '@springboardjs/platforms-node';

// AFTER (v1.0)
import springboard from 'springboard';
import server from 'springboard/server';
import { BrowserKVStore } from 'springboard/platforms/browser';
import { NodeKVStore } from 'springboard/platforms/node';
```

### Step 3: Update Platform-Specific Imports

```typescript
// BEFORE
import { createPartykitApp } from '@springboardjs/platforms-partykit';
import { TauriFileStorage } from '@springboardjs/platforms-tauri';

// AFTER
import { createPartykitApp } from 'springboard/platforms/partykit';
import { TauriFileStorage } from 'springboard/platforms/tauri';
```

### Step 4: Delete Old Build Artifacts

```bash
rm -rf dist/
rm -rf node_modules/.vite/
```

### Step 5: Test Your Build

```bash
# Development
sb dev src/index.tsx

# Production build
sb build src/index.tsx --platforms main
```

---

## Package Import Changes

### Core Framework

```typescript
// =====================================================
// Main Springboard import (UNCHANGED)
// =====================================================
import springboard, { Springboard, SpringboardProvider } from 'springboard';

// =====================================================
// Core utilities and types
// =====================================================
import {
  ModuleAPI,
  ModuleRegistry,
  useMount,
  generateId,
  SharedStateService,
  HttpKvStoreClient,
  BaseModule,
  FilesModule,
  makeMockCoreDependencies,
} from 'springboard';

// Type imports
import type {
  CoreDependencies,
  ModuleDependencies,
  KVStore,
  Rpc,
  RpcArgs,
  FileStorageProvider,
  SpringboardRegistry,
  RegisterModuleOptions,
  Module,
  DocumentMeta,
} from 'springboard';
```

### Server

```typescript
// BEFORE
import createServer from 'springboard-server';
import { createHonoApp } from 'springboard-server';

// AFTER
import createServer from 'springboard/server';
import { createHonoApp } from 'springboard/server';
```

### Browser Platform

```typescript
// BEFORE
import { BrowserKVStore } from '@springboardjs/platforms-browser';
import { BrowserJsonRpc } from '@springboardjs/platforms-browser';
import onlineEntrypoint from '@springboardjs/platforms-browser/entrypoints/online_entrypoint';

// AFTER
import { BrowserKVStore } from 'springboard/platforms/browser';
import { BrowserJsonRpc } from 'springboard/platforms/browser';
// Entrypoints are handled internally by the CLI
```

### Node Platform

```typescript
// BEFORE
import { NodeKVStore } from '@springboardjs/platforms-node';
import { NodeJsonRpc } from '@springboardjs/platforms-node';
import { NodeFileStorage } from '@springboardjs/platforms-node';

// AFTER
import { NodeKVStore } from 'springboard/platforms/node';
import { NodeJsonRpc } from 'springboard/platforms/node';
import { NodeFileStorage } from 'springboard/platforms/node';
```

### Tauri (Desktop) Platform

```typescript
// BEFORE
import { TauriEntrypoint } from '@springboardjs/platforms-tauri';
import '@springboardjs/platforms-tauri/entrypoints/platform_tauri_browser';

// AFTER
import { TauriEntrypoint } from 'springboard/platforms/tauri';
// Entrypoints are handled internally by the CLI
```

### PartyKit Platform

```typescript
// BEFORE
import { PartykitKVStore } from '@springboardjs/platforms-partykit';
import { PartykitRpcClient } from '@springboardjs/platforms-partykit';

// AFTER
import { PartykitKVStore } from 'springboard/platforms/partykit';
import { PartykitRpcClient } from 'springboard/platforms/partykit';
```

### React Native Platform

```typescript
// BEFORE
import { RNKVStore } from '@springboardjs/platforms-react-native';
import { RNWebViewBridge } from '@springboardjs/platforms-react-native';

// AFTER
import { RNKVStore } from 'springboard/platforms/react-native';
import { RNWebViewBridge } from 'springboard/platforms/react-native';
```

---

## CLI Command Changes

The CLI commands remain largely the same, but there are some important differences in behavior:

### Development Server

```bash
# Start dev server (default port 5173)
sb dev src/index.tsx

# Custom port
sb dev src/index.tsx --port 3000

# Specific platforms
sb dev src/index.tsx --platforms browser
sb dev src/index.tsx --platforms main
```

**New in v1.0**: The dev server now provides true Hot Module Replacement (HMR) for the browser platform. Changes to your code will update in the browser without a full page refresh, preserving component state.

### Production Build

```bash
# Build main platforms (browser + node + server)
sb build src/index.tsx --platforms main

# Build specific platform
sb build src/index.tsx --platforms browser
sb build src/index.tsx --platforms browser_offline
sb build src/index.tsx --platforms node

# Build all platforms
sb build src/index.tsx --platforms all

# Build for desktop (Tauri)
sb build src/index.tsx --platforms desktop

# Build for edge (PartyKit)
sb build src/index.tsx --platforms partykit

# Watch mode
sb build src/index.tsx --platforms main --watch
```

### Platform Values

| Platform Value | Builds |
|----------------|--------|
| `main` | browser + node + server |
| `browser` | Browser (online) |
| `browser_offline` | Browser (offline-capable) |
| `node` | Node.js runtime |
| `desktop` | Tauri webview + maestro + server |
| `partykit` | PartyKit browser + server |
| `mobile` | React Native |
| `all` | All platforms |

### Start Production Server

```bash
# Start the built server
sb start
```

---

## Configuration Migration

### vite.config.ts (Optional)

In v1.0, you can optionally create a `vite.config.ts` file for advanced customization. The CLI will use sensible defaults if no config file is present.

```typescript
// vite.config.ts (optional - for customization only)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
  ],
  // Your custom configuration here
});
```

**Note**: Most users will NOT need a vite.config.ts file. The CLI handles all configuration automatically.

### Custom Plugins

If you were using custom esbuild plugins, you'll need to convert them to Vite plugins:

```typescript
// BEFORE: esbuild plugin
const myEsbuildPlugin = {
  name: 'my-plugin',
  setup(build) {
    build.onLoad({ filter: /\.special$/ }, async (args) => {
      // transform code
      return { contents: transformedCode };
    });
  }
};

// AFTER: Vite plugin
import type { Plugin } from 'vite';

export function myVitePlugin(): Plugin {
  return {
    name: 'my-plugin',
    transform(code, id) {
      if (id.endsWith('.special')) {
        return { code: transformedCode };
      }
    }
  };
}
```

### Springboard Plugin Interface

The Springboard plugin interface has been updated for Vite:

```typescript
// BEFORE (esbuild-based)
import type { Plugin } from 'springboard-cli';

export default function myPlugin(): Plugin {
  return (buildConfig) => ({
    name: 'my-plugin',
    esbuildPlugins: () => [/* esbuild plugins */],
    externals: () => ['some-package'],
  });
}

// AFTER (Vite-based)
import type { Plugin } from 'springboard-cli';
import type { Plugin as VitePlugin } from 'vite';

export default function myPlugin(): Plugin {
  return (buildConfig) => ({
    name: 'my-plugin',
    vitePlugins: (args) => [/* Vite plugins */],
    externals: () => ['some-package'],
    editViteConfig: (config) => {
      // Modify Vite config if needed
    },
  });
}
```

---

## Platform-Specific Notes

### Browser Platform

The browser platform now uses Vite's native HTML handling. Your `index.html` template works the same way but benefits from:

- **True HMR**: State-preserving hot updates
- **Faster refresh**: Only changed modules are recompiled
- **Better error overlay**: Vite's error overlay is more helpful

### Node Platform

Node builds now use Vite's SSR mode internally:

- Output format is still CommonJS (`.cjs`) for compatibility
- External dependencies are handled automatically
- Source maps are included by default

### PartyKit Platform

PartyKit builds produce two outputs:

1. **Browser bundle**: Standard browser build in `dist/partykit/browser/`
2. **Server bundle**: Edge-compatible build in `dist/partykit/neutral/`
3. **partykit.json**: Auto-generated configuration file

### Tauri (Desktop) Platform

Tauri builds produce three outputs:

1. **Webview**: Browser build for the Tauri webview
2. **Maestro**: Node.js backend for the Tauri sidecar
3. **Server**: Local server for the desktop app

Files are automatically copied to `apps/desktop_tauri/` during build.

### React Native Platform

React Native builds are still in development. The platform produces a JavaScript bundle compatible with React Native's Metro bundler.

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module 'springboard/platforms/browser'"

**Cause**: Old version of springboard installed or incorrect import path.

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 2. "Module not found: @springboardjs/platforms-*"

**Cause**: Using old import paths.

**Solution**: Update imports to new paths:
```typescript
// Old
import { ... } from '@springboardjs/platforms-browser';

// New
import { ... } from 'springboard/platforms/browser';
```

#### 3. Build fails with "esbuild" errors

**Cause**: Old configuration or plugins referencing esbuild.

**Solution**: Remove any esbuild-specific configuration and convert plugins to Vite format.

#### 4. HMR not working

**Cause**: Usually a configuration issue or conflicting plugins.

**Solution**:
1. Ensure you're using `sb dev` (not `sb build --watch`)
2. Check browser console for HMR connection errors
3. Verify no firewall is blocking WebSocket connections

#### 5. "Cannot resolve workspace:*" errors

**Cause**: pnpm workspace protocol in dependencies.

**Solution**: These are resolved during publishing. If you're developing Springboard itself, ensure you're using `pnpm install` in the monorepo root.

#### 6. TypeScript errors after migration

**Cause**: TypeScript may cache old type definitions.

**Solution**:
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
rm -rf .tsbuildinfo

# Restart TypeScript server in your IDE
```

### Build Output Comparison

Verify your build output matches the expected structure:

```
dist/
├── browser/
│   └── dist/
│       ├── index.js          # Main bundle
│       ├── index.css         # Extracted CSS
│       └── index.html        # Generated HTML
├── node/
│   └── dist/
│       └── dynamic-entry.js  # Node bundle
└── server/
    └── dist/
        └── local-server.cjs  # Server bundle
```

### Debug Mode

For detailed build information, set the `DEBUG` environment variable:

```bash
DEBUG=springboard:* sb build src/index.tsx
```

---

## FAQ

### Q: Do I need to install Vite separately?

**A**: No. Vite is a dependency of `springboard-cli` and is automatically available.

### Q: Can I use my existing vite.config.ts?

**A**: Yes, but it's optional. The CLI provides all necessary configuration by default. Use a config file only for customization.

### Q: Are esbuild plugins supported?

**A**: No. You must convert esbuild plugins to Vite plugins. The plugin API is similar but not identical.

### Q: Is the build output compatible with the old version?

**A**: Yes. The output structure and format remain compatible. The main difference is the build tool used internally.

### Q: How do I migrate a custom platform?

**A**: Create a new platform configuration in your plugin:

```typescript
export default function myPlatformPlugin(): Plugin {
  return (buildConfig) => ({
    name: 'my-platform',
    vitePlugins: () => [
      // Your platform-specific Vite plugins
    ],
  });
}
```

### Q: What happened to the @platform directive?

**A**: The `@platform` directive still works exactly the same way:

```typescript
// @platform "browser"
export function getBrowserFeature() {
  return window.localStorage;
}
// @platform end

// @platform "node"
export function getBrowserFeature() {
  return require('fs');
}
// @platform end
```

The Vite plugin `vitePluginPlatformInject` handles this transformation.

### Q: Why was this change made?

**A**: Several reasons:

1. **Better DX**: True HMR improves developer experience significantly
2. **Ecosystem**: Vite has a larger plugin ecosystem than esbuild
3. **Simplicity**: Single package reduces dependency management overhead
4. **Standards**: Vite is the de facto standard for modern JavaScript development
5. **Performance**: Pre-bundling and caching improve build times for large projects

### Q: Is this the final API?

**A**: v1.0 is the stable API. Future versions will maintain backward compatibility within the 1.x series.

---

## Need Help?

If you encounter issues during migration:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the [VITE_INTEGRATION.md](./docs/VITE_INTEGRATION.md) for technical details
3. Open an issue at https://github.com/jamtools/springboard/issues

---

## Changelog Reference

See [CHANGELOG.md](./CHANGELOG.md) for a complete list of changes in v1.0.0.
