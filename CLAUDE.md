# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jam Tools is a music performance system built on Springboard, a full-stack JavaScript framework. Springboard emphasizes realtime communication via WebSockets/JSON-RPC, side effect imports with dependency injection, and multi-platform deployment from a single codebase.

## Repository Structure

This is a pnpm monorepo with two main package families:

- **`packages/springboard/`**: The Springboard framework itself
  - `core/`: Core framework (modules, engine, services, hooks, types)
  - `cli/`: CLI tool for building and running apps (`sb` command)
  - `server/`: Server-side runtime (Hono-based WebSocket server)
  - `platforms/`: Platform-specific implementations (browser, node, partykit, tauri, react-native)
  - `data_storage/`: Key-value store implementations (SQLite/Kysely-based)
  - `plugins/`: Framework plugins

- **`packages/jamtools/`**: Jam Tools application code
  - `core/`: MIDI, music-related core functionality
  - `features/`: Feature modules

- **`apps/`**: Application entry points
  - `jamtools/`: Main Jam Tools application
  - `small_apps/`: Test and example applications

## Common Commands

### Development
```bash
pnpm dev                    # Run dev server for main app
pnpm dev-without-node       # Run dev excluding Node.js app
npm run dev-dev --prefix packages/springboard/cli  # CLI dev mode
```

### Building
```bash
pnpm build                  # Build all packages
pnpm build-saas            # Production build for SaaS deployment
turbo run build            # Build using Turbo
```

### Testing
```bash
pnpm test                   # Run all tests
pnpm test:watch            # Run tests in watch mode
vitest --run               # Run tests in a specific package
```

Individual package tests:
```bash
cd packages/springboard/core && pnpm test
cd packages/jamtools/core && pnpm test:watch
```

### Linting and Type Checking
```bash
pnpm lint                   # Lint all packages
pnpm fix                   # Auto-fix lint issues
pnpm check-types           # Type check all packages
turbo run check-types      # Type check using Turbo
```

### CI Pipeline
```bash
pnpm ci                    # Run full CI: lint, check-types, build, test
```

### Springboard CLI
```bash
npx tsx packages/springboard/cli/src/cli.ts dev <entrypoint>
npx tsx packages/springboard/cli/src/cli.ts build <entrypoint> --platforms <platform>
```

Platforms: `browser`, `browser_offline`, `desktop` (Tauri), `partykit`, `all`

## Architecture

### Module System

Springboard uses a module registration pattern. Modules are registered via side effect imports:

```typescript
import springboard from 'springboard';

springboard.registerModule('ModuleName', {}, async (moduleAPI) => {
  // Module initialization logic
  // Use moduleAPI to register routes, actions, states, etc.
});
```

**Key APIs:**
- `moduleAPI.registerRoute(path, options, component)` - Register React Router routes
- `moduleAPI.statesAPI` - Create shared/server/userAgent state pieces
- `moduleAPI.registerAction(name, callback)` - Register RPC actions
- `moduleAPI.registerNavigationItem(config)` - Add navigation items

### State Management

Springboard provides three types of state:

1. **Shared State** (`SharedStateService`): Synchronized across all clients and server
2. **Server State** (`ServerStateService`): Server-only state, read-only from clients
3. **User Agent State**: Client-local persistent state

States are managed through supervisors:
- `SharedStateSupervisor` - For shared state pieces
- `ServerStateSupervisor` - For server state pieces
- `UserAgentStateSupervisor` - For client-local state

### RPC Communication

Communication between client and server uses JSON-RPC over WebSockets. The framework provides:
- `Rpc` interface for calling/broadcasting/registering RPC methods
- Automatic reconnection handling
- Mode selection: `remote` (client-server) or `local` (same process)

### Build System

The CLI (`packages/springboard/cli`) uses esbuild with custom plugins:

- **`esbuild_plugin_platform_inject`**: Conditionally includes code based on `@platform` directives
- **`esbuild_plugin_html_generate`**: Generates HTML entry files
- **`esbuild_plugin_partykit_config`**: Creates PartyKit configuration

Platform-specific code blocks:
```typescript
// @platform "browser"
// Browser-only code
// @platform end

// @platform "node"
// Node-only code
// @platform end
```

### Multi-Platform Support

Single codebase deploys to multiple platforms:
- **Browser (online/offline)**: WebSocket-connected or standalone
- **Node**: Server-side runtime
- **Tauri**: Native desktop (maestro + webview bundles)
- **PartyKit**: Edge deployment
- **React Native**: Mobile (experimental)

### Testing

Tests use Vitest with:
- **Workspace configuration**: `vitest.workspace.ts` defines test projects
- **Per-package testing**: Each package has its own `vite.config.ts`
- **jsdom environment**: For React component testing
- **60s timeout**: `testTimeout: 1000 * 60`

### TypeScript Configuration

Each package has its own `tsconfig.json` (118 total). Root `tsconfig.json` provides shared configuration. Type checking is done per-package with `tsc --noEmit`.

## Development Workflow

1. **Install dependencies**: `pnpm install` (runs postinstall hook for springboard-cli setup)
2. **Start development**: `pnpm dev` or use CLI directly with `npx tsx`
3. **Make changes**: Edit source files (framework watches for changes in dev mode)
4. **Run tests**: `pnpm test` in specific package or root
5. **Type check**: `pnpm check-types`
6. **Lint**: `pnpm fix` to auto-fix issues
7. **Build**: `pnpm build` when ready for production

## Key Files

- `packages/springboard/core/engine/register.ts` - Module registration system
- `packages/springboard/core/engine/module_api.ts` - ModuleAPI implementation
- `packages/springboard/core/types/module_types.ts` - Core type definitions
- `packages/springboard/core/services/states/shared_state_service.ts` - State management
- `packages/springboard/cli/src/build.ts` - Build configuration and platform definitions
- `packages/springboard/server/src/hono_app.ts` - Server implementation
- `turbo.json` - Turborepo task configuration
- `pnpm-workspace.yaml` - Workspace package definitions

## Current Branch Context

Branch: `server-state` (PR typically targets `main`)

Recent work involves server state caching and KV storage improvements.
