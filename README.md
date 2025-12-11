# Springboard

**Full-stack JavaScript framework for real-time, multi-platform applications.**

---

## v1.0 - Vite & Consolidated Packages

Springboard v1.0 introduces a major architectural overhaul:

- **Vite-based build system** - True HMR, faster builds, modern tooling
- **Consolidated packages** - Single `springboard` package replaces 14+ separate packages
- **Clean break** - No backward compatibility with v0.x

**Migrating from v0.x?** See the [Migration Guide](./MIGRATION_GUIDE.md).

---

## Quick Start

### Create a New Project

```bash
npx create-springboard-app my-app
cd my-app
npm install
npm run dev
```

### Or with JamTools template

```bash
npx create-springboard-app --template jamtools my-jamtools-app
```

---

## Installation

```bash
# Install the framework
npm install springboard

# Install CLI (for development)
npm install -D springboard-cli
```

---

## Usage

### Basic Application

```typescript
// src/index.tsx
import springboard from 'springboard';

// Register a module
springboard.registerModule('my-app', (moduleAPI) => {
  // Define routes
  moduleAPI.registerRoute('/', () => ({
    component: () => <h1>Hello, Springboard!</h1>,
  }));
});
```

### With Server

```typescript
// Server-side code
import createServer from 'springboard/server';
import springboard from 'springboard';

// Server will be started automatically by the CLI
```

### Platform-Specific Imports

```typescript
// Browser platform
import { BrowserKVStore } from 'springboard/platforms/browser';

// Node platform
import { NodeKVStore } from 'springboard/platforms/node';

// Tauri (desktop)
import { TauriMaestroEntrypoint } from 'springboard/platforms/tauri';

// PartyKit (edge)
import { PartykitRpcClient } from 'springboard/platforms/partykit';

// React Native
import { RNKVStore } from 'springboard/platforms/react-native';
```

---

## CLI Commands

### Development

```bash
# Start dev server with HMR
sb dev src/index.tsx

# With custom port
sb dev src/index.tsx --port 3000
```

### Production Build

```bash
# Build main platforms (browser + node + server)
sb build src/index.tsx --platforms main

# Build specific platform
sb build src/index.tsx --platforms browser
sb build src/index.tsx --platforms node
sb build src/index.tsx --platforms desktop
sb build src/index.tsx --platforms partykit

# Build all platforms
sb build src/index.tsx --platforms all
```

### Start Production Server

```bash
sb start
```

---

## Supported Platforms

| Platform | Description | Build Flag |
|----------|-------------|------------|
| **Browser** | Standard web browser | `--platforms browser` |
| **Browser Offline** | Offline-capable PWA | `--platforms browser_offline` |
| **Node** | Node.js runtime | `--platforms node` |
| **Desktop** | Tauri desktop app | `--platforms desktop` |
| **PartyKit** | Edge runtime (Cloudflare) | `--platforms partykit` |
| **Mobile** | React Native | `--platforms mobile` |

---

## Package Structure

Springboard v1.0 uses a consolidated package with subpath exports:

```typescript
// Core
import springboard from 'springboard';
import { ModuleAPI, useMount } from 'springboard';

// Server
import createServer from 'springboard/server';

// Platforms
import { ... } from 'springboard/platforms/browser';
import { ... } from 'springboard/platforms/node';
import { ... } from 'springboard/platforms/tauri';
import { ... } from 'springboard/platforms/partykit';
import { ... } from 'springboard/platforms/react-native';

// Core submodules
import { ... } from 'springboard/core';
```

See [Package Structure](./docs/PACKAGE_STRUCTURE.md) for detailed documentation.

---

## Documentation

- [Migration Guide](./MIGRATION_GUIDE.md) - Migrate from v0.x to v1.0
- [Vite Integration](./docs/VITE_INTEGRATION.md) - Build system architecture
- [Package Structure](./docs/PACKAGE_STRUCTURE.md) - Export map and imports
- [Changelog](./CHANGELOG.md) - Version history

---

## Architecture

```
+------------------+
|   Application    |
|  (your modules)  |
+--------+---------+
         |
+--------v---------+
|   Springboard    |
|     (core)       |
+--------+---------+
         |
    +----+----+----+----+
    |    |    |    |    |
+---v--+ +--v-+ +--v-+ +--v--+
|Browser| |Node| |Edge| |Desktop|
+------+ +----+ +----+ +------+
```

### Key Concepts

- **Modules**: Self-contained units of functionality
- **Routes**: URL-based navigation
- **Services**: Shared functionality (KV store, RPC, file storage)
- **Platforms**: Runtime-specific adapters

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## License

ISC

---

## Links

- [Documentation](https://jam.tools/docs/springboard)
- [GitHub](https://github.com/jamtools/springboard)
- [npm](https://www.npmjs.com/package/springboard)
- [Discord](https://discord.gg/jamtools)
