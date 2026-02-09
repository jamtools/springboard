# Springboard Overview

Springboard is a full-stack JavaScript framework for building real-time, multi-device applications. Built on React, Hono, JSON-RPC, and WebSockets.

## Core Philosophy

"Your codebase should only be feature-level code" - Springboard abstracts infrastructure so you focus on features.

## Key Features

- **Multi-platform**: Browser, Node.js, Desktop (Tauri), React Native, PartyKit
- **Real-time sync**: State automatically syncs across connected devices
- **Module-based**: Organize code into isolated, reusable modules
- **RPC built-in**: Actions automatically work across client/server
- **Type-safe**: Full TypeScript support with module interface merging

## Architecture

```
┌─────────────────────────────────────────┐
│           Your Modules                   │
│  (Feature, Utility, Initializer)        │
├─────────────────────────────────────────┤
│           ModuleAPI                      │
│  (States, Actions, Routes, Lifecycle)   │
├─────────────────────────────────────────┤
│        Springboard Engine               │
│  (RPC, State Sync, Module Registry)     │
├─────────────────────────────────────────┤
│          Platform Layer                  │
│  (Browser, Node, Desktop, Mobile)       │
└─────────────────────────────────────────┘
```

## Basic Module Structure

```typescript
import springboard from 'springboard';

springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // 1. Create state
  const state = await moduleAPI.statesAPI.createSharedState('data', initialValue);

  // 2. Create actions
  const actions = moduleAPI.createActions({
    doSomething: async (args) => { /* ... */ }
  });

  // 3. Register routes
  moduleAPI.registerRoute('/', {}, MyComponent);

  // 4. Return public API
  return { state, actions };
});
```

## When to Use Springboard

- Real-time collaborative apps
- Multi-device synchronized experiences
- Apps needing offline-first capabilities
- Full-stack apps with shared business logic
