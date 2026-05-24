# esbuild Legacy Test App

**Status**: Active Test Suite
**Purpose**: Validates that the legacy esbuild-based build workflow continues to work after package consolidation
**Target Application**: SongDrive (ffmpeg-songdrive)

---

## Table of Contents

- [Purpose](#purpose)
- [What It Tests](#what-it-tests)
- [Project Structure](#project-structure)
- [Platform-Agnostic Development](#platform-agnostic-development)
  - [How It Works](#how-it-works)
  - [Why Platform-Agnostic Matters](#why-platform-agnostic-matters)
  - [Platform-Specific Code Handling](#platform-specific-code-handling)
  - [Comparison to SongDrive](#comparison-to-songdrive)
- [Usage](#usage)
  - [Automated Testing](#automated-testing)
  - [Manual Testing](#manual-testing)
  - [Expected Output](#expected-output)
- [Migration Insights for SongDrive](#migration-insights-for-songdrive)
  - [Option 1: Keep Using Legacy CLI (Low Effort)](#option-1-keep-using-legacy-cli-low-effort)
  - [Option 2: Migrate to New Vite CLI (Recommended Long-term)](#option-2-migrate-to-new-vite-cli-recommended-long-term)
- [Key Differences](#key-differences)
- [Files to Reference](#files-to-reference)
- [Troubleshooting](#troubleshooting)

---

## Purpose

This test application validates that **SongDrive's current build pattern will continue to work** after the Springboard package consolidation. It specifically tests:

1. **Backward Compatibility**: The legacy CLI API (buildApplication, platformBrowserBuildConfig) was preserved from the main branch
2. **Package Publishing**: The consolidated `springboard` package can be published with TypeScript source files
3. **Import Resolution**: Subpath imports like `springboard/legacy-cli` work correctly
4. **Multi-Platform Builds**: Both browser and node platforms build successfully from a single platform-agnostic source file
5. **Real-World Pattern**: Uses a proper Springboard module (tic-tac-toe game) that demonstrates how real apps should be structured

### Why This Exists

When consolidating packages, the new Vite-based CLI replaced the old esbuild-based CLI. However, SongDrive (and potentially other applications) rely on the legacy API. This test app:

- Proves the legacy API still works via `springboard/legacy-cli`
- Validates the package can be consumed from a registry (Verdaccio)
- Documents the migration path for existing applications
- Serves as a reference implementation for SongDrive developers
- Demonstrates platform-agnostic development patterns using a real Springboard module

---

## What It Tests

| Feature | Status | Description |
|---------|--------|-------------|
| Legacy CLI API | ✅ Validated | `buildApplication()` function from `springboard/legacy-cli` |
| Platform Configs | ✅ Validated | `platformBrowserBuildConfig` and `platformNodeBuildConfig` |
| esbuild Plugins | ✅ Validated | Platform injection, HTML generation, build timing |
| TypeScript Source | ✅ Validated | Package published with .ts files (not pre-compiled) |
| Subpath Exports | ✅ Validated | `import { } from 'springboard/legacy-cli'` works |
| Multi-Platform | ✅ Validated | Builds both browser and node from same platform-agnostic source |
| Verdaccio Publishing | ✅ Validated | Package can be published and consumed locally |
| External Dependencies | ✅ Validated | React and React DOM externalize correctly |
| Platform-Agnostic Code | ✅ Validated | Single source file works for all platforms (tic-tac-toe app) |
| Springboard Module API | ✅ Validated | Uses registerModule, state management, actions, routing |

### What This Does NOT Test

- The new Vite-based CLI API (tested in `test-apps/vite-multi-platform/`)
- SongDrive-specific features (Sentry, custom HTML processing, etc.)
- All 7 platform targets (only tests browser + node)
- Production optimizations and minification
- Watch mode with HMR (hot module replacement)
- Custom esbuild plugins from SongDrive (application-specific)

---

## Project Structure

```
test-apps/esbuild-legacy-test/
├── .npmrc                          # Verdaccio registry configuration
├── pnpm-workspace.yaml             # Isolated workspace (prevents hoisting from monorepo)
├── package.json                    # Dependencies and build scripts
├── tsconfig.json                   # TypeScript configuration
├── esbuild.ts                      # Build script using legacy CLI API
├── src/
│   ├── tic_tac_toe.tsx             # Platform-agnostic Springboard module (entry point)
│   └── tic_tac_toe.css             # Styles for tic-tac-toe game
├── public/
│   └── index.html                  # HTML template for browser builds
├── scripts/
│   └── test-legacy-esbuild.sh     # Automated Verdaccio test workflow
└── README.md                       # This file
```

### File Descriptions

**Configuration Files:**
- `.npmrc` - Points to Verdaccio registry at localhost:4873
- `pnpm-workspace.yaml` - Creates isolated workspace (single package)
- `package.json` - Minimal dependencies: react, react-dom, esbuild, tsx, typescript
- `tsconfig.json` - Standard TypeScript config for browser + node targets

**Source Files:**
- `src/tic_tac_toe.tsx` - **Platform-agnostic Springboard module**
  - Single entry point for both browser and node platforms
  - Uses `springboard.registerModule()` API
  - Implements state management with persistent states
  - Includes actions for game logic
  - Registers routes with document metadata
  - Demonstrates proper Springboard patterns (like SongDrive)
- `src/tic_tac_toe.css` - Styles for the tic-tac-toe game board
- `public/index.html` - HTML template with root div and module script

**Build Files:**
- `esbuild.ts` - **Most Important**: Demonstrates exact SongDrive pattern
  - Imports from `springboard/legacy-cli`
  - Uses `buildApplication()` function
  - Configures browser and node platforms using the same source file
  - Externalizes dependencies
  - Provides custom esbuild options

**Test Automation:**
- `scripts/test-legacy-esbuild.sh` - Complete end-to-end test
  - Starts Verdaccio
  - Builds springboard package
  - Publishes to local registry
  - Installs dependencies
  - Runs esbuild build
  - Verifies output files
  - Cleans up processes

---

## Platform-Agnostic Development

This test app demonstrates the **recommended Springboard development pattern** where a single platform-agnostic source file serves as the entry point for all platforms. This matches how SongDrive and other production Springboard applications should be structured.

### How It Works

**Single Source, Multiple Platforms:**
```typescript
// src/tic_tac_toe.tsx - Works for browser AND node platforms
import springboard from 'springboard';

springboard.registerModule('TicTacToe', {}, async (moduleAPI) => {
  // State management - works on all platforms
  const boardState = await moduleAPI.statesAPI.createPersistentState('board', initialBoard);

  // Actions - works on all platforms
  const actions = moduleAPI.createActions({
    clickedCell: async (args) => { /* game logic */ }
  });

  // Routes - works on all platforms
  moduleAPI.registerRoute('/', {}, () => <TicTacToeBoard {...props} />);
});
```

**Build Configuration:**
```typescript
// esbuild.ts - Both platforms use the SAME entry point
await buildApplication(platformBrowserBuildConfig, {
  applicationEntrypoint: './src/tic_tac_toe.tsx', // Platform-agnostic
  // ...
});

await buildApplication(platformNodeBuildConfig, {
  applicationEntrypoint: './src/tic_tac_toe.tsx', // Same file!
  // ...
});
```

### Why Platform-Agnostic Matters

**Traditional Approach (Discouraged):**
```
src/
├── browser/
│   └── index.tsx    # Browser-specific code
└── node/
    └── index.ts     # Node-specific code
```

Problems:
- Code duplication across platforms
- Different behavior between platforms
- Harder to maintain and test
- Not how real Springboard apps work

**Springboard Approach (Recommended):**
```
src/
└── tic_tac_toe.tsx  # Platform-agnostic, works everywhere
```

Benefits:
- Single source of truth
- Consistent behavior across platforms
- Framework handles platform differences via `@platform` directives
- Matches SongDrive's production patterns
- Easier testing and maintenance

### Platform-Specific Code Handling

When platform-specific code is needed, Springboard handles it internally:

```typescript
// The framework automatically injects the correct platform implementation
import springboard from 'springboard'; // @platform directive handles this

// Your code stays platform-agnostic
springboard.registerModule('MyApp', {}, async (moduleAPI) => {
  // moduleAPI works the same on browser and node
  // The framework provides the right implementation for each platform
});
```

The legacy CLI's esbuild plugins inject the correct platform-specific Springboard runtime during the build process, so your application code doesn't need to know which platform it's running on.

### Comparison to SongDrive

This pattern is exactly how SongDrive should be structured:

| Aspect | Tic-Tac-Toe Test App | SongDrive |
|--------|---------------------|-----------|
| **Entry Point** | `src/tic_tac_toe.tsx` | `src/song_drive.tsx` (example) |
| **Module Registration** | `springboard.registerModule('TicTacToe', ...)` | `springboard.registerModule('SongDrive', ...)` |
| **State Management** | Persistent states for board, winner, score | Persistent states for songs, playlists, settings |
| **Actions** | `clickedCell`, `onNewGame` | `playSong`, `createPlaylist`, etc. |
| **Routes** | Single route `/` with tic-tac-toe UI | Multiple routes `/songs`, `/playlists`, etc. |
| **Platform Handling** | Framework handles browser/node differences | Framework handles browser/node/mobile/desktop |

---

## Usage

### Automated Testing (Recommended)

The automated test script runs the complete Verdaccio workflow:

```bash
cd test-apps/esbuild-legacy-test
./scripts/test-legacy-esbuild.sh
```

**What it does:**

1. **Validates environment** - Checks Node.js, pnpm, repository structure
2. **Starts Verdaccio** - Local npm registry on port 4873
3. **Builds Springboard** - Runs `scripts/build-for-publish.ts` from repo root
4. **Publishes package** - Publishes to Verdaccio registry
5. **Installs dependencies** - Fresh install from Verdaccio
6. **Runs build** - Executes `pnpm build` (tsx esbuild.ts)
7. **Verifies output** - Checks that all expected files exist
8. **Cleanup** - Stops Verdaccio and restores files

**Expected duration:** 30-60 seconds (first run), 15-30 seconds (subsequent runs)

### Manual Testing

If you want to test the build script independently:

#### 1. Install Dependencies

```bash
cd test-apps/esbuild-legacy-test
pnpm install
```

#### 2. Run Build

```bash
# Single build
pnpm build

# Watch mode (rebuilds on file changes)
pnpm build:watch
```

#### 3. Test Node Output

```bash
node dist/node/dist/index.js
```

You should see platform information and success messages.

### Expected Output

After a successful build, you should have:

```
dist/
├── browser/
│   └── dist/
│       ├── index.html          # Generated HTML with metadata
│       ├── index.js            # Bundled browser application
│       └── index.js.map        # Source map (if enabled)
└── node/
    └── dist/
        ├── index.js            # Bundled node application
        └── index.js.map        # Source map (if enabled)
```

**File Characteristics:**

- **Browser bundle** (~50-200KB): Contains bundled React code, externalizes react and react-dom
- **Node bundle** (~5-20KB): Small because springboard is externalized
- **HTML file**: Generated with document metadata injected
- **Source maps**: Enable debugging back to original TypeScript source

**Validation Checks:**

- Files exist and are not empty
- Browser bundle references external React
- Node bundle can execute: `node dist/node/dist/index.js`
- HTML contains title and meta tags from config
- TypeScript compiled without errors

---

## Migration Insights for SongDrive

SongDrive currently uses the legacy esbuild-based CLI API. After package consolidation, there are **two migration paths**:

### Option 1: Keep Using Legacy CLI (Low Effort)

**Overview:** Continue using the existing `buildApplication()` API with minimal changes.

**What Changed:**
```typescript
// OLD (before package consolidation):
import {
  buildApplication,
  platformBrowserBuildConfig,
  platformNodeBuildConfig,
} from 'springboard-cli/src/build';

// NEW (after package consolidation):
import {
  buildApplication,
  platformBrowserBuildConfig,
  platformNodeBuildConfig,
} from 'springboard/legacy-cli';
```

**Migration Steps:**

1. **Update imports** in all `esbuild.ts` files:
   - Change `springboard-cli/src/build` → `springboard/legacy-cli`
   - Update package.json to use consolidated `springboard` package

2. **No other changes required**:
   - All existing esbuild.ts files work as-is
   - Same API signatures
   - Same configuration options
   - Same esbuild plugins available

3. **Test each platform** to ensure builds work:
   - Browser (online)
   - Browser (offline/PWA)
   - Mobile (Capacitor)
   - Desktop (Tauri webview + maestro)
   - PartyKit (server + browser)
   - Node

**Pros:**
- ✅ Minimal code changes (just import paths)
- ✅ All existing build configurations work
- ✅ No need to learn new tooling
- ✅ Custom esbuild plugins continue working
- ✅ Can migrate incrementally (one platform at a time)
- ✅ Fast implementation (< 1 day)

**Cons:**
- ⚠️ Using deprecated API (will be removed in future major version)
- ⚠️ Missing modern Vite ecosystem benefits
- ⚠️ No built-in HMR (hot module replacement)
- ⚠️ Slower development builds compared to Vite
- ⚠️ More manual configuration required

**When to Use:**
- You need to ship quickly and can't invest time in migration
- You have complex custom esbuild plugins
- You're familiar with the current build system
- You plan to migrate to Vite later when time permits

**Reference Implementation:**
See `test-apps/esbuild-legacy-test/esbuild.ts` for a working example.

---

### Option 2: Migrate to New Vite CLI (Recommended Long-term)

**Overview:** Switch to the modern Vite-based build system with better developer experience.

**What Changed:**
```typescript
// OLD (esbuild-based):
import { buildApplication, platformBrowserBuildConfig } from 'springboard/legacy-cli';

await buildApplication(
  platformBrowserBuildConfig,
  {
    applicationEntrypoint: './src/main.tsx',
    documentMeta: { title: 'My App' },
    editBuildOptions: (options) => {
      options.external = ['react', 'react-dom'];
    }
  }
);

// NEW (Vite-based):
// vite.config.ts
import { defineConfig } from 'vite';
import springboard from 'springboard/vite-plugin';

export default defineConfig({
  plugins: [springboard()],
  build: {
    rollupOptions: {
      external: ['react', 'react-dom']
    }
  }
});
```

**Migration Steps:**

1. **Create Vite configuration** for each platform
2. **Update build scripts** to use new CLI:
   ```typescript
   import { buildPlatform, buildAllPlatforms } from 'springboard';

   // Build single platform
   await buildPlatform('browser', { mode: 'production' });

   // Build all platforms
   await buildAllPlatforms({ mode: 'production' });
   ```

3. **Migrate custom plugins** from esbuild to Vite format
4. **Update HTML templates** to work with Vite's injection system
5. **Test thoroughly** - Vite has different bundling behavior

**Pros:**
- ✅ Modern developer experience with instant HMR
- ✅ Faster development builds (3-5x faster)
- ✅ Access to Vite plugin ecosystem
- ✅ Better aligned with Springboard's future direction
- ✅ Simpler configuration (less boilerplate)
- ✅ Better error messages and debugging
- ✅ Built-in optimizations (code splitting, tree shaking)

**Cons:**
- ⚠️ Requires significant refactoring (1-2 weeks)
- ⚠️ Need to learn Vite patterns and configuration
- ⚠️ Custom esbuild plugins need conversion to Vite plugins
- ⚠️ Different bundling behavior (may expose edge cases)
- ⚠️ Requires testing all platforms thoroughly

**When to Use:**
- You have time to invest in proper migration
- You want to leverage modern tooling
- You value fast development feedback loops
- You're building new features and want better DX
- You plan to maintain the codebase long-term

**Reference Implementation:**
See `test-apps/vite-multi-platform/` for a working example.

---

## Key Differences

### Legacy CLI vs New CLI

| Aspect | Legacy CLI (Option 1) | New CLI (Option 2) |
|--------|----------------------|-------------------|
| **Build Tool** | esbuild | Vite (esbuild + Rollup) |
| **Import Path** | `springboard/legacy-cli` | `springboard` |
| **Main Function** | `buildApplication()` | `buildPlatform()` or `buildAllPlatforms()` |
| **Configuration** | Function parameters | `vite.config.ts` files |
| **Dev Server** | None (manual setup) | Built-in with HMR |
| **Plugins** | esbuild plugins | Vite plugins |
| **Build Speed (dev)** | ~3-5 seconds | ~500ms-1s (instant HMR) |
| **Build Speed (prod)** | ~5-10 seconds | ~10-15 seconds |
| **Status** | Deprecated | Active development |
| **Future Support** | Until next major version | Long-term support |

### Configuration Comparison

**Legacy CLI (esbuild.ts):**
```typescript
import {
  buildApplication,
  platformBrowserBuildConfig,
  platformNodeBuildConfig,
} from 'springboard/legacy-cli';

// Browser build - uses platform-agnostic source
await buildApplication(
  {
    ...platformBrowserBuildConfig,
    additionalFiles: {},
  },
  {
    applicationEntrypoint: './src/tic_tac_toe.tsx', // Platform-agnostic!
    nodeModulesParentFolder: process.cwd(),
    documentMeta: {
      title: 'Tic Tac Toe',
      description: 'A tic-tac-toe game',
    },
    editBuildOptions: (options) => {
      options.external = ['react', 'react-dom'];
    },
  }
);

// Node build - same source file!
await buildApplication(
  {
    ...platformNodeBuildConfig,
    additionalFiles: {},
  },
  {
    applicationEntrypoint: './src/tic_tac_toe.tsx', // Same file!
    nodeModulesParentFolder: process.cwd(),
    editBuildOptions: (options) => {
      options.external = ['springboard'];
    },
  }
);
```

**New CLI (vite.config.ts):**
```typescript
import { defineConfig } from 'vite';
import springboard from 'springboard/vite-plugin';

export default defineConfig({
  plugins: [springboard()],
  build: {
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
```

**Key Takeaways:**
- New CLI has less boilerplate
- Configuration is more declarative
- Vite config is more standard (familiar to React/Vue developers)
- Legacy CLI gives more low-level control over esbuild

---

## Files to Reference

### This Repository

- **Implementation Guide**: `/ESBUILD_LEGACY_TEST_IMPLEMENTATION.md` (repo root)
  - Step-by-step instructions for creating this test app
  - Background on why legacy CLI was preserved
  - Details on copying files from main branch

- **Legacy CLI Source**: `/packages/springboard/src/legacy-cli/`
  - `README.md` - Legacy CLI documentation
  - `build.ts` - Core build functions (buildApplication, buildServer)
  - `esbuild-plugins/` - Platform injection, HTML generation, etc.
  - `index.ts` - Public API exports

- **This Test App**: `/test-apps/esbuild-legacy-test/`
  - `esbuild.ts` - **Most important reference for SongDrive**
  - `package.json` - Minimal dependencies
  - `scripts/test-legacy-esbuild.sh` - Complete test workflow

- **New Vite CLI (for comparison)**:
  - `/packages/springboard/cli/` - New Vite-based CLI
  - `/test-apps/vite-multi-platform/` - Vite test app

### External References

- **SongDrive Repository**: Check `esbuild.ts` files in ffmpeg-songdrive
  - Browser platform build configuration
  - Node platform build configuration
  - Custom Sentry integration plugin
  - HTML post-processing customizations

---

## Troubleshooting

### Build Fails: "Cannot find module 'springboard/legacy-cli'"

**Cause:** Package not installed or wrong version

**Solution:**
```bash
# Check if springboard is installed
ls node_modules/springboard

# Check package version
node -e "console.log(require('./node_modules/springboard/package.json').version)"

# Reinstall from Verdaccio
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build Fails: "Legacy CLI exports not found"

**Cause:** Subpath exports not working (likely TypeScript/bundler issue)

**Solution:**
```typescript
// Try full import path instead of subpath
import {
  buildApplication,
  platformBrowserBuildConfig,
} from 'springboard/legacy-cli';

// If that doesn't work, try direct path (not recommended):
import { buildApplication } from 'springboard/src/legacy-cli/build';
```

### TypeScript Errors: "Cannot find type definitions"

**Cause:** Missing type definitions

**Solution:**
```bash
# Install React types
pnpm add -D @types/react @types/react-dom @types/node

# Check tsconfig.json has correct settings
cat tsconfig.json
```

### Verdaccio Fails to Start

**Cause:** Port 4873 already in use

**Solution:**
```bash
# Find and kill process on port 4873
lsof -ti:4873 | xargs kill -9

# Or restart the test script (it kills existing processes)
./scripts/test-legacy-esbuild.sh
```

### Build Output is Empty or Tiny

**Cause:** Entry point not found or bundling failed

**Solution:**
```bash
# Check that entry point exists
ls src/tic_tac_toe.tsx

# Check build logs for errors
pnpm build 2>&1 | tee build.log
cat build.log

# Verify esbuild.ts has correct paths
grep applicationEntrypoint esbuild.ts
```

### "external" Dependencies Still Bundled

**Cause:** External configuration not applied

**Solution:**
```typescript
// In esbuild.ts, ensure editBuildOptions is called:
editBuildOptions: (buildOptions) => {
  buildOptions.external = buildOptions.external || [];
  buildOptions.external.push('react', 'react-dom');

  // Debug: log final config
  console.log('External deps:', buildOptions.external);
}
```

### Node Build Fails to Execute

**Cause:** Missing runtime dependencies or wrong target

**Solution:**
```bash
# Check if springboard is externalized (should be)
grep "external.*springboard" esbuild.ts

# Try running with more verbose output
node --trace-warnings dist/node/dist/index.js

# Check Node version
node --version  # Should be >= 20.0.0
```

### Watch Mode Not Working

**Cause:** Watch mode may have issues with symlinks or fast file systems

**Solution:**
```bash
# Try without watch mode first
pnpm build

# If watch is needed, ensure polling is enabled
# (This is platform-specific and may need esbuild config changes)
```

### "Module not found" Errors at Runtime

**Cause:** Dependencies marked as external but not installed at runtime

**Solution:**
```bash
# For browser builds, ensure externals are loaded separately
# (e.g., via CDN or separate bundle)

# For node builds, ensure dependencies are in package.json
cat package.json | grep dependencies
```

---

## Success Criteria

This test is considered successful when:

- ✅ `./scripts/test-legacy-esbuild.sh` completes without errors
- ✅ Browser output exists at `dist/browser/dist/index.js` and is > 10KB
- ✅ Node output exists at `dist/node/dist/index.js` and is > 1KB
- ✅ HTML file generated with correct metadata
- ✅ Node build executes: `node dist/node/dist/index.js` (no errors)
- ✅ No TypeScript compilation errors
- ✅ Package installed from Verdaccio (not symlinked from workspace)
- ✅ Source maps generated (if enabled)

---

## Next Steps for SongDrive

1. **Review this test app** to understand the legacy CLI pattern
2. **Choose migration path**:
   - **Option 1 (quick)**: Update imports to `springboard/legacy-cli`
   - **Option 2 (long-term)**: Plan Vite migration over 1-2 sprints
3. **Test with one platform first** (e.g., browser-online)
4. **Validate SongDrive-specific features**:
   - Sentry integration
   - HTML post-processing
   - Custom esbuild plugins
   - Multi-platform builds
5. **Document any issues** and report to Springboard team
6. **Roll out to remaining platforms** once first platform is stable

---

## Learn More

- **Springboard Vite Plugin**: [test-apps/vite-multi-platform/README.md](../vite-multi-platform/README.md)
- **Legacy CLI Source**: [packages/springboard/src/legacy-cli/README.md](../../packages/springboard/src/legacy-cli/README.md)
- **Package Structure**: [packages/springboard/package.json](../../packages/springboard/package.json)
- **Build Script**: [scripts/build-for-publish.ts](../../scripts/build-for-publish.ts)
- **Implementation Guide**: [ESBUILD_LEGACY_TEST_IMPLEMENTATION.md](../../ESBUILD_LEGACY_TEST_IMPLEMENTATION.md)

---

**Last Updated**: 2025-12-28
**Maintained By**: Springboard Team
**Status**: Active - Ready for SongDrive Migration Testing
