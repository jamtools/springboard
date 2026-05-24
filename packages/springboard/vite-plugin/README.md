# @springboard/vite-plugin

Vite plugin for building Springboard applications across multiple platforms (browser, Node.js, PartyKit, Tauri, React Native).

## Requirements

- **Vite 6.0+** (or Vite 7.0+) - Required for ModuleRunner API support
- Node.js 18+

## Basic Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { springboard } from 'springboard/vite-plugin';

export default defineConfig({
  plugins: springboard({
    entry: './src/app.tsx',
    platforms: ['browser', 'node'],
  }),
});
```

## Configuration Options

```typescript
interface SpringboardOptions {
  // Entry point for your application
  entry: string;

  // Target platforms to build for
  platforms: Platform[];

  // Port for node server in dev mode (default: 3001)
  nodeServerPort?: number;

  // Document metadata for HTML generation
  documentMeta?: {
    title?: string;
    description?: string;
  };

  // PartyKit project name (for partykit platform)
  partykitName?: string;

  // Output directory (default: 'dist')
  outDir?: string;

  // Enable debug logging
  debug?: boolean;
}

type Platform = 'browser' | 'node' | 'partykit' | 'tauri' | 'react-native';
```

## Architecture

### ModuleRunner (Vite 6+)

This plugin uses Vite's **ModuleRunner API** for development server functionality. The ModuleRunner enables:

- **Hot Module Replacement (HMR)** for Node.js server code
- **Automatic server restarts** when source files change
- **Unified development experience** - single `vite dev` command runs both browser and node servers
- **Proper cleanup** on shutdown and config changes

### Multi-Platform Development

When developing with both browser and node platforms:

1. **Browser Dev Server**: Runs on Vite's default port (usually 5173)
2. **Node Server**: Runs on the configured `nodeServerPort` (default: 3001)
3. **Automatic Proxy**: The plugin configures Vite to proxy `/rpc`, `/kv`, and `/ws` routes from the browser server to the node server

Example with custom node server port:

```typescript
export default defineConfig({
  plugins: springboard({
    entry: './src/app.tsx',
    platforms: ['browser', 'node'],
    nodeServerPort: 4000, // Node server will run on port 4000
  }),
});
```

### Entry Point Generation

The plugin automatically generates platform-specific entry files in a `.springboard/` directory:

- **Browser Dev**: `.springboard/dev-entry.js` - Connects to node server via WebSocket for HMR
- **Browser Build**: `.springboard/build-entry.js` - Offline mode with mock services
- **Node**: `.springboard/node-entry.ts` - Server entry with lifecycle management

These files are generated from templates and inject your application entry point.

### Node Server Lifecycle

The generated node entry exports lifecycle functions for proper server management:

```typescript
// Simplified structure of generated node-entry.ts
export async function start() {
  // Initialize dependencies
  // Create HTTP server
  // Start Springboard engine
}

export async function stop() {
  // Gracefully shut down server
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(async () => {
    await stop();
  });
}
```

## Development Workflow

### Start Development Server

```bash
vite dev
```

This single command:
- Starts the Vite dev server for browser code
- Starts the Node.js server via ModuleRunner (if node platform is configured)
- Configures proxy routes automatically
- Enables HMR for both browser and server code

### Build for Production

```bash
vite build
```

Builds all configured platforms sequentially:
- Each platform gets its own output directory under `dist/`
- Browser: `dist/browser/`
- Node: `dist/node/`
- PartyKit: `dist/partykit/server/`

### Hot Module Replacement

- **Browser code changes**: Standard Vite HMR applies updates instantly
- **Node server code changes**: Server automatically restarts via ModuleRunner
- **Vite config changes**: Plugin ensures clean shutdown before restart (no port conflicts)

## Platform-Specific Configuration

### Browser

Builds standard ES modules optimized for modern browsers:

```typescript
{
  platforms: ['browser'],
  documentMeta: {
    title: 'My Springboard App',
    description: 'A modern web application',
  },
}
```

### Node.js

Builds for Node.js 18+ with proper externalization:

```typescript
{
  platforms: ['node'],
  nodeServerPort: 3001,
}
```

The plugin automatically:
- Externalizes Node.js built-ins
- Configures SSR mode
- Sets up proper module resolution

### PartyKit

Builds for PartyKit edge runtime:

```typescript
{
  platforms: ['partykit'],
  partykitName: 'my-app',
}
```

Generates `partykit.json` configuration automatically.

### Multi-Platform

Build for multiple platforms simultaneously:

```typescript
{
  platforms: ['browser', 'node'],
  nodeServerPort: 3001,
}
```

## Debugging

Enable debug logging to see detailed plugin operations:

```typescript
export default defineConfig({
  plugins: springboard({
    entry: './src/app.tsx',
    platforms: ['browser', 'node'],
    debug: true,
  }),
});
```

## Migration from Older Versions

### From Watch Builds to ModuleRunner

Previous versions used watch builds for the node platform. The new ModuleRunner approach:

- **Eliminates child processes** - No more spawning separate processes
- **Improves HMR** - Changes apply faster with better error reporting
- **Cleaner shutdown** - No port conflicts or hanging processes
- **Requires Vite 6+** - ModuleRunner API introduced in Vite 6

If you're upgrading, ensure your project uses Vite 6 or later.

## Troubleshooting

### Port Already in Use

If the node server port is already in use:

1. Change the `nodeServerPort` option
2. Or stop the process using that port
3. The plugin will show an error if the port is unavailable

### Module Resolution Errors

If you see errors about missing `.js` extensions:

- The plugin configures `ssr.noExternal: ['springboard']` automatically
- Check that your imports use proper ESM syntax
- Verify TypeScript `moduleResolution` is set to `bundler` or `node16`

### HMR Not Working

If HMR isn't triggering for node server changes:

1. Check that you're running `vite dev` (not `vite build`)
2. Verify the node platform is included in `platforms` array
3. Enable `debug: true` to see HMR events in console

## License

ISC
