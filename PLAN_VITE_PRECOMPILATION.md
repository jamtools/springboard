# Vite-Ready Precompilation Strategy for Springboard

## Executive Summary

This document outlines a comprehensive strategy for making Springboard's published packages (core, platforms, plugins) compatible with Vite as a development tool for consuming applications. The key insight is that the published npm packages must ship **pre-compiled JavaScript with proper export conditions** rather than TypeScript source files, while Vite plugins handle the remaining transformations during development.

---

## 1. Current Architecture Analysis

### 1.1 Custom esbuild Plugins Overview

The Springboard CLI currently uses five custom esbuild plugins in `/packages/springboard/cli/src/esbuild_plugins/`:

#### **esbuild_plugin_platform_inject.ts**
- **Purpose**: Conditional compilation based on target platform
- **Mechanism**: Removes/includes code blocks marked with `// @platform "platform"` tags
- **Platforms Supported**: `node`, `browser`, `fetch`, `react-native`
- **Currently Used For**: Compile-time platform-specific code elimination
- **Code Level**: Operates on source `.ts`/`.tsx` files during build
- **Example Usage**:
  ```typescript
  // @platform "browser"
  import React from 'react';
  // browser-specific code here
  // @platform end
  
  // @platform "node"
  import fs from 'fs';
  // node-specific code here
  // @platform end
  ```

#### **esbuild_plugin_html_generate.ts**
- **Purpose**: Generates HTML entry point with embedded script/style tags
- **Mechanism**: Reads metafile output, inserts `<script>` and `<link>` tags
- **Scope**: Application-level concern, **NOT dependency code**
- **When Used**: Build time for browser platforms
- **Vite Migration**: Can be converted to a Vite plugin or custom build step

#### **esbuild_plugin_transform_await_import.ts**
- **Purpose**: Post-build transformation of `await import()` to `require()`
- **Mechanism**: Regex replacement in final output file
- **Scope**: Node.js platform compatibility
- **When Used**: After esbuild completes for Node.js builds
- **Vite Migration**: Node.js-specific; can run as separate post-build step

#### **esbuild_plugin_partykit_config.ts**
- **Purpose**: Generates PartyKit configuration JSON
- **Mechanism**: Creates `partykit.json` from build metadata
- **Scope**: PartyKit platform-specific configuration
- **When Used**: PartyKit server build completion
- **Vite Migration**: Custom build plugin for PartyKit projects

#### **esbuild_plugin_log_build_time.ts**
- **Purpose**: Logging and monitoring only
- **Scope**: Developer experience
- **Vite Migration**: Simple plugin wrapper or build hook

### 1.2 Classification: Publish-Time vs Userland Concerns

| Plugin | Publish-Time | Userland | Reason |
|--------|:--------:|:-------:|--------|
| **platform_inject** | ✓ | | Must run once at npm package publish time; cannot ship with @platform tags |
| **html_generate** | | ✓ | Application-specific concern; should be in consuming app build |
| **transform_await_import** | ✓ | | Node.js runtime compatibility; baked into published code |
| **partykit_config** | | ✓ | Application/deployment-specific configuration |
| **log_build_time** | | ✓ | Pure logging; not needed in published packages |

---

## 2. The TypeScript in Dependencies Problem

### 2.1 Why Shipping TypeScript Doesn't Work with Vite

**The Core Issue**: Vite (and most bundlers) expect dependencies to come as **pre-compiled JavaScript with type definitions**, not TypeScript source.

#### Problems with shipping `.ts` files:

1. **Build Tool Conflicts**
   - Vite's dependency pre-bundling with esbuild expects `.js` files
   - ts-loader (if in consuming app) will recompile `.ts` files before using `.js`
   - This breaks plugin system and loader order assumptions

2. **Development Server Performance**
   - Vite's dev server speed relies on pre-bundled dependencies
   - TypeScript in node_modules bypasses pre-bundling caching
   - Every file request gets recompiled instead of served cached

3. **Compiler Version Mismatch**
   - Published package must match consuming app's TypeScript version/options
   - This creates a hard coupling between package and consumer
   - New TS options can't be adopted without package updates

4. **Import Path Confusion**
   - Consumers end up importing from `../node_modules/pkg/src/file.ts`
   - This bypasses the declared `main`/`exports` fields
   - Type checking and tooling break

5. **Module Resolution Issues**
   - Standard tools don't know how to handle `.ts` in node_modules
   - Each tool (webpack, rollup, vite, etc.) handles differently
   - No guaranteed compatibility

### 2.2 Best Practice: Pre-Compiled + Declaration Files

**The Solution**: Ship packages with:
```
dist/
├── index.js           (compiled JavaScript)
├── index.d.ts         (TypeScript declarations)
└── index.js.map       (source maps)
```

With explicit `package.json` exports pointing to `.js` files.

---

## 3. Export Conditions Feature for Contextual Imports

### 3.1 What Are Export Conditions?

Export conditions allow a single npm package to provide **different entry points** based on the **context of the consumer**:

- **Target Platform**: `node`, `browser`, `workerd` (Cloudflare)
- **Module Format**: `import` (ESM), `require` (CommonJS), `module`, `default`
- **Build Tool**: `webpack`, `rollup`, `vite`
- **Environment**: `production`, `development`

### 3.2 How Vite Uses Export Conditions

**Default Vite Resolution Order:**
```
['import', 'module', 'browser', 'default']
```

For Node.js/SSR:
```
['require', 'node', 'module', 'default']
```

**Example package.json**:
```json
{
  "name": "springboard",
  "version": "0.0.1",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "exports": {
    ".": {
      "browser": "./dist/browser/index.mjs",
      "node": {
        "import": "./dist/node/index.mjs",
        "require": "./dist/node/index.cjs"
      },
      "default": "./dist/index.mjs"
    },
    "./platforms/node": {
      "node": "./dist/platforms/node/index.mjs",
      "default": "./dist/platforms/node/stub.mjs"
    },
    "./platforms/browser": {
      "browser": "./dist/platforms/browser/index.mjs",
      "default": "./dist/platforms/browser/stub.mjs"
    }
  }
}
```

### 3.3 Benefits for Springboard

1. **Platform-Specific Exports**: Different code for browser vs Node.js automatically selected
2. **Tree-Shaking**: Unused platform code is excluded by bundlers
3. **No Runtime Overhead**: Condition resolution happens at bundle time, not runtime
4. **Vite Compatible**: Works out-of-the-box with Vite's resolver
5. **Standards-Based**: Uses Node.js standard, works across all bundlers

---

## 4. Vite's Approach: Dependencies vs Source Code

### 4.1 How Vite Treats Dependencies Differently

**Dependencies (node_modules)**:
- Pre-bundled with esbuild in dev mode for performance
- Strongly cached with `max-age=31536000,immutable` headers
- Must be valid ESM or CommonJS that esbuild can process
- Source maps optional but recommended

**Source Code**:
- Served as-is with minimal transformation
- Hot Module Replacement (HMR) enabled for fast updates
- TypeScript/JSX transformed on-demand
- No caching in dev mode

### 4.2 Implications for Springboard Packages

**For Published Packages (@springboardjs/*):**
- Must ship `.js` files compiled to ES2020+ or similar
- Vite will automatically pre-bundle in dev environments
- Vite will use declared `exports` conditions
- Type definitions (`.d.ts`) resolved separately

**For Consuming App Source:**
- Can use TypeScript, JSX, etc. directly
- Vite will transform on-demand
- Platform-specific code can use conditional imports or Vite plugins

### 4.3 Special Case: Monorepo Linked Packages

In monorepos, Vite treats linked packages differently:
- Recognized as source code, not dependencies
- NOT pre-bundled
- TypeScript source is acceptable in monorepo context
- This doesn't apply to published npm packages

---

## 5. Current State vs Vite Requirements

### 5.1 What Works Today

The `esbuild_plugin_platform_inject` is actually **a build-time solution** that:
- Removes platform-specific code blocks during compilation
- Creates platform-specific builds (browser, node, partykit, etc.)
- Results in stripped-down JavaScript files

This is **fundamentally correct** but implemented as a one-off esbuild plugin.

### 5.2 What Needs to Change

1. **Publish-Time Precompilation**
   - Current system builds multiple bundles (`dist/browser`, `dist/node`, etc.)
   - These should be pre-compiled JavaScript (✓ already are!)
   - But they're not published to npm (new requirement)

2. **Export Conditions Configuration**
   - Add `exports` field to package.json
   - Map export paths to pre-compiled outputs
   - No breaking changes to existing APIs

3. **Vite Plugin for Userland**
   - Create Vite plugins to replace user-land plugins
   - Handle remaining transformations in consuming app
   - Coordinate with export conditions

---

## 6. Proposed Precompilation Strategy

### 6.1 Three-Layer Architecture

```
Layer 1: Published npm Packages (@springboardjs/*)
├── dist/
│   ├── browser/
│   │   ├── index.js (platform-injected, no @platform tags)
│   │   ├── index.d.ts
│   │   └── index.js.map
│   ├── node/
│   │   ├── index.js (platform-injected)
│   │   ├── index.d.ts
│   │   └── index.js.map
│   └── index.js (universal/default build)
└── package.json (with exports field)

Layer 2: Consuming App Build (runs Vite)
├── src/
│   ├── App.tsx (uses import from '@springboardjs/platforms-browser')
│   └── other files
├── vite.config.ts (includes platform-condition plugin)
└── node_modules/
    └── @springboardjs/* (pre-bundled by Vite)

Layer 3: Vite Plugins (new infrastructure)
├── vite-plugin-springboard-conditions.ts
├── vite-plugin-springboard-html-gen.ts
└── vite-plugin-springboard-partykit.ts
```

### 6.2 Build Pipeline Changes

#### **Phase 1: Publish-Time Build (Already mostly done)**

```
TypeScript Source
    ↓
[esbuild with platform_inject plugin]
    ↓
Platform-Specific JavaScript (browser/node/fetch/react-native)
    ├─ dist/browser/index.js
    ├─ dist/node/index.js
    ├─ dist/fetch/index.js
    └─ dist/react-native/index.js
    ↓
[Add .d.ts generation]
    ↓
[npm publish]
```

#### **Phase 2: User-Land Build (Vite)**

```
Consuming App TypeScript
    ↓
[Vite Dev Server / vite build]
    ├─ Import from '@springboardjs/platforms-browser'
    ├─ Vite resolver checks exports conditions
    ├─ Loads dist/browser/index.js from node_modules
    ├─ Pre-bundles with esbuild (if dev mode)
    ↓
Published JavaScript (already platform-specific)
    ├─ No further platform_inject needed
    ├─ Optional: additional Vite plugins for other needs
    ↓
Final Application Bundle
```

### 6.3 Export Conditions Configuration

**For @springboardjs/core**:
```json
{
  "name": "springboard",
  "exports": {
    ".": {
      "browser": "./dist/browser/index.mjs",
      "node": {
        "import": "./dist/node/index.mjs",
        "require": "./dist/node/index.cjs"
      },
      "default": "./dist/browser/index.mjs"
    }
  }
}
```

**For @springboardjs/platforms-browser**:
```json
{
  "name": "@springboardjs/platforms-browser",
  "exports": {
    ".": "./dist/index.mjs",
    "./entrypoints/*": "./dist/entrypoints/*"
  }
}
```

**For @springboardjs/platforms-node**:
```json
{
  "name": "@springboardjs/platforms-node",
  "exports": {
    ".": "./dist/index.mjs",
    "./services/*": "./dist/services/*"
  }
}
```

---

## 7. Multi-Environment Runtime Support

### 7.1 Supported Runtimes

Springboard needs to support multiple JavaScript runtimes with different capabilities:

| Runtime | Characteristics | Export Condition | Precompile Target |
|---------|:----------------|:---------------:|:----------------:|
| **Browser** | DOM, fetch API, localStorage | `browser` | ES2020 |
| **Node.js** | fs, path, modules, native bindings | `node` | ES2020 (ES2022 for better native support) |
| **Cloudflare Workers** | fetch API, KV, Durable Objects | `workerd` | ES2020+ |
| **React Native** | Native modules, no DOM | `react-native` | ES2020 |
| **Tauri** | Both browser (WebView) and Node.js | hybrid | Browser: ES2020, Node: ES2020 |

### 7.2 Export Condition Mapping

**Recommended conditions** (in precedence order for Vite):
```json
{
  "exports": {
    ".": {
      "workerd": "./dist/workerd/index.mjs",
      "react-native": "./dist/react-native/index.mjs",
      "browser": "./dist/browser/index.mjs",
      "node": {
        "import": "./dist/node/index.mjs",
        "require": "./dist/node/index.cjs"
      },
      "default": "./dist/browser/index.mjs"
    }
  }
}
```

### 7.3 Cloudflare Workers Special Case

Cloudflare Workers uses `workerd` condition (not documented in Node.js specs but supported by Wrangler).

**Implementation**:
- Can reuse `fetch` platform code from `esbuild_plugin_platform_inject`
- Create `dist/workerd/` output using same platform-inject with `fetch` mode
- Wrangler will automatically resolve `workerd` condition

---

## 8. Build Pipeline Architecture

### 8.1 Precompilation Build Script

**New build step**: `npm run build:publish` (or integrate into standard build)

```bash
#!/bin/bash
# Build each platform separately
npm run build:publish:browser
npm run build:publish:node
npm run build:publish:fetch
npm run build:publish:react-native

# Generate .d.ts files
npm run build:types

# Validate exports field
npm run validate:exports

# Package for npm
npm pack
```

### 8.2 Esbuild Configuration per Platform

Each platform needs its own build config:

**browser/vite.config.publish.ts**:
```typescript
export default {
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Springboard',
      fileName: 'index',
      formats: ['es']  // ESM only
    },
    rollupOptions: {
      input: 'src/index.ts',
      plugins: [
        platformInjectPlugin('browser'),
        // No other transformation plugins
      ]
    }
  }
}
```

### 8.3 Gradual Migration Path

**Phase 1 (Immediate)**:
- Generate pre-compiled builds for all platforms ✓ (already done in CLI)
- Generate `.d.ts` files (using `tsc --emitDeclarationOnly`)
- Keep current esbuild pipeline as-is
- Don't break existing application builds

**Phase 2 (Next)**:
- Create Vite plugin wrapper for platform conditions
- Create Vite plugin for HTML generation
- Document for consuming apps
- Update create-springboard-app templates

**Phase 3 (Future)**:
- Deprecate esbuild CLI in favor of Vite
- Migrate app builds to Vite-native
- Full Vite ecosystem integration

---

## 9. Vite Plugin Architecture for Consuming Apps

### 9.1 vite-plugin-springboard-conditions

Automatically select platform-specific code:

```typescript
// vite-plugin-springboard-conditions.ts
import { Plugin } from 'vite'

export default function springboardConditions(options?: {
  target?: 'browser' | 'node' | 'workerd' | 'react-native'
}): Plugin {
  const target = options?.target || 'browser'
  
  return {
    name: 'springboard-conditions',
    config(config, env) {
      // Configure resolve conditions for Vite
      config.resolve ??= {}
      config.resolve.conditions ??= []
      config.resolve.conditions.push(target)
    }
  }
}
```

**Usage in user app**:
```typescript
// vite.config.ts
import springboardConditions from './vite-plugin-springboard-conditions'

export default {
  plugins: [
    springboardConditions({ target: 'browser' })
  ]
}
```

### 9.2 vite-plugin-springboard-html-gen

Replaces `esbuild_plugin_html_generate`:

```typescript
// vite-plugin-springboard-html-gen.ts
import { Plugin } from 'vite'
import fs from 'fs/promises'

export default function springboardHtmlGen(options?: {
  htmlFile?: string
  documentMeta?: Record<string, string>
}): Plugin {
  return {
    name: 'springboard-html-gen',
    apply: 'build',
    async generateBundle(output, bundle) {
      const html = await fs.readFile(options?.htmlFile || 'index.html', 'utf-8')
      // Process HTML similar to old plugin
      // Insert script tags, meta tags, etc.
    }
  }
}
```

### 9.3 vite-plugin-springboard-partykit

Generates PartyKit config:

```typescript
export default function springboardPartykit(options?: {
  configPath?: string
}): Plugin {
  return {
    name: 'springboard-partykit',
    apply: 'build',
    async writeBundle(options, bundle) {
      // Generate partykit.json from build output
    }
  }
}
```

---

## 10. TypeScript Declaration Generation

### 10.1 Declaration Files (.d.ts)

**Requirement**: Publish `.d.ts` files alongside `.js`

**Current Approach**: TypeScript source files are published
**New Approach**: Generate `.d.ts` only from TypeScript

**Build Step**:
```bash
# For each platform build
tsc src/index.ts \
  --emitDeclarationOnly \
  --declaration \
  --outDir dist/browser \
  --declarationMap
```

### 10.2 Benefits

1. **Type Safety**: Consumers get full TypeScript support
2. **Source Maps**: `.d.ts.map` points back to source for IDE navigation
3. **Compatibility**: Works with TypeScript 3.7+
4. **No Doubles**: Single `.d.ts` file per entry point, no confusion

### 10.3 Monorepo Considerations

In monorepo development:
- Can still use `tsconfig.json` to point to source
- Consumers of published packages use `.d.ts` files
- No conflicts

---

## 11. Examples from Other Frameworks

### 11.1 React/ReactDOM

**Approach**: Pre-compiled, multiple entry points, export conditions

```json
{
  "exports": {
    ".": {
      "react-server": "./server.js",
      "": "./index.js"
    },
    "./jsx-runtime": {
      "react-server": "./jsx-runtime.server.js",
      "": "./jsx-runtime.js"
    }
  }
}
```

**Key Points**:
- Multiple entry points mapped in exports
- Platform-specific code pre-compiled
- No TypeScript source published
- Uses custom conditions like "react-server"

### 11.2 Next.js

**Approach**: Export conditions for different runtimes

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "node": "./dist/node/index.js",
      "edge": "./dist/edge/index.js",
      "default": "./dist/browser/index.js"
    }
  }
}
```

**Key Points**:
- Separate builds for node, edge (Cloudflare), browser
- Types field for TypeScript resolution
- All pre-compiled before publishing

### 11.3 Axios

**Approach**: Dual CJS/ESM with conditions

```json
{
  "main": "./index.js",
  "exports": {
    ".": {
      "require": "./index.js",
      "import": "./index.mjs"
    }
  }
}
```

**Key Points**:
- Separate CJS and ESM builds
- No platform-specific code (isomorphic)
- Export conditions handle module format selection

### 11.4 Vite (itself!)

**Approach**: Multiple entry points and conditions

```json
{
  "exports": {
    ".": {
      "types": "./dist/node/index.d.ts",
      "import": "./dist/node/index.mjs",
      "require": "./dist/node/index.cjs"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "import": "./dist/client/index.mjs"
    }
  }
}
```

**Key Points**:
- Separate client and server builds
- Types field for TypeScript
- Pre-compiled for performance

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Immediate)
- [ ] Analyze current esbuild outputs in `dist/` directories
- [ ] Create `.d.ts` generation in build pipeline
- [ ] Add `exports` field to all publishable packages
- [ ] Validate with Vite consumption

### Phase 2: Vite Integration (Next Sprint)
- [ ] Create `vite-plugin-springboard-conditions`
- [ ] Create `vite-plugin-springboard-html-gen`
- [ ] Create `vite-plugin-springboard-partykit`
- [ ] Update create-springboard-app templates
- [ ] Document for consumers

### Phase 3: Deprecation & Cleanup (Future)
- [ ] Mark esbuild CLI as deprecated
- [ ] Migrate internal builds to Vite
- [ ] Remove esbuild-specific plugins
- [ ] Simplify build infrastructure

---

## 13. Validation Checklist

### Before Publishing

- [ ] All platforms compile to valid JavaScript (no `.ts` shipped)
- [ ] `.d.ts` files generated and valid
- [ ] `exports` field in package.json is correct
- [ ] Can install and import with `import from '@springboardjs/platforms-browser'`
- [ ] Vite can pre-bundle without errors
- [ ] Type checking works in consuming app

### After Publishing

- [ ] npm package contains only `.js`, `.d.ts`, `.map` files
- [ ] `npm ls` shows correct versions of dependencies
- [ ] Vite dev server starts without warnings
- [ ] Vite build succeeds
- [ ] Created app with `create-springboard-app` works with Vite

---

## 14. FAQ & Troubleshooting

### Q: Why can't we ship TypeScript directly?

**A**: Vite's dependency pre-bundling expects compiled JavaScript. Shipping TypeScript:
- Bypasses pre-bundling caching
- Requires every consumer to have TypeScript compiler
- Creates version coupling between package and consumers
- Breaks standard Node.js module resolution

### Q: How does this differ from monorepo development?

**A**: 
- **Monorepo (development)**: TypeScript source is fine; linked packages treated as source code
- **Published package (npm)**: Must be pre-compiled JavaScript; linked or not

### Q: What if users want to modify Springboard code?

**A**: 
- Source code stays in repo with full types
- Users can still fork and modify
- Source maps (`.js.map`) point to original TypeScript for debugging
- This is standard practice for published packages

### Q: Will this break existing code?

**A**: No, as long as:
- API surface doesn't change (it won't)
- Exports field points to compatible JavaScript
- No breaking changes to platform interfaces

Existing applications can continue using the old CLI build process.

### Q: How do we handle future platforms?

**A**: Follow the same pattern:
1. Add platform to `esbuild_plugin_platform_inject`
2. Add export condition to package.json
3. Build separate output for new platform
4. Create Vite plugin if needed

---

## 15. Technical Deep Dive: Export Conditions Resolution

### 15.1 How Vite Resolves Exports

When app imports: `import x from '@springboardjs/platforms-browser'`

Vite resolver:
```
1. Check package.json exports.".browser"
2. If found, use that path
3. Else check exports."."
4. Check conditions: ['import', 'module', 'browser', 'default']
5. Return first matching condition
```

### 15.2 Precedence Rules

**For ESM import** (what Vite uses in dev):
```
import > module > browser > default
```

**Configuration in exports**:
```json
{
  "exports": {
    ".": {
      "import": "./dist/index.mjs",     // First
      "module": "./dist/index.mjs",     // Second
      "browser": "./dist/browser.mjs",  // Third
      "default": "./dist/fallback.mjs"  // Fourth
    }
  }
}
```

### 15.3 Custom Conditions

Vite allows custom conditions:
```typescript
// vite.config.ts
export default {
  resolve: {
    conditions: ['custom-condition']
  }
}
```

Could use for Springboard-specific variations, but probably unnecessary with standard conditions.

---

## 16. Summary of Changes Required

### New/Modified Files

| File | Type | Purpose |
|------|:----:|---------|
| `packages/springboard/*/package.json` | Modified | Add `exports` field |
| `scripts/build-publish.ts` | New | Publish-time build script |
| `vite-plugins/springboard-conditions.ts` | New | Vite plugin for conditions |
| `vite-plugins/springboard-html-gen.ts` | New | Vite plugin for HTML generation |
| `vite-plugins/springboard-partykit.ts` | New | Vite plugin for PartyKit |
| `docs/MIGRATION_VITE.md` | New | Migration guide for consumers |

### Existing Code Impact

| File | Change | Reason |
|------|:------:|--------|
| `packages/springboard/cli/src/esbuild_plugins/*` | Keep as-is | Still used for publish-time builds |
| `packages/springboard/*/src/**` | No change | TypeScript source unchanged |
| Application build pipeline | Optional | Can migrate to Vite plugins gradually |

---

## 17. Conclusion

The path to Vite compatibility requires:

1. **Pre-compiling at publish time** (mostly already done)
2. **Removing TypeScript source from npm** (new requirement)
3. **Adding export conditions** to package.json (new requirement)
4. **Creating Vite plugins** for consuming apps (optional but recommended)

This approach:
- Maintains backward compatibility
- Enables Vite optimization (pre-bundling, caching)
- Follows industry standards (React, Vue, Next.js, etc.)
- Doesn't require changes to Springboard API
- Enables gradual migration path

The heavy lifting (multi-platform builds) is already done by `esbuild_plugin_platform_inject`. Now it's about exposing those builds correctly via package.json and creating the necessary Vite plugins for consuming applications.

