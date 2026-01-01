# Vite Plugin Migration Plan

## Goal
Move the working Vite implementation from `test-apps/esbuild-legacy-test/` to the published `packages/springboard/vite-plugin/` package.

## Current State

### Test App Location (Source)
- **Plugin**: `test-apps/esbuild-legacy-test/springboard-vite-plugin.ts`
- **Templates**: `test-apps/esbuild-legacy-test/virtual-entries/`
  - `dev-entry.template.ts` - Browser dev mode entry (connects to node server)
  - `build-entry.template.ts` - Browser build mode entry (offline/mock)
  - `node-entry.template.ts` - Node server entry with HMR support
  - `index.template.html` - HTML template

### Published Package Location (Target)
- **Structure**: `packages/springboard/vite-plugin/`
  - `src/index.ts` - Main entry, exports plugin array
  - `src/plugins/dev.ts` - Dev server plugin (needs major updates)
  - `src/plugins/build.ts` - Build orchestration
  - `src/plugins/init.ts` - Initialization
  - `src/plugins/virtual.ts` - Virtual module handling
  - `src/plugins/platform-inject.ts` - Platform transform
  - `src/plugins/html.ts` - HTML generation
  - `src/types.ts` - Type definitions
  - `src/utils/generate-entry.ts` - Entry generation utilities
  - Other utilities and config files

## Key Differences

### 1. Architecture
- **Test app**: Single monolithic plugin file (~320 lines)
- **Published package**: Multi-plugin architecture with separation of concerns

### 2. Node Server Strategy
- **Test app**: Uses `createServerModuleRunner` + HMR with lifecycle exports
- **Published package**: Currently uses watch builds for server platforms (outdated)

### 3. Template Management
- **Test app**: Physical template files, simple string replacement
- **Published package**: Has `generateEntryCode()` utility but may need template files

## Migration Tasks

### Phase 1: Add Template Files
**Location**: `packages/springboard/vite-plugin/src/templates/`

1. **Create templates directory**
   ```
   packages/springboard/vite-plugin/src/templates/
   ├── browser-dev-entry.template.ts
   ├── browser-build-entry.template.ts
   ├── node-entry.template.ts
   └── index.template.html
   ```

2. **Copy template files**
   - Copy `dev-entry.template.ts` → `browser-dev-entry.template.ts`
   - Copy `build-entry.template.ts` → `browser-build-entry.template.ts`
   - Copy `node-entry.template.ts` → `node-entry.template.ts`
   - Copy `index.template.html` → `index.template.html`

3. **Update template placeholders**
   - Ensure all templates use `__USER_ENTRY__` placeholder
   - Verify HTML template uses `{{TITLE}}` and `{{DESCRIPTION_META}}` placeholders

### Phase 2: Update Dev Plugin
**File**: `packages/springboard/vite-plugin/src/plugins/dev.ts`

Current approach (watch builds) needs to be replaced with ModuleRunner approach:

1. **Add ModuleRunner imports**
   ```typescript
   import { createServerModuleRunner, ModuleRunner } from 'vite';
   ```

2. **Replace watch build logic with ModuleRunner**
   - Remove `startWatchBuilds()` function
   - Remove `activeWatchers` tracking
   - Add ModuleRunner-based node server startup

3. **Implement server lifecycle management**
   - Add `startNodeServer()` function using `createServerModuleRunner()`
   - Add `stopNodeServer()` function with proper cleanup
   - Store reference to runner and node entry module
   - Call `nodeEntryModule.stop()` before `runner.close()`

4. **Update configureServer hook**
   - Generate node entry file from template
   - Start node server via ModuleRunner
   - Configure proxy settings for /rpc, /kv, /ws routes
   - Add cleanup on server close

5. **Key implementation details**
   - Generated node entry must be `.ts` not `.js` (for TypeScript syntax support)
   - Use lifecycle exports (`start()`, `stop()`) instead of IIFE
   - Let `import.meta.hot.dispose()` handle HMR cleanup
   - Manual cleanup needed for Vite config changes

### Phase 3: Update Entry Generation
**File**: `packages/springboard/vite-plugin/src/utils/generate-entry.ts`

1. **Add template loading**
   - Load template files using `readFileSync`
   - Cache templates in module scope
   - Provide functions to load each template

2. **Update entry generation functions**
   - `generateBrowserDevEntry()` - loads and processes browser-dev template
   - `generateBrowserBuildEntry()` - loads and processes browser-build template
   - `generateNodeEntry()` - loads and processes node template
   - Replace `__USER_ENTRY__` with relative path to user entry

3. **Add HTML generation**
   - `generateHtml()` - loads and processes HTML template
   - Replace `{{TITLE}}` and `{{DESCRIPTION_META}}` placeholders

### Phase 4: Update Init Plugin
**File**: `packages/springboard/vite-plugin/src/plugins/init.ts`

1. **Update buildStart hook**
   - Create `.springboard/` directory if needed
   - Generate physical entry files based on platform
   - For browser: generate dev-entry.js and build-entry.js
   - For node: generate node-entry.ts (note: .ts extension)
   - Calculate relative paths correctly

2. **File naming**
   - Browser dev: `.springboard/dev-entry.js`
   - Browser build: `.springboard/build-entry.js`
   - Node: `.springboard/node-entry.ts` (TypeScript)

### Phase 5: Update Config Hook
**File**: `packages/springboard/vite-plugin/src/plugins/dev.ts` or new config plugin

1. **Add SSR configuration for node platform**
   ```typescript
   ssr: {
     noExternal: ['springboard'],
     external: ['better-sqlite3'],
   }
   ```

2. **Add proxy configuration for dev mode**
   ```typescript
   server: {
     proxy: {
       '/rpc': { target: `http://localhost:${nodePort}`, changeOrigin: true },
       '/kv': { target: `http://localhost:${nodePort}`, changeOrigin: true },
       '/ws': { target: `ws://localhost:${nodePort}`, ws: true, changeOrigin: true },
     }
   }
   ```

3. **Configure rollup options**
   - Set correct input file based on mode (dev vs build)
   - For node builds: use SSR mode

### Phase 6: Update Types
**File**: `packages/springboard/vite-plugin/src/types.ts`

1. **Add node server options**
   ```typescript
   export interface SpringboardOptions {
     // ... existing options
     nodeServerPort?: number;
   }
   ```

2. **Add internal types**
   ```typescript
   export interface NodeEntryModule {
     start?: () => Promise<void>;
     stop?: () => Promise<void>;
   }
   ```

### Phase 7: Clean Up
1. **Remove obsolete code**
   - Remove old watch build logic from dev plugin
   - Remove child process spawning code
   - Clean up unused imports

2. **Update package.json**
   - Ensure `vite` is a peer dependency with version `^6.0.0 || ^7.0.0`
   - Add any missing dependencies

3. **Update documentation**
   - Update README with new architecture
   - Document node server HMR behavior
   - Add migration guide from old approach

### Phase 8: Update Test App
**File**: `test-apps/esbuild-legacy-test/vite.config.ts`

1. **Remove local plugin**
   - Delete `springboard-vite-plugin.ts`
   - Delete `virtual-entries/` directory

2. **Use published plugin**
   ```typescript
   import { springboard } from 'springboard/vite-plugin';

   export default defineConfig({
     plugins: springboard({
       entry: './src/tic_tac_toe.tsx',
       platforms: ['browser', 'node'],
       nodeServerPort: 3001,
     }),
   });
   ```

3. **Test everything**
   - Dev mode: `npm run dev`
   - HMR: Edit source files, verify server restarts
   - Config changes: Edit vite.config.ts, verify no port conflicts
   - Build mode: `npm run build`
   - Ctrl-C: Verify clean shutdown

## Technical Considerations

### Node Entry Template Structure
```typescript
// Lifecycle exports (not IIFE)
let server: Server | null = null;

export async function start() {
  // Create dependencies
  // Initialize app
  // Start HTTP server
  // Inject WebSocket
  // Start Springboard engine
}

export async function stop() {
  // Gracefully close server with timeout
  // Return promise that resolves when closed
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    await stop();
  });
}
```

### Important Implementation Notes

1. **File extensions matter**
   - Node entry MUST be `.ts` for TypeScript syntax support
   - Browser entries can be `.js` (no TypeScript syntax)

2. **ModuleRunner API (Vite 6+)**
   - Use `createServerModuleRunner(server.environments.ssr)`
   - Use `runner.import(url)` not `runtime.executeEntrypoint(url)`
   - Use `runner.close()` not `runtime.destroy()`
   - Store module reference for manual `stop()` calls

3. **Cleanup on Vite restart**
   - HMR dispose doesn't fire on config changes
   - Must manually call `nodeEntryModule.stop()` in plugin cleanup
   - Then call `runner.close()`

4. **SSR configuration**
   - `noExternal: ['springboard']` fixes missing .js extensions
   - Only externalize true native modules (e.g., better-sqlite3)

## Success Criteria

- ✅ Single `vite dev` command starts both browser and node server
- ✅ HMR works for both browser and node code
- ✅ Editing source files restarts node server automatically
- ✅ Editing vite.config.ts doesn't cause port conflicts
- ✅ Ctrl-C cleanly shuts down without hanging
- ✅ Build mode works for both platforms
- ✅ Test app uses published plugin, not local copy
- ✅ No TypeScript errors
- ✅ No runtime errors

## Files to Create/Modify

### Create New Files
- `packages/springboard/vite-plugin/src/templates/browser-dev-entry.template.ts`
- `packages/springboard/vite-plugin/src/templates/browser-build-entry.template.ts`
- `packages/springboard/vite-plugin/src/templates/node-entry.template.ts`
- `packages/springboard/vite-plugin/src/templates/index.template.html`

### Modify Existing Files
- `packages/springboard/vite-plugin/src/plugins/dev.ts` - Major refactor
- `packages/springboard/vite-plugin/src/plugins/init.ts` - Update entry generation
- `packages/springboard/vite-plugin/src/utils/generate-entry.ts` - Add template loading
- `packages/springboard/vite-plugin/src/types.ts` - Add types
- `packages/springboard/vite-plugin/package.json` - Update dependencies

### Delete Files (After Migration)
- `test-apps/esbuild-legacy-test/springboard-vite-plugin.ts`
- `test-apps/esbuild-legacy-test/virtual-entries/` (entire directory)

## Risk Mitigation

1. **Keep test app working during migration**
   - Don't delete local plugin until published version works
   - Can run both in parallel for comparison

2. **Version compatibility**
   - Vite 6+ required for ModuleRunner API
   - Document version requirements clearly

3. **Breaking changes**
   - This is a major architectural change
   - May require semver major bump
   - Update migration guide

## Next Steps

Start with Phase 1 (template files) and work through sequentially. Test after each phase to catch issues early.
