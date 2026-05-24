# springboard

Full-stack JavaScript framework for real-time, multi-platform applications.

---

## Installation

```bash
npm install springboard
```

For development tooling:

```bash
npm install -D springboard-cli
```

---

## Overview

Springboard is a modular, real-time framework that enables building applications that run across multiple platforms:

- **Browser** - Standard web applications
- **Node.js** - Server-side applications
- **Desktop** - Tauri-based desktop apps
- **Edge** - PartyKit/Cloudflare Workers
- **Mobile** - React Native (experimental)

---

## Quick Start

### Basic Application

```typescript
// src/index.tsx
import springboard from 'springboard';

springboard.registerModule('my-app', (moduleAPI) => {
  moduleAPI.registerRoute('/', () => ({
    component: () => <h1>Hello, Springboard!</h1>,
  }));
});
```

### Run Development Server

```bash
sb dev src/index.tsx
```

### Build for Production

```bash
sb build src/index.tsx --platforms main
```

---

## Imports

### Main Entry Point

```typescript
import springboard from 'springboard';

// Or with named exports
import {
  springboard,
  Springboard,
  SpringboardProvider,
  SpringboardProviderPure,
  useSpringboardEngine,
  ModuleAPI,
  ModuleRegistry,
  useMount,
  generateId,
  SharedStateService,
  HttpKvStoreClient,
  BaseModule,
  FilesModule,
  IndexedDBFileStorageProvider,
  makeMockCoreDependencies,
} from 'springboard';
```

### Server

```typescript
import createServer from 'springboard/server';

// Named exports
import {
  createHonoApp,
  ServerJsonRpc,
  injectMetadata,
} from 'springboard/server';
```

### Browser Platform

```typescript
import {
  BrowserKVStore,
  BrowserJsonRpc,
} from 'springboard/platforms/browser';
```

### Node Platform

```typescript
import {
  NodeKVStore,
  NodeJsonRpc,
  NodeFileStorage,
  NodeRpcAsyncLocalStorage,
} from 'springboard/platforms/node';
```

### Tauri Platform

```typescript
import {
  TauriMaestroEntrypoint,
} from 'springboard/platforms/tauri';
```

### PartyKit Platform

```typescript
import {
  PartykitKVStore,
  PartykitRpcClient,
  PartykitRpcServer,
  createPartykitHonoApp,
} from 'springboard/platforms/partykit';
```

### React Native Platform

```typescript
import {
  RNKVStore,
  RNWebViewBridge,
  RNWebViewLocalTokenService,
} from 'springboard/platforms/react-native';
```

### Core Submodules

```typescript
import { ModuleAPI } from 'springboard/core/engine/module_api';
import { SharedStateService } from 'springboard/core/services/states/shared_state_service';
import { generateId } from 'springboard/core/utils/generate_id';
```

---

## Types

```typescript
import type {
  // Core types
  CoreDependencies,
  ModuleDependencies,
  KVStore,
  Rpc,
  RpcArgs,
  FileStorageProvider,

  // Registry types
  SpringboardRegistry,
  RegisterModuleOptions,
  ModuleCallback,
  ClassModuleCallback,
  DocumentMetaFunction,
  RegisterRouteOptions,

  // Module types
  Module,
  ExtraModuleDependencies,
  DocumentMeta,

  // File types
  FileHandle,
  FileMetadata,

  // Response types
  ErrorResponse,
  SuccessResponse,
  SpringboardResponse,
} from 'springboard';
```

---

## Peer Dependencies

Springboard requires the following peer dependencies based on your usage:

### Core (Required)

```bash
npm install react react-dom
```

### Browser Apps

```bash
npm install react-router
```

### Server

```bash
npm install hono @hono/node-server @hono/node-ws
```

### Desktop (Tauri)

```bash
npm install @tauri-apps/api @tauri-apps/plugin-shell
```

### Edge (PartyKit)

```bash
npm install partysocket hono
```

---

## CLI Commands

```bash
# Development server with HMR
sb dev src/index.tsx

# Production build
sb build src/index.tsx --platforms main

# Build specific platforms
sb build src/index.tsx --platforms browser
sb build src/index.tsx --platforms browser_offline
sb build src/index.tsx --platforms node
sb build src/index.tsx --platforms desktop
sb build src/index.tsx --platforms partykit
sb build src/index.tsx --platforms all

# Start production server
sb start
```

---

## Documentation

- [Migration Guide](../../MIGRATION_GUIDE.md) - Migrate from v0.x
- [Vite Integration](../../docs/VITE_INTEGRATION.md) - Build system architecture
- [Package Structure](../../docs/PACKAGE_STRUCTURE.md) - Export map documentation

---

## License

ISC

---

## Links

- [GitHub](https://github.com/jamtools/springboard)
- [npm](https://www.npmjs.com/package/springboard)
- [Documentation](https://jam.tools/docs/springboard)
