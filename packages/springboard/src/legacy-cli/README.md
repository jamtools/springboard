# Legacy CLI

> **DEPRECATED**: This module is part of the legacy esbuild-based CLI. Use the new Vite-based build system with `springboard/vite-plugin` instead.

## Overview

This directory contains the legacy esbuild-based build system copied from the main branch for backward compatibility with existing applications (e.g., SongDrive) that use the old API.

## Files Copied from Main Branch

The following files were copied from `origin/main:packages/springboard/cli/src/`:

| Source File (main branch) | Destination File |
|---------------------------|------------------|
| `build.ts` | `./build.ts` |
| `esbuild_plugins/esbuild_plugin_platform_inject.ts` | `./esbuild-plugins/esbuild_plugin_platform_inject.ts` |
| `esbuild_plugins/esbuild_plugin_log_build_time.ts` | `./esbuild-plugins/esbuild_plugin_log_build_time.ts` |
| `esbuild_plugins/esbuild_plugin_html_generate.ts` | `./esbuild-plugins/esbuild_plugin_html_generate.ts` |
| `esbuild_plugins/esbuild_plugin_partykit_config.ts` | `./esbuild-plugins/esbuild_plugin_partykit_config.ts` |
| `esbuild_plugins/esbuild_plugin_transform_await_import.ts` | `./esbuild-plugins/esbuild_plugin_transform_await_import.ts` |

## Modifications Made

1. **Import paths updated**: Changed relative imports to work from the new location within `src/legacy-cli/`
2. **JSDoc deprecation notices**: Added `@deprecated` tags to all exported functions and types with migration guidance
3. **Index files created**: Added `index.ts` files for clean re-exports

## Usage

### Import via subpath export (recommended):

```typescript
import {
  buildApplication,
  buildServer,
  platformBrowserBuildConfig,
  platformNodeBuildConfig,
} from 'springboard/legacy-cli';
```

### Import via main package (also available):

```typescript
import {
  buildApplication,
  buildServer,
  platformBrowserBuildConfig,
  platformNodeBuildConfig,
} from 'springboard';
```

## Available Exports

### Build Functions
- `buildApplication` - Build an application for a specific platform
- `buildServer` - Build a server bundle

### Platform Configurations
- `platformBrowserBuildConfig` - Browser platform configuration
- `platformOfflineBrowserBuildConfig` - Offline-capable browser configuration
- `platformNodeBuildConfig` - Node.js platform configuration
- `platformPartykitServerBuildConfig` - PartyKit server configuration
- `platformPartykitBrowserBuildConfig` - PartyKit browser configuration
- `platformTauriWebviewBuildConfig` - Tauri webview configuration
- `platformTauriMaestroBuildConfig` - Tauri main process configuration

### Esbuild Plugins
- `esbuildPluginPlatformInject` - Platform-specific conditional compilation
- `esbuildPluginLogBuildTime` - Build timing logs
- `esbuildPluginHtmlGenerate` - HTML file generation
- `esbuildPluginPartykitConfig` - PartyKit config generation
- `esbuildPluginTransformAwaitImportToRequire` - Dynamic import transformation

### Types
- `SpringboardPlatform`
- `EsbuildPlugin`
- `BuildConfig`
- `Plugin`
- `ApplicationBuildOptions`
- `DocumentMeta`
- `ServerBuildOptions`

## Migration Guide

Replace legacy esbuild builds with the new Vite-based system:

```typescript
// OLD (deprecated):
import { buildApplication, platformBrowserBuildConfig } from 'springboard/legacy-cli';
await buildApplication(platformBrowserBuildConfig, {
  applicationEntrypoint: './src/main.tsx',
  documentMeta: { title: 'My App' },
});

// NEW (recommended):
// vite.config.ts
import { defineConfig } from 'vite';
import springboard from 'springboard/vite-plugin';

export default defineConfig({
  plugins: [springboard()],
  // ... other configuration
});
```

## Date Copied

This code was copied from `origin/main` on 2025-12-28.
