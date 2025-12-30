# Changelog

All notable changes to Springboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2024-12-11

### Summary

Springboard v1.0.0 is a **major architectural overhaul** that introduces a Vite-based build system and consolidates all packages into a single unified package. This is a **breaking release** with no backward compatibility with v0.x.

**Migration Required**: See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for step-by-step migration instructions.

---

### Breaking Changes

#### Package Consolidation

All platform packages have been consolidated into the main `springboard` package:

| Removed Package | New Import Path |
|-----------------|-----------------|
| `springboard-server` | `springboard/server` |
| `@springboardjs/platforms-browser` | `springboard/platforms/browser` |
| `@springboardjs/platforms-node` | `springboard/platforms/node` |
| `@springboardjs/platforms-tauri` | `springboard/platforms/tauri` |
| `@springboardjs/platforms-partykit` | `springboard/platforms/partykit` |
| `@springboardjs/platforms-react-native` | `springboard/platforms/react-native` |
| `@springboardjs/plugin-svelte` | Removed (use Vite plugins directly) |
| `@springboardjs/mantine` | Removed (use Mantine directly) |
| `@springboardjs/shoelace` | Removed (use Shoelace directly) |

#### Build System

- **Replaced esbuild with Vite** - The entire build system now uses Vite
- **esbuild plugins no longer work** - Convert to Vite plugins
- **New plugin interface** - `esbuildPlugins` replaced with `vitePlugins`

#### CLI

- **Commands remain the same** but internal implementation is completely different
- **HMR is now native** - Uses Vite's built-in HMR instead of file watching
- **Configuration files** - Optional `vite.config.ts` support added

---

### Added

#### Vite Integration

- **True Hot Module Replacement (HMR)** - State-preserving updates in the browser
- **Vite dev server** - Fast development with native ESM
- **Vite plugins** - Full suite of Springboard-specific Vite plugins:
  - `vitePluginPlatformInject` - Platform-specific code transformation
  - `vitePluginHtmlGenerate` - HTML template processing
  - `vitePluginPartykitConfig` - PartyKit configuration generation
  - `vitePluginTransformAwaitImport` - CJS compatibility for Tauri
  - `vitePluginCopyFiles` - File copying for Tauri builds
  - `vitePluginLogBuildTime` - Build timing logs
  - `vitePluginSpringboardConditions` - Resolve condition configuration

#### Package Structure

- **Subpath exports** - Clean import paths like `springboard/platforms/browser`
- **Export conditions** - Platform-specific exports (`browser`, `node`, `workerd`, `react-native`)
- **TypeScript support** - Full type definitions via `typesVersions`
- **Tree-shaking** - `sideEffects: false` for optimal bundling

#### Dev Server Features

- **Coordinated HMR** - Browser HMR with server rebuild watching
- **Node.js --watch** - Automatic server restart on changes
- **Custom port** - `--port` flag for dev server
- **Graceful shutdown** - Proper cleanup on SIGINT/SIGTERM

#### Build Features

- **Multi-platform builds** - Build multiple platforms in one command
- **Platform shortcuts** - `main` = browser + node + server
- **Watch mode** - `--watch` flag for continuous builds
- **Build summary** - Detailed output with timing information

---

### Changed

#### Import Paths

```typescript
// Before (v0.x)
import springboard from 'springboard';
import server from 'springboard-server';
import { BrowserKVStore } from '@springboardjs/platforms-browser';

// After (v1.0)
import springboard from 'springboard';
import server from 'springboard/server';
import { BrowserKVStore } from 'springboard/platforms/browser';
```

#### Plugin System

```typescript
// Before (v0.x) - esbuild plugins
export default function myPlugin() {
  return (buildConfig) => ({
    esbuildPlugins: () => [/* esbuild plugins */],
  });
}

// After (v1.0) - Vite plugins
export default function myPlugin() {
  return (buildConfig) => ({
    vitePlugins: () => [/* Vite plugins */],
    editViteConfig: (config) => { /* modify config */ },
  });
}
```

#### Build Output

Output structure remains compatible but is now produced by Vite:

```
dist/
├── browser/dist/
│   ├── index.js
│   ├── index.css
│   └── index.html
├── node/dist/
│   └── dynamic-entry.js
└── server/dist/
    └── local-server.cjs
```

---

### Removed

#### Packages

- `springboard-server` - Use `springboard/server`
- `@springboardjs/platforms-*` - Use `springboard/platforms/*`
- `@springboardjs/plugin-svelte` - Use Vite's Svelte plugin directly
- `@springboardjs/mantine` - Import Mantine directly
- `@springboardjs/shoelace` - Import Shoelace directly

#### esbuild

- All esbuild plugins removed
- `esbuild` dependency removed from core
- esbuild-specific configuration no longer supported

#### Old Plugin Interface

- `esbuildPlugins` property
- `editBuildOptions` property (use `editViteConfig`)

---

### Performance

- **Faster dev server startup** - Vite's pre-bundling caches dependencies
- **Instant HMR** - Sub-second updates in development
- **Comparable build times** - Production builds are similar speed to esbuild
- **Better caching** - Vite caches transformed modules

---

### Migration

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete migration instructions including:

- Step-by-step checklist
- Import path changes
- Plugin conversion guide
- Troubleshooting common issues

---

## [0.15.0-rc9] - Previous Release

Last release before v1.0 architectural overhaul. See git history for details.

---

## Future Releases

### Planned for v1.1.0

- Parallel platform builds
- Custom Vite config merging
- Enhanced error messages
- Performance optimizations

### Planned for v1.2.0

- React Native improvements
- Additional platform support
- Plugin marketplace integration

---

## Links

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Vite Integration Docs](./docs/VITE_INTEGRATION.md)
- [Package Structure Docs](./docs/PACKAGE_STRUCTURE.md)
- [GitHub Repository](https://github.com/jamtools/springboard)
- [npm Package](https://www.npmjs.com/package/springboard)
