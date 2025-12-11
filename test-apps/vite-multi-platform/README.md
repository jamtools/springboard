# Vite Multi-Platform Test Application

This is an **isolated** test application that demonstrates the correct Springboard pattern: write once, run on all platforms. It uses the new `springboard/vite-plugin` API.

## Purpose

This test app demonstrates:

1. **Single Entrypoint**: One `src/index.tsx` works on ALL platforms
2. **Springboard Vite Plugin**: Simple `vite.config.ts` using `springboard()` function
3. **Platform Agnostic Code**: No platform-specific files in `src/`
4. **Real App Patterns**: State management, actions, routing, and components

## Architecture

```
vite-multi-platform/
├── pnpm-workspace.yaml    # Isolated from parent workspace
├── package.json           # Minimal dependencies
├── .npmrc                 # Points to Verdaccio registry
├── vite.config.ts         # Uses springboard() plugin
├── tsconfig.json          # TypeScript configuration
└── src/
    └── index.tsx          # SINGLE ENTRYPOINT for all platforms
```

### Key Design Principles

**Write Once, Run Everywhere**

The app code in `src/index.tsx` is completely platform-agnostic:

```typescript
import springboard from 'springboard';

springboard.registerModule('MyApp', {}, async (moduleAPI) => {
  // Create state - works on browser, node, partykit, etc.
  const state = await moduleAPI.statesAPI.createPersistentState('data', initialValue);

  // Create actions - framework handles sync across platforms
  const actions = moduleAPI.createActions({
    doSomething: async () => { /* ... */ }
  });

  // Register routes - framework handles routing per platform
  moduleAPI.registerRoute('/', { documentMeta: async () => ({ title: 'My App' }) }, () => {
    return <MyComponent />;
  });
});
```

**Simple Vite Configuration**

```typescript
import { springboard } from 'springboard/vite-plugin';

export default springboard({
  entry: './src/index.tsx',
  platforms: ['browser', 'node', 'partykit'],
  documentMeta: {
    title: 'My App',
    description: 'Multi-platform app'
  }
});
```

That's it! The plugin handles:
- Platform detection
- Virtual entry generation
- Platform code injection
- Multi-platform builds
- HTML generation
- HMR setup
- SSR configuration

## Running the App

### Prerequisites

1. Node.js 20+
2. pnpm 9+
3. Verdaccio running with Springboard packages published

### Development

```bash
# Start Verdaccio and publish packages (from repo root)
docker compose -f verdaccio/docker-compose.yml up -d
./scripts/run-all-folders.sh 0.2.0 --mode verdaccio

# Install dependencies (in this directory)
cd test-apps/vite-multi-platform
pnpm install

# Start dev server
pnpm dev
```

### Production Build

```bash
# Build for all platforms
pnpm build

# Output:
# dist/browser/  - Browser build
# dist/node/     - Node.js server build
# dist/partykit/ - PartyKit/edge build
```

## App Features

The test app is a counter with these features:

- **Counter State**: Increment, decrement, reset
- **History Tracking**: Records all count changes
- **Theme Toggle**: Light/dark mode with persistence
- **Multiple Routes**: Home (`/`) and History (`/history`)
- **Document Meta**: Per-route title and description

## Comparison: Before vs After

### Before (Platform-Specific)

```
src/
├── browser/
│   └── main.tsx      # Browser-only code
├── server/
│   └── index.ts      # Server-only code
└── partykit/
    └── server.ts     # PartyKit-only code
```

### After (Platform-Agnostic)

```
src/
└── index.tsx         # Works on ALL platforms
```

## Testing

### Type Check

```bash
pnpm typecheck
```

### E2E Tests (Coming Soon)

```bash
pnpm test
```

## Related Documentation

- [VITE_PLUGIN_DESIGN.md](../../VITE_PLUGIN_DESIGN.md) - Plugin architecture
- [apps/small_apps/](../../apps/small_apps/) - More Springboard app examples
