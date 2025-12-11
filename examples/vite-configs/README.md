# Springboard Vite Configuration Examples

This directory contains examples of different ways to configure Springboard with Vite, ranging from minimal to advanced.

## Examples Overview

### 1. Minimal (`01-minimal.ts`)
The simplest possible configuration. Framework handles everything.

**Use when**: You want zero-config, just get started quickly.

```typescript
export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser'],
});
```

---

### 2. Custom Vite Config (`02-custom-vite-config.ts`)
Shows how to customize Vite to your heart's content using the `viteConfig` option.

**Use when**: You want to add your own plugins, customize build options, aliases, etc.

**Key features**:
- ✅ Add your own Vite plugins
- ✅ Customize build options (minification, sourcemaps, etc.)
- ✅ Set up aliases, CSS preprocessors
- ✅ Define custom constants
- ✅ Same config for all platforms

```typescript
export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser'],
  viteConfig: {
    // Any standard Vite config!
    plugins: [react(), visualizer()],
    server: { port: 3000 },
    build: { sourcemap: true },
    resolve: { alias: { '@': '/src' } },
  },
});
```

---

### 3. Per-Platform Config (`03-per-platform-config.ts`)
Shows how to customize Vite config **differently per platform** using a function.

**Use when**: Different platforms need different build configurations.

**Key features**:
- ✅ Function receives `(platform, baseConfig)`
- ✅ Customize browser (PWA, code splitting)
- ✅ Customize node (externals, SSR)
- ✅ Customize PartyKit (Cloudflare Workers)
- ✅ Use `mergeConfig` to extend base config

```typescript
export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node', 'partykit'],
  viteConfig: (platform, baseConfig) => {
    if (platform === 'browser') {
      return mergeConfig(baseConfig, {
        // Browser-specific config
      });
    }
    return baseConfig;
  },
});
```

---

### 4. Environment-Based (`04-environment-based.ts`)
Shows how to control which platforms build using **environment variables**.

**Use when**: You want to build only specific platforms during development.

**Key features**:
- ✅ `SPRINGBOARD_PLATFORM=browser` - only build browser
- ✅ Dynamic platform list based on env
- ✅ Dev vs prod configuration
- ✅ Fast iteration on single platform

```bash
# Build all platforms
pnpm dev

# Build only browser platform
SPRINGBOARD_PLATFORM=browser pnpm dev

# Build only node platform for production
SPRINGBOARD_PLATFORM=node pnpm build
```

---

### 5. Advanced Multi-Entry (`05-advanced-multi-entry.ts`)
Shows advanced patterns with per-platform entry points and complex configurations.

**Use when**: You need maximum control and different code per platform.

**Key features**:
- ✅ Different entry file per platform
- ✅ Multiple entry points (main + worker)
- ✅ Complex merging strategies
- ✅ Platform-specific resolve conditions

```typescript
export default springboard({
  entry: {
    browser: './src/browser-entry.tsx',
    node: './src/server-entry.ts',
  },
  platforms: ['browser', 'node'],
  viteConfig: (platform, baseConfig) => {
    // Complex merging logic
  },
});
```

---

### 6. As Vite Plugin (`06-as-vite-plugin.ts`)
Shows using Springboard **as a Vite plugin** instead of config wrapper.

**Use when**: You want FULL control over Vite config and prefer standard Vite structure.

**Key features**:
- ✅ Standard `defineConfig()` from Vite
- ✅ Springboard is just a plugin in the array
- ✅ Complete control over all Vite options
- ✅ Easier to understand for Vite veterans
- ⚠️ Multi-platform requires separate config files

```typescript
export default defineConfig({
  plugins: [
    react(),
    ...springboardPlugins({
      entry: './src/index.tsx',
      platform: 'browser',
    }),
  ],
  // Full Vite config
});
```

---

## Choosing the Right Approach

| Use Case | Recommended Example |
|----------|---------------------|
| Just getting started | `01-minimal.ts` |
| Need custom Vite plugins/config | `02-custom-vite-config.ts` |
| Different config per platform | `03-per-platform-config.ts` |
| Fast dev iteration (single platform) | `04-environment-based.ts` |
| Complex multi-platform app | `05-advanced-multi-entry.ts` |
| Prefer standard Vite structure | `06-as-vite-plugin.ts` |

---

## Common Patterns

### Only Build Browser During Dev

```typescript
const platforms = process.env.NODE_ENV === 'development'
  ? ['browser']  // Fast dev builds
  : ['browser', 'node', 'partykit']; // Full prod builds

export default springboard({
  entry: './src/index.tsx',
  platforms,
});
```

### Add Your Own Plugins

```typescript
import myPlugin from './my-vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser'],
  viteConfig: {
    plugins: [myPlugin()],
  },
});
```

### Customize Build Output

```typescript
export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser'],
  outDir: './my-custom-dist', // Change output directory
  viteConfig: {
    build: {
      sourcemap: true,
      minify: 'terser',
    },
  },
});
```

### Use Environment Variables

```typescript
export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser'],
  viteConfig: {
    define: {
      __API_URL__: JSON.stringify(process.env.API_URL),
      __VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  },
});
```

---

## API Reference

### springboard(options)

Main export - returns Vite config with Springboard plugins.

**Options**:
- `entry: string | Record<Platform, string>` - Entry point(s)
- `platforms?: Platform[]` - Target platforms (default: `['browser']`)
- `documentMeta?: DocumentMeta` - HTML metadata for browser
- `viteConfig?: UserConfig | (platform, baseConfig) => UserConfig` - Custom Vite config
- `outDir?: string` - Output directory
- `debug?: boolean` - Enable debug logging
- `partykitName?: string` - PartyKit deployment name

### springboardPlugins(options)

Alternative export - returns array of Vite plugins only (use with `defineConfig`).

**Options**:
- Same as `springboard()` but must specify `platform: Platform` (single platform)

---

## TypeScript Support

All examples have full TypeScript support:

```typescript
import type { Platform, SpringboardOptions } from 'springboard/vite-plugin';

const config: SpringboardOptions = {
  entry: './src/index.tsx',
  platforms: ['browser'],
};

export default springboard(config);
```

---

## Questions?

- See `VITE_PLUGIN_DESIGN.md` for architecture details
- See `tests/` for working test examples
- See source: `packages/springboard/vite-plugin/src/`
