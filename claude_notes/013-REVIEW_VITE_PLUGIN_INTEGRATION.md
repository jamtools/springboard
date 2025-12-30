# Vite Plugin Integration - Architectural Review

**Date:** 2025-12-21
**Reviewer:** Architecture Review Board
**Status:** CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

### Overall Assessment: NEEDS REFACTORING

The Vite plugin implementation has **fundamental architectural issues** that compromise its reliability and deviate from industry best practices. While the plugin composition pattern (returning `Plugin[]`) is valid per Vite standards, the implementation suffers from:

1. **CRITICAL**: Contradictory SSR configuration creating React bundling conflicts
2. **CRITICAL**: Race conditions in multi-platform builds due to dynamic imports
3. **CRITICAL**: Hook timing misunderstanding (writeBundle vs closeBundle)
4. **HIGH**: API duplication (`springboard()` vs `springboardPlugins()`)
5. **HIGH**: Missing error boundaries and rollback mechanisms
6. **MEDIUM**: Inconsistent config merging strategy
7. **MEDIUM**: Virtual module resolution vulnerabilities

**Recommendation:** Do NOT ship this implementation without addressing critical issues. A 2-3 day refactoring sprint is required.

---

## API Design Review

### Plugin[] Return Pattern: VALID BUT POORLY IMPLEMENTED

**Current Implementation:**
```typescript
export function springboard(options: SpringboardOptions): Plugin[] {
    const plugins: (Plugin | null)[] = [
        springboardInit(normalized),
        springboardVirtual(normalized),
        springboardPlatform(normalized),
        springboardHtml(normalized),
        springboardBuild(normalized),
        springboardDev(normalized),
    ];
    return plugins.filter((p): p is Plugin => p !== null);
}
```

#### What's Correct

Per Vite documentation, returning `Plugin[]` is explicitly supported:
- "Plugins can return presets including several plugins as a single element"
- "The array will be flattened internally"
- Examples in official docs show framework plugins returning arrays

**Sources:**
- [Using Plugins | Vite](https://vite.dev/guide/using-plugins)
- [Plugin API | Vite](https://vite.dev/guide/api-plugin)

#### What's Wrong

1. **Unnecessary API Duplication**
   ```typescript
   // WHY DO WE HAVE BOTH OF THESE?
   springboard(options): Plugin[]          // Main API
   springboardPlugins(options, platform): Plugin[]  // Almost identical
   ```

   **Problem:** The ONLY difference is `springboardPlugins()` accepts an optional `platform` parameter. This creates:
   - Confusion about which API to use
   - Maintenance burden (two code paths to maintain)
   - No clear semantic distinction

   **Industry Pattern (Nitro/Nuxt):**
   ```typescript
   // Nitro exposes ONE primary API
   export function nitro(config): NitroConfig

   // Internal utilities are NOT exported as alternative APIs
   function createNitroInline(config, platform) { ... }
   ```

2. **defineSpringboardConfig() is Redundant**
   ```typescript
   export function defineSpringboardConfig(options): UserConfig {
       return { plugins: springboard(options) };
   }
   ```

   **Problem:** This is literally just a wrapper that adds `plugins: []`. Users can do this themselves:
   ```typescript
   // Current (unnecessary wrapper)
   export default defineSpringboardConfig({ ... })

   // What users should write
   export default defineConfig({
       plugins: springboard({ ... })
   })
   ```

   The function provides ZERO value and creates confusion about the "right" way to configure.

#### Recommendation

```typescript
// SINGLE API - platform selection via options or env
export function springboard(options: SpringboardOptions): Plugin[] {
    // Platform detection logic moved here
    const platform = options._internalPlatform
        ?? process.env.SPRINGBOARD_PLATFORM
        ?? options.platforms[0];

    validateOptions(options);
    const normalized = normalizeOptions(options, platform);

    return [
        springboardInit(normalized),
        springboardVirtual(normalized),
        springboardPlatform(normalized),
        springboardHtml(normalized),
        springboardBuild(normalized),
        springboardDev(normalized),
    ].filter(Boolean);
}

// REMOVE springboardPlugins() entirely
// REMOVE defineSpringboardConfig() entirely
```

---

## Plugin Composition Analysis

### Architecture: 6 Plugins with Clear Separation

```
springboard:init          (enforce: pre)  - Base config, defines, resolve conditions
springboard:virtual       (no enforce)    - Virtual module resolution
springboard:platform      (enforce: pre)  - @platform block transformation
springboard:html          (no enforce)    - HTML generation (browser only)
springboard:build         (apply: build)  - Multi-platform build orchestration
springboard:dev           (apply: serve)  - Watch mode + HMR
```

#### What's Correct

- **Single Responsibility**: Each plugin has a focused purpose
- **Conditional Application**: HTML plugin returns `null` for non-browser platforms
- **Proper Enforcement**: `enforce: pre` on init/platform for early execution
- **Apply Filters**: build/dev plugins use `apply` to run only when needed

#### What's Wrong

1. **Plugin Ordering Not Guaranteed**

   The array order implies execution order, but Vite does NOT guarantee this. Plugins are sorted by:
   1. `enforce: 'pre'` plugins
   2. Normal plugins (no enforce)
   3. Vite core plugins
   4. `enforce: 'post'` plugins

   **Current assumption (WRONG):**
   ```typescript
   // This order is NOT enforced by Vite
   return [
       springboardInit(normalized),      // Must run first?
       springboardVirtual(normalized),   // Then this?
       springboardPlatform(normalized),  // Then this?
       ...
   ];
   ```

   **Reality:**
   - `springboardInit` (pre) runs first ✓
   - `springboardPlatform` (pre) runs first ✓
   - `springboardVirtual`, `springboardHtml`, `springboardBuild`, `springboardDev` can run in ANY order

   **Problem:** If `springboardVirtual` resolves a module before `springboardBuild` has set the platform context, you get wrong entry code.

2. **No Shared State Management**

   Each plugin receives `NormalizedOptions` but has no way to communicate runtime state:
   ```typescript
   // What if springboardBuild needs to tell springboardDev about a build error?
   // What if springboardVirtual needs to know if HTML generation succeeded?
   ```

   **Industry Pattern (Nuxt):**
   ```typescript
   // Nuxt uses a shared context object
   const nuxt = createNuxt(config);
   nuxt.hook('build:before', async () => {
       // Plugins can register hooks on shared context
   });
   ```

3. **Missing Plugin Communication**

   No event system or hook registration for plugins to coordinate:
   ```typescript
   // MISSING: How does springboardBuild notify other plugins when a platform build completes?
   // MISSING: How does springboardDev know when springboardBuild has spawned a child process?
   ```

#### Recommendation

Add a shared context with hooks:

```typescript
interface SpringboardContext {
    options: NormalizedOptions;
    hooks: Hookable; // Use unjs/hookable
    state: {
        buildPlatforms: Set<Platform>;
        activePlatform: Platform;
        buildErrors: Map<Platform, Error>;
    };
}

// In each plugin
export function springboardBuild(ctx: SpringboardContext): Plugin {
    return {
        name: 'springboard:build',
        async writeBundle() {
            await ctx.hooks.callHook('platform:build:complete', platform);
        }
    };
}
```

---

## Integration Points Assessment

### CRITICAL ISSUE: writeBundle Hook Misunderstanding

**Current Code (build.ts:53):**
```typescript
/**
 * Build end hook - trigger additional platform builds
 * Use writeBundle instead of closeBundle to ensure the current build
 * completes fully before triggering additional platform builds
 */
async writeBundle() {
    const duration = Date.now() - buildStartTime;
    logger.info(`Build completed in ${duration}ms`);

    // Trigger additional platform builds
    for (const platform of remainingPlatforms) {
        await buildPlatform(platform, options, logger);
    }
}
```

**The Comment is WRONG. Here's why:**

Per Rollup/Vite documentation:
- `writeBundle`: Called after files are written to disk
- `closeBundle`: Called as the VERY LAST hook

**Source:** [RFC: Sequential support for writeBundle closeBundle plugin hooks](https://github.com/vitejs/vite/discussions/13175)

The comment claims "writeBundle ensures the current build completes fully" but this is **backwards**:

1. `writeBundle` fires BEFORE `closeBundle`
2. If you want to run AFTER everything is done, use `closeBundle`
3. `writeBundle` can run while other plugins are still finalizing

**The Real Problem:**

The original `closeBundle` was likely correct. The issue wasn't the hook choice - it was the **recursive build spawning**.

```typescript
// buildPlatform() dynamically imports vite and calls build()
async function buildPlatform(platform, options) {
    const { build } = await import('vite');  // DANGER: Dynamic import

    await build({
        configFile: false,
        plugins: springboardPlugins(...)  // Spawns NEW Vite process
    });
}
```

**Race Condition:**
1. Platform A build hits `writeBundle` hook
2. Spawns Platform B build via `build()`
3. Platform B build starts while Platform A's `generateBundle` hooks are still running
4. Platform B's init plugin runs `config()` hook
5. Platform A's HTML plugin is still injecting scripts
6. CONFLICT: Both writing to shared state/files

**Correct Solution:**

Use a build queue with proper sequencing:

```typescript
async writeBundle() {
    // Only first platform orchestrates builds
    if (!isFirstPlatform(options)) return;

    // Wait for ALL plugins to finish (including closeBundle)
    await this.buildEnd?.(); // Rollup lifecycle guarantee

    // NOW spawn child builds sequentially
    for (const platform of remainingPlatforms) {
        await buildPlatformInChild(platform); // Fork process, don't import vite
    }
}
```

Or use `closeBundle` correctly:

```typescript
async closeBundle() {
    // This GUARANTEES all other plugins have finished
    if (!isFirstPlatform(options)) return;

    for (const platform of remainingPlatforms) {
        await buildPlatform(platform);
    }
}
```

**Sources:**
- [How to execute a plugin after assets are fully generated?](https://github.com/vitejs/vite/discussions/11043)
- [buildEnd and closeBundle hooks](https://github.com/vitejs/vite/discussions/8293)
- [Plugin Development | Rollup](https://rollupjs.org/plugin-development/)

### CRITICAL ISSUE: Multi-Platform Build Race Conditions

**Problem Flow:**

```typescript
// build.ts:89-136
async function buildPlatform(platform, options, logger) {
    setPlatformEnv(platform);  // Sets process.env.SPRINGBOARD_PLATFORM

    const { build } = await import('vite');  // Dynamic import
    const { springboardPlugins } = await import('../index.js');  // CIRCULAR IMPORT

    await build({
        configFile: false,
        plugins: springboardPlugins({ ... }, platform),
        root: options.root,
    });
}
```

**Issues:**

1. **Dynamic Import Circular Dependency**
   - `build.ts` imports from `../index.js`
   - `index.js` imports `springboardBuild` from `build.ts`
   - At runtime, `buildPlatform()` does `await import('../index.js')`
   - This can cause module initialization ordering issues

2. **Shared Process Environment Pollution**
   ```typescript
   setPlatformEnv(platform);  // Sets process.env.SPRINGBOARD_PLATFORM

   await build({ ... });  // Child build reads same process.env

   clearPlatformEnv();  // Too late - child build already read it
   ```

   If Platform B build starts while Platform A is in `setPlatformEnv('A')`, Platform B will see Platform A's env vars.

3. **No Build Isolation**
   - All builds run in same Node.js process
   - Share the same module cache
   - Share the same global state
   - No error boundaries between platform builds

**Correct Pattern (Nitro/Unbuild):**

Nitro uses a build coordinator with process isolation:

```typescript
// Nitro's approach
async function buildPresets(nitro) {
    for (const preset of nitro.presets) {
        await buildPreset(nitro, preset);  // Sequential builds
    }
}

async function buildPreset(nitro, preset) {
    const worker = new Worker('./preset-builder.js', {
        workerData: { preset, config: nitro.config }
    });

    return new Promise((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
    });
}
```

**Recommended Fix:**

Either fork child processes OR use a build queue with isolation:

```typescript
import { fork } from 'node:child_process';

async function buildPlatform(platform, options, logger) {
    // Option 1: Fork child process
    return new Promise((resolve, reject) => {
        const child = fork('./build-worker.js', {
            env: {
                ...process.env,
                SPRINGBOARD_PLATFORM: platform,
            },
            serialization: 'advanced',
        });

        child.on('message', (msg) => {
            if (msg.type === 'complete') resolve();
            if (msg.type === 'error') reject(msg.error);
        });
    });
}

// OR Option 2: Sequential builds with cleanup
async function buildPlatform(platform, options, logger) {
    const buildId = crypto.randomUUID();

    try {
        const isolatedOptions = createIsolatedOptions(options, platform);
        const { build } = await import('vite');

        await build({
            configFile: false,
            plugins: createFreshPlugins(isolatedOptions), // Don't reuse instances
            root: options.root,
            build: {
                ...isolatedOptions.build,
                emptyOutDir: false, // Don't delete other platform outputs
            },
        });
    } catch (error) {
        logger.error(`Build failed for ${platform}: ${error.message}`);
        throw new BuildError(platform, error);
    } finally {
        clearPlatformState(buildId);
    }
}
```

---

## Platform Config Correctness

### CRITICAL ISSUE: Contradictory SSR + noExternal Configuration

**Node Platform Config (platform-configs.ts:91-140):**
```typescript
export function getNodeConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            ssr: true,
            rollupOptions: {
                external: [
                    ...NODE_BUILTINS,
                    'react',           // React is external
                    'react-dom',
                    'react-dom/server',
                    'react/jsx-runtime',
                    // ...
                ],
            },
        },
        ssr: {
            target: 'node',
            noExternal: true,  // CONTRADICTION: Bundle everything
        },
    };
}
```

**PartyKit Platform Config (platform-configs.ts:145-190):**
```typescript
export function getPartykitConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            ssr: true,
            rollupOptions: {
                external: [
                    'react',           // React is external
                    'react-dom',
                    'react-dom/server',
                    // ...
                ],
            },
        },
        ssr: {
            target: 'webworker',
            noExternal: true,  // CONTRADICTION: Bundle everything
        },
    };
}
```

**The Problem:**

```typescript
ssr: {
    noExternal: true,  // "Bundle ALL dependencies into the output"
}

rollupOptions: {
    external: ['react', 'react-dom', ...]  // "DON'T bundle React"
}
```

**Which wins?** According to Vite's resolution order:

1. `build.rollupOptions.external` is processed by Rollup
2. `ssr.noExternal` is processed by Vite's SSR externalization logic
3. `ssr.noExternal: true` overrides `rollupOptions.external`

**Result:** React WILL be bundled, despite being listed in `external`.

**Verification:**
```bash
# Build and check output
vite build
grep -r "createElement" dist/node/index.js
# If React is bundled, you'll see React's source code
```

**Why This is Wrong:**

1. **Package Duplication**: If user's app imports React, you now have 2 copies
2. **Version Conflicts**: Bundled React version may differ from runtime React
3. **Size Bloat**: React is 130KB minified - shouldn't be in server bundle
4. **Peer Dependency Violations**: React should be provided by the consuming app

**Correct Configuration:**

```typescript
export function getNodeConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            ssr: true,
            rollupOptions: {
                external: [
                    ...NODE_BUILTINS,
                    'react',
                    'react-dom',
                    'react-dom/server',
                    'react/jsx-runtime',
                    /^react\//,
                ],
            },
        },
        ssr: {
            target: 'node',
            // OPTION 1: List specific packages to bundle (recommended)
            noExternal: [
                // Only bundle packages that need bundling
                'some-esm-only-package',
                'another-package-to-bundle',
            ],

            // OPTION 2: Use external instead (clearer)
            external: [
                'react',
                'react-dom',
                'react-dom/server',
                'react/jsx-runtime',
                /^react\//,
                'springboard',
                /^springboard\//,
            ],
        },
    };
}
```

**Better Yet - Use Vite's SSR Externalization API:**

```typescript
ssr: {
    target: 'node',
    external: [
        'react',
        'react-dom',
        'springboard',
    ],
    // Let Vite auto-detect other externals from package.json
}
```

### Browser Platform Config: CORRECT

```typescript
export function getBrowserConfig(options: NormalizedOptions): UserConfig {
    return {
        build: {
            target: 'esnext',
            rollupOptions: {
                // NO external - bundle everything for browser
                output: { format: 'es' },
            },
        },
        // NO ssr config - this is client-side
    };
}
```

This is correct - browser builds should bundle all dependencies including React.

---

## Virtual Modules Review

### Implementation: Simple and Correct

**Module Resolution (virtual.ts:40-57):**
```typescript
resolveId(id: string) {
    if (id === VIRTUAL_MODULES.ENTRY) {
        return RESOLVED_VIRTUAL_MODULES.ENTRY;  // '\0virtual:springboard-entry'
    }
    // ...
}
```

**Module Content Generation (virtual.ts:62-82):**
```typescript
load(id: string) {
    if (id === RESOLVED_VIRTUAL_MODULES.ENTRY) {
        return generateEntryCode(options);
    }
    // ...
}
```

#### What's Correct

- Uses Vite's `\0` prefix convention for virtual modules
- Generates code dynamically based on platform
- Clean separation between resolution and content generation

#### What's Wrong

1. **No Module Caching**

   Every time `load()` is called, `generateEntryCode()` re-runs:
   ```typescript
   load(id: string) {
       if (id === RESOLVED_VIRTUAL_MODULES.ENTRY) {
           logger.debug('Loading virtual entry module');
           const code = generateEntryCode(options);  // Regenerates every time
           return code;
       }
   }
   ```

   While this is fast for simple templates, it's wasteful. Industry pattern:
   ```typescript
   const moduleCache = new Map<string, string>();

   load(id: string) {
       if (id === RESOLVED_VIRTUAL_MODULES.ENTRY) {
           if (!moduleCache.has(id)) {
               moduleCache.set(id, generateEntryCode(options));
           }
           return moduleCache.get(id);
       }
   }
   ```

2. **Missing HMR Support**

   If `options` change during dev, virtual modules aren't invalidated:
   ```typescript
   // MISSING: How do virtual modules update when config changes?
   handleHotUpdate({ file, server, modules }) {
       if (configFileChanged(file)) {
           // Invalidate virtual modules
           const entryModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULES.ENTRY);
           if (entryModule) {
               server.moduleGraph.invalidateModule(entryModule);
               return [entryModule];
           }
       }
   }
   ```

3. **No Error Handling in Generated Code**

   Generated entry code has no try/catch:
   ```typescript
   // generateBrowserEntry() output:
   import { initBrowser } from 'springboard/platforms/browser';
   import './src/index.tsx';  // What if this throws?
   const app = initBrowser();  // What if this fails?
   export default app;
   ```

   Should wrap in error boundary:
   ```typescript
   import { initBrowser } from 'springboard/platforms/browser';

   let app;
   try {
       await import('./src/index.tsx');
       app = initBrowser();
   } catch (error) {
       console.error('[springboard] Failed to initialize:', error);
       app = { error, platform: 'browser' };
   }

   export default app;
   ```

---

## Comparison to Industry Patterns

### Nitro (Nuxt's Server Framework)

**What Nitro Does Better:**

1. **Single Primary API**
   ```typescript
   // Nitro has ONE main export
   export function createNitro(config: NitroConfig): Promise<Nitro>

   // NOT:
   export function createNitro(config): Nitro
   export function createNitroPlugins(config, preset): Plugin[]
   export function defineNitroConfig(config): NitroConfig
   ```

2. **Build Queue with Proper Isolation**
   ```typescript
   // Nitro builds presets sequentially with cleanup
   async function build(nitro: Nitro) {
       for (const preset of nitro.options.presets) {
           const builder = await createBuilder(preset);
           await builder.build();
           await builder.cleanup();
       }
   }
   ```

3. **Shared Context with Hooks**
   ```typescript
   const nitro = await createNitro(config);

   nitro.hooks.hook('build:before', async () => {
       // Plugins can coordinate via hooks
   });

   nitro.hooks.hook('dev:reload', async () => {
       // Trigger reloads across presets
   });
   ```

4. **Plugin Registration System**
   ```typescript
   // Nitro plugins register themselves
   export default defineNitroPlugin((nitroApp) => {
       nitroApp.hooks.hook('request', (event) => {
           // Handle requests
       });
   });
   ```

**What Springboard Does Better:**

1. **Simpler API Surface** - Nitro's API is more complex
2. **Clearer Platform Concept** - Nitro uses "presets" which is more abstract
3. **Virtual Module Pattern** - More straightforward than Nitro's #imports

**Sources:**
- [Nuxt Configuration v4](https://nuxt.com/docs/4.x/api/nuxt-config)
- [Nitro · Nuxt Kit v4](https://nuxt.com/docs/4.x/api/kit/nitro)

### Vite's Official Plugin Pattern

**From Vite Documentation:**

```typescript
// Framework plugins return arrays
export default function framework(config) {
    return [
        frameworkRefresh(config),
        frameworkDevtools(config),
    ]
}
```

**Springboard follows this correctly** - the `Plugin[]` return is idiomatic.

**Where Springboard deviates:**

Vite plugins typically use factory closure for shared state:

```typescript
export default function viteReact(options) {
    let config;
    let shouldTransform;

    // All plugins in array share this closure
    return [
        {
            name: 'vite:react-refresh',
            configResolved(resolvedConfig) {
                config = resolvedConfig;
                shouldTransform = config.command === 'serve';
            },
        },
        {
            name: 'vite:react-jsx',
            transform(code, id) {
                if (!shouldTransform) return;  // Access shared state
                // ...
            }
        }
    ]
}
```

Springboard creates plugins independently without shared closure:

```typescript
export function springboard(options) {
    const normalized = normalizeOptions(options);

    return [
        springboardInit(normalized),    // Independent
        springboardVirtual(normalized), // Independent
        // No shared state between them
    ];
}
```

---

## Issues & Anti-Patterns Found

### Critical Issues (Must Fix Before Ship)

1. **SSR Config Contradiction**
   - **Location:** `platform-configs.ts:130, 179`
   - **Impact:** React and other externals will be bundled despite `external: ['react']`
   - **Fix:** Remove `noExternal: true` or use `external` array in SSR config
   - **Severity:** CRITICAL - Causes bundle bloat and version conflicts

2. **Race Conditions in Multi-Platform Builds**
   - **Location:** `build.ts:89-136`
   - **Impact:** Platform builds can interfere with each other
   - **Fix:** Use process.fork() or sequential build queue with isolation
   - **Severity:** CRITICAL - Can cause build failures

3. **writeBundle Hook Misunderstanding**
   - **Location:** `build.ts:53`
   - **Impact:** Builds may start before previous build fully completes
   - **Fix:** Use `closeBundle` or add proper build lifecycle management
   - **Severity:** CRITICAL - The comment justifying the choice is incorrect

### High Priority Issues

4. **API Duplication**
   - **Location:** `index.ts:84, 117, 140`
   - **Impact:** Confusion, maintenance burden
   - **Fix:** Remove `springboardPlugins()` and `defineSpringboardConfig()`
   - **Severity:** HIGH - Creates unclear API surface

5. **Circular Dynamic Import**
   - **Location:** `build.ts:107`
   - **Impact:** Potential module initialization issues
   - **Fix:** Refactor to avoid runtime import of parent module
   - **Severity:** HIGH - Can cause unpredictable behavior

6. **Missing Error Boundaries**
   - **Location:** `build.ts:89`, `virtual.ts:65`, `dev.ts:126`
   - **Impact:** Single platform failure crashes entire build
   - **Fix:** Add try/catch with proper error recovery
   - **Severity:** HIGH - Poor error resilience

### Medium Priority Issues

7. **No Plugin Communication**
   - **Location:** All plugins
   - **Impact:** Plugins can't coordinate or share state
   - **Fix:** Add shared context with hooks (like Nitro)
   - **Severity:** MEDIUM - Limits extensibility

8. **Shallow Config Merging**
   - **Location:** `init.ts:113-139`
   - **Impact:** User's nested config can be overwritten
   - **Fix:** Use deep merge utility
   - **Severity:** MEDIUM - User customization limited

9. **No Virtual Module Invalidation**
   - **Location:** `virtual.ts`
   - **Impact:** Config changes don't update virtual modules in dev
   - **Fix:** Add HMR invalidation logic
   - **Severity:** MEDIUM - Poor DX

### Low Priority Issues

10. **No Module Caching**
    - **Location:** `virtual.ts:62`
    - **Impact:** Minor performance overhead
    - **Fix:** Cache generated module content
    - **Severity:** LOW - Performance is acceptable

11. **Environment Variable Pollution**
    - **Location:** `build.ts:97`
    - **Impact:** Platform env vars can leak between builds
    - **Fix:** Use isolated execution context
    - **Severity:** LOW - Already has cleanup in finally block

---

## Recommendations

### Immediate Actions (Before Merge)

1. **Fix SSR Configuration**
   ```typescript
   // In platform-configs.ts
   ssr: {
       target: 'node',
       external: [
           'react',
           'react-dom',
           'react-dom/server',
           'springboard',
       ],
       // REMOVE: noExternal: true
   }
   ```

2. **Fix Multi-Platform Build Isolation**
   ```typescript
   // In build.ts
   async function buildPlatform(platform, options, logger) {
       return new Promise((resolve, reject) => {
           const child = fork('./build-worker.js', {
               env: { SPRINGBOARD_PLATFORM: platform },
           });
           child.on('exit', (code) => {
               code === 0 ? resolve() : reject(new Error(`Build failed: ${code}`));
           });
       });
   }
   ```

3. **Remove API Duplication**
   - Delete `springboardPlugins()` function
   - Delete `defineSpringboardConfig()` function
   - Update documentation to show single API usage

4. **Use closeBundle Hook Correctly**
   ```typescript
   // In build.ts - change writeBundle to closeBundle
   async closeBundle() {
       // This guarantees all plugins have finished
       if (!isFirstPlatform(options)) return;

       for (const platform of remainingPlatforms) {
           await buildPlatform(platform, options, logger);
       }
   }
   ```

### Short-Term Improvements (Next Sprint)

5. **Add Shared Context**
   ```typescript
   interface SpringboardContext {
       hooks: Hookable;
       state: Map<string, any>;
       logger: Logger;
   }

   function createContext(options): SpringboardContext {
       return {
           hooks: createHooks(),
           state: new Map(),
           logger: createLogger('springboard'),
       };
   }
   ```

6. **Add Error Boundaries**
   ```typescript
   async function buildPlatform(platform, options, logger) {
       try {
           await buildPlatformInternal(platform, options, logger);
           await ctx.hooks.callHook('platform:build:success', platform);
       } catch (error) {
           await ctx.hooks.callHook('platform:build:error', platform, error);

           if (options.failFast) throw error;

           logger.error(`Platform ${platform} failed: ${error.message}`);
           return { platform, error };
       }
   }
   ```

7. **Deep Merge User Config**
   ```typescript
   import { mergeConfig } from 'vite';

   function mergeConfigs(base: UserConfig, override: UserConfig): UserConfig {
       return mergeConfig(base, override);  // Use Vite's built-in deep merge
   }
   ```

### Long-Term Architecture (Future)

8. **Plugin Registry System**
   ```typescript
   // Allow users to register custom platform plugins
   export function defineSpringboardPlugin(plugin: SpringboardPlugin) {
       // Register custom transformers, build hooks, etc.
   }
   ```

9. **Build Orchestration Refactor**
   - Extract build orchestration to separate package
   - Use worker threads or child processes for isolation
   - Add build caching and incremental builds
   - Support parallel builds for independent platforms

10. **Virtual Module Registry**
    ```typescript
    // Let users register custom virtual modules
    springboard({
        virtualModules: {
            'virtual:my-config': () => generateMyConfig(),
        }
    })
    ```

---

## Test Coverage Gaps

Based on the codebase review, these scenarios are NOT covered:

1. **Multi-platform race conditions** - No test for concurrent builds
2. **SSR externalization** - No test verifying React is NOT bundled
3. **Hook execution order** - No test verifying plugin lifecycle
4. **Error recovery** - No test for platform build failure handling
5. **Config merging** - No test for deep merge of user config
6. **Virtual module invalidation** - No test for HMR on config change
7. **Environment isolation** - No test for process.env cleanup

### Required Test Cases

```typescript
describe('Multi-platform builds', () => {
    it('should not have race conditions when building platforms sequentially', async () => {
        const results = [];
        await buildAll(['browser', 'node', 'partykit'], {
            onPlatformComplete: (p) => results.push(p)
        });
        expect(results).toEqual(['browser', 'node', 'partykit']);
    });

    it('should isolate platform builds', async () => {
        // Trigger error in 'node' platform
        // Verify 'browser' platform still succeeds
    });
});

describe('SSR configuration', () => {
    it('should NOT bundle React in node/partykit builds', async () => {
        const bundle = await build({ platforms: ['node'] });
        const code = await fs.readFile(bundle.output, 'utf-8');
        expect(code).not.toContain('createElement'); // React's source
        expect(code).toContain('require("react")'); // External require
    });
});
```

---

## Final Verdict

### Ship Readiness: NO

**Blocking Issues:**
1. SSR configuration will cause React bundling bugs in production
2. Multi-platform builds have race conditions that can cause build failures
3. Hook timing misunderstanding may cause builds to start prematurely

**Required Work:**
- 1 day: Fix critical SSR config and build isolation issues
- 1 day: Remove API duplication and add error boundaries
- 1 day: Write tests for race conditions and SSR externalization

**Estimated Time to Ship-Ready:** 3 days

### Architecture Quality: C+

**Strengths:**
- Clean plugin separation
- Valid use of Vite's Plugin[] pattern
- Good platform abstraction

**Weaknesses:**
- Missing shared context/hooks
- Contradictory configuration
- No error resilience
- API duplication creates confusion

### Compared to Nitro/Nuxt: 6/10

Nitro has:
- Better build isolation
- Shared context with hooks
- Single clear API
- Better error handling

Springboard has:
- Simpler API surface
- Clearer platform concept
- More straightforward virtual modules

---

## Sources & References

**Vite Plugin Documentation:**
- [Using Plugins | Vite](https://vite.dev/guide/using-plugins)
- [Plugin API | Vite](https://vite.dev/guide/api-plugin)

**Hook Timing:**
- [RFC: Sequential support for writeBundle closeBundle](https://github.com/vitejs/vite/discussions/13175)
- [How to execute a plugin after assets are fully generated?](https://github.com/vitejs/vite/discussions/11043)
- [buildEnd and closeBundle hooks](https://github.com/vitejs/vite/discussions/8293)
- [Plugin Development | Rollup](https://rollupjs.org/plugin-development/)

**Industry Patterns:**
- [Nuxt Configuration v4](https://nuxt.com/docs/4.x/api/nuxt-config)
- [Nitro · Nuxt Kit v4](https://nuxt.com/docs/4.x/api/kit/nitro)
- [Building for the Edge - Crafting a Next-Gen Framework](https://gitnation.com/contents/building-for-the-edge-crafting-a-next-gen-framework)

---

**End of Review**
