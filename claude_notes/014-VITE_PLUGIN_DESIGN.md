# Springboard Vite Plugin Design

## Overview

Based on patterns from Nitro and SvelteKit, and the existing work in `springboard-mobile-test`, Springboard should provide a **single, simple Vite plugin** that hides all complexity.

## User Experience (Zero Config Goal)

### Ideal User vite.config

```typescript
import { springboard } from 'springboard/vite-plugin';

export default springboard({
  // Single entrypoint for ALL platforms (framework handles the rest)
  entry: './src/index.tsx',

  // Optional: document metadata for browser platforms
  documentMeta: {
    title: 'My App',
    description: 'My awesome app'
  },

  // Which platforms to build for
  platforms: ['browser', 'node', 'partykit', 'tauri', 'react-native'],

  // That's it! Everything else is handled by framework
});
```

### Advanced customization (if needed)

```typescript
import { springboard } from 'springboard/vite-plugin';
import { mergeConfig } from 'vite';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node'],

  // Custom Vite config per platform
  viteConfig: {
    browser: {
      // Override/extend browser config
      build: {
        rollupOptions: {
          external: ['some-package']
        }
      }
    },
    node: {
      // Override/extend node config
    }
  },

  // Or function for dynamic config
  viteConfig: (platform, baseConfig) => {
    if (platform === 'browser') {
      return mergeConfig(baseConfig, {
        // Your custom config
      });
    }
    return baseConfig;
  }
});
```

## Architecture (Learned from Nitro & SvelteKit)

### 1. Plugin Composition

Following **Nitro's pattern**, return **array of plugins** instead of single monolith:

```typescript
export function springboard(options: SpringboardOptions): Plugin[] {
  return [
    springboardInit(options),       // One-time setup
    springboardVirtual(options),    // Virtual modules
    springboardPlatform(options),   // Platform injection
    springboardBuild(options),      // Build orchestration
    springboardDev(options),        // Dev server
  ];
}
```

### 2. Multi-Environment Support

Following **SvelteKit's two-phase build**, but adapted for multiple platforms:

**Dev Mode:**
- Single Vite dev server for primary platform (usually browser)
- Watch mode for other platforms (node, etc.)
- HMR for browser, rebuild for others

**Build Mode:**
- Sequential builds for each requested platform
- Share common chunks where possible
- Platform-specific output directories

### 3. Virtual Modules

Like both frameworks, use **virtual modules** to abstract complexity:

```typescript
// User code never sees this
import initApp from 'virtual:springboard-entry';
import modules from 'virtual:springboard-modules';
```

The plugin generates these dynamically based on:
- User's entry point
- Selected platforms
- Registered modules (future: defineModule)

### 4. Platform Detection

**Automatic platform detection** based on:
- Build environment variables
- Vite's `ssrBuild` flag
- Custom `SPRINGBOARD_PLATFORM` env var

User doesn't need to manage multiple configs.

## Key Patterns from Research

### From Nitro

✅ **Return array of plugins** (not single plugin)
- Better separation of concerns
- Each plugin has focused responsibility
- Easier to maintain and test

✅ **Use `apply` hook to filter plugin behavior**
```typescript
{
  name: 'springboard-dev',
  apply: (config, { command }) => command === 'serve',
  // ...
}
```

✅ **Virtual modules for abstraction**
```typescript
resolveId(id) {
  if (id === 'virtual:springboard-entry') {
    return '\0virtual:springboard-entry';
  }
}
```

✅ **Environment management internally**
- Don't expose raw Vite environments to users
- Auto-configure based on platform

### From SvelteKit

✅ **Protected configuration**
```typescript
const enforcedConfig = {
  appType: 'custom',
  root: process.cwd(),
  // ...enforce critical settings
};
```

✅ **Two-phase builds for multi-target**
- Primary build (server/client split)
- Secondary builds triggered after primary

✅ **Virtual module adaptation per mode**
```typescript
if (config.mode === 'development') {
  return devConfig;
} else {
  return prodConfig;
}
```

✅ **Plugin guards**
- Prevent incompatible imports (e.g., server code in browser)

### From springboard-mobile-test

✅ **Simple user API** (already good!)
```typescript
springboard({
  entrypoint: './src/index.tsx',
  platforms: ['web', 'tauri', 'node'],
})
```

✅ **Virtual entry generation**
- Dynamically create entry point
- Chain core files + user entrypoint

✅ **Platform injection plugin**
- Transform `@platform` blocks
- Remove other platform code

## Implementation Plan

### Phase 1: Core Plugin Structure

**File**: `packages/springboard/vite-plugin/src/index.ts`

```typescript
import type { Plugin, UserConfig } from 'vite';

export interface SpringboardOptions {
  /** Entry point for your application */
  entry: string;

  /** Target platforms */
  platforms?: Platform[];

  /** Document metadata (for browser platforms) */
  documentMeta?: DocumentMeta;

  /** Custom Vite config per platform */
  viteConfig?: PlatformConfig | ConfigFunction;
}

export function springboard(options: SpringboardOptions): Plugin[] {
  // Validate options
  const normalizedOptions = normalizeOptions(options);

  // Return composed plugins
  return [
    springboardInit(normalizedOptions),
    springboardVirtual(normalizedOptions),
    springboardPlatform(normalizedOptions),
    springboardHtml(normalizedOptions),
    springboardBuild(normalizedOptions),
    springboardDev(normalizedOptions),
  ].filter(Boolean);
}
```

### Phase 2: Individual Plugins

#### springboardInit

**Purpose**: One-time setup, validate config, detect environment

```typescript
function springboardInit(options: NormalizedOptions): Plugin {
  return {
    name: 'springboard:init',
    enforce: 'pre',

    config(config, env) {
      // Detect current platform
      const platform = detectPlatform(env);

      // Return enforced base config
      return {
        appType: 'custom',
        root: process.cwd(),
        resolve: {
          alias: {
            'springboard': 'springboard/src',
            // Platform-specific aliases
            ...getPlatformAliases(platform),
          },
          conditions: getPlatformConditions(platform),
        },
        define: {
          __SPRINGBOARD_PLATFORM__: JSON.stringify(platform),
          __SPRINGBOARD_DEV__: env.command === 'serve',
        },
      };
    },
  };
}
```

#### springboardVirtual

**Purpose**: Create virtual entry points and modules

```typescript
function springboardVirtual(options: NormalizedOptions): Plugin {
  const VIRTUAL_ENTRY = 'virtual:springboard-entry';
  const VIRTUAL_MODULES = 'virtual:springboard-modules';

  return {
    name: 'springboard:virtual',

    resolveId(id) {
      if (id === VIRTUAL_ENTRY) return '\0' + VIRTUAL_ENTRY;
      if (id === VIRTUAL_MODULES) return '\0' + VIRTUAL_MODULES;
    },

    load(id) {
      if (id === '\0' + VIRTUAL_ENTRY) {
        return generateEntryCode(options);
      }

      if (id === '\0' + VIRTUAL_MODULES) {
        return generateModulesCode(options);
      }
    },
  };
}
```

#### springboardPlatform

**Purpose**: Transform `@platform` blocks

```typescript
function springboardPlatform(options: NormalizedOptions): Plugin {
  return {
    name: 'springboard:platform-inject',
    enforce: 'pre',

    transform(code, id) {
      // Skip node_modules
      if (id.includes('node_modules')) return null;

      // Only process JS/TS files
      if (!/\.[jt]sx?$/.test(id)) return null;

      // Check for platform blocks
      if (!code.includes('// @platform')) return null;

      const platform = options.platform;

      // Keep current platform's code, remove others
      let transformed = code.replace(
        new RegExp(`// @platform "${platform}"([\\s\\S]*?)// @platform end`, 'g'),
        '$1'
      );

      transformed = transformed.replace(
        /\/\/ @platform "(?:node|browser|fetch|react-native)"[\s\S]*?\/\/ @platform end/g,
        ''
      );

      return { code: transformed, map: null };
    },
  };
}
```

#### springboardHtml

**Purpose**: Generate HTML for browser platforms (replaces html-generate plugin)

```typescript
function springboardHtml(options: NormalizedOptions): Plugin {
  return {
    name: 'springboard:html',
    apply: 'build',

    generateBundle() {
      if (!isBrowserPlatform(options.platform)) return;

      const html = generateHtml({
        title: options.documentMeta?.title,
        meta: options.documentMeta,
        // Vite will inject scripts/styles automatically
      });

      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: html,
      });
    },
  };
}
```

#### springboardBuild

**Purpose**: Orchestrate multi-platform builds

```typescript
function springboardBuild(options: NormalizedOptions): Plugin {
  return {
    name: 'springboard:build',
    apply: 'build',

    async closeBundle() {
      // If multiple platforms, trigger additional builds
      const additionalPlatforms = options.platforms.slice(1);

      for (const platform of additionalPlatforms) {
        await buildPlatform(platform, options);
      }
    },
  };
}
```

#### springboardDev

**Purpose**: Dev server with HMR and multi-platform watch

```typescript
function springboardDev(options: NormalizedOptions): Plugin {
  return {
    name: 'springboard:dev',
    apply: 'serve',

    configureServer(server) {
      // Set up HMR for primary platform
      setupHMR(server, options);

      // Start watch mode for other platforms
      const otherPlatforms = options.platforms.filter(
        p => p !== options.platform
      );

      for (const platform of otherPlatforms) {
        startWatchBuild(platform, options);
      }
    },
  };
}
```

### Phase 3: Platform-Specific Configs

Each platform has default config that can be overridden:

```typescript
const platformConfigs: Record<Platform, () => UserConfig> = {
  browser: () => ({
    build: {
      outDir: 'dist/browser',
      rollupOptions: {
        input: 'virtual:springboard-entry',
      },
    },
  }),

  node: () => ({
    build: {
      outDir: 'dist/node',
      ssr: true,
      rollupOptions: {
        external: ['fs', 'path', 'http', /* ... */],
        output: {
          format: 'cjs',
        },
      },
    },
  }),

  partykit: () => ({
    build: {
      outDir: 'dist/partykit',
      ssr: true,
      rollupOptions: {
        external: ['cloudflare:*'],
        output: {
          format: 'esm',
        },
      },
    },
    resolve: {
      conditions: ['workerd', 'worker', 'browser'],
    },
  }),

  tauri: () => ({
    // Two builds: browser + maestro
    // Custom plugin to coordinate
  }),

  'react-native': () => ({
    build: {
      outDir: 'dist/react-native',
      lib: {
        entry: 'virtual:springboard-entry',
        formats: ['es'],
      },
    },
  }),
};
```

## Migration Path

### From Current Implementation

1. **Move plugins** from `packages/springboard/cli/src/vite_plugins/` to `packages/springboard/vite-plugin/src/plugins/`
2. **Create main export** at `packages/springboard/vite-plugin/src/index.ts`
3. **Update package.json** to export `springboard/vite-plugin`
4. **Update test app** to use new API
5. **Update CLI** to use new plugin internally

### Breaking Changes

- Users must create `vite.config.ts` (but it's simple!)
- Old CLI commands still work but now wrapp Vite
- Import paths change: `springboard-cli/vite_plugins` → `springboard/vite-plugin`

## Test Strategy

### Unit Tests

Test each plugin individually:
- `springboardInit` - config merging
- `springboardVirtual` - virtual module generation
- `springboardPlatform` - code transformation
- `springboardHtml` - HTML generation

### Integration Tests

Test plugin composition:
- All plugins work together
- Config merging is correct
- Virtual modules resolve
- Platform injection works

### E2E Tests (Vitest)

Test full workflow:

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Springboard Vite Plugin E2E', () => {
  it('builds browser platform', async () => {
    // Create test project
    // Add vite.config with springboard()
    // Run vite build
    // Verify output
  });

  it('runs dev server with HMR', async () => {
    // Start vite dev
    // Make code change
    // Verify HMR triggers
  });

  it('builds multiple platforms', async () => {
    // Config with ['browser', 'node']
    // Run build
    // Verify both outputs exist
  });
});
```

## Comparison: Before vs After

### Before (Complex)

User has to:
- Run `sb dev` CLI command
- Framework controls everything
- Hard to customize
- Multiple config points

```typescript
// No vite.config at all
// Everything through CLI flags
```

### After (Simple but Powerful)

User has:
- Simple `vite.config.ts`
- Full Vite ecosystem access
- Easy customization
- Standard Vite commands work

```typescript
// vite.config.ts
import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node'],
});
```

But framework still handles:
- ✅ Platform detection
- ✅ Virtual entry generation
- ✅ Platform code injection
- ✅ Multi-platform builds
- ✅ HTML generation
- ✅ HMR setup
- ✅ SSR config
- ✅ Optimal defaults

## Next Steps

1. ✅ Research complete (Nitro, SvelteKit, springboard-mobile-test)
2. ⚠️ Create plugin structure (this document)
3. ⏳ Implement `springboard()` function
4. ⏳ Implement individual plugins
5. ⏳ Update test app to use new API
6. ⏳ Create E2E tests
7. ⏳ Update CLI to wrap new plugin
8. ⏳ Migration guide

## Additional Considerations

### defineModule Migration

From review comments, need to replace `registerModule` with `defineModule`:

```typescript
// OLD (side effect import)
import { registerModule } from 'springboard';
registerModule(myModule);

// NEW (explicit, stateless)
import { defineModule } from 'springboard';
export const myModule = defineModule({ /* ... */ });

// Then in app startup:
import { myModule } from './modules/my-module';
springboard.registerModules([myModule]);
```

This should be coordinated with Vite plugin (virtual modules can auto-discover?)

### Backwards Compatibility

**Decision**: No backwards compatibility (per user request)

This is v1.0.0 - clean break. Document migration clearly but don't support old API.

### Platform-Specific Entrypoints

Support both patterns:

```typescript
// Single entrypoint (most common)
springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node'],
});

// Per-platform entrypoints (advanced)
springboard({
  entry: {
    browser: './src/index.browser.tsx',
    node: './src/index.node.tsx',
  },
  platforms: ['browser', 'node'],
});
```

### CLI Wrapper

Keep `sb dev` and `sb build` commands but they now:
1. Generate minimal `vite.config.ts` if missing
2. Run `vite dev` or `vite build` with appropriate flags
3. Pass through options

This maintains familiar DX while using Vite under hood.

---

**Status**: Design Complete
**Next**: Implementation
**Version**: v1.0.0
