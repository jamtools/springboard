# Core Dependencies

Every module has access to `CoreDependencies` via `moduleAPI.deps.core`.

## Overview

```typescript
type CoreDependencies = {
  log: (...args: any[]) => void;
  showError: (error: string) => void;
  files: {
    saveFile: (name: string, content: string) => Promise<void>;
  };
  storage: {
    remote: KVStore;      // Server/shared storage
    userAgent: KVStore;   // Local device storage
  };
  rpc: {
    remote: Rpc;          // Server communication
    local?: Rpc;          // Local RPC (on maestro)
  };
  isMaestro: () => boolean;
};
```

## Logging

### log
```typescript
moduleAPI.deps.core.log('Message', { data: 'value' });
```
Logs to console with module prefix. Use for debugging.

### showError
```typescript
moduleAPI.deps.core.showError('Something went wrong');
```
Shows error to user (toast notification). Use for user-facing errors.

```typescript
const actions = moduleAPI.createActions({
  saveDocument: async (args) => {
    try {
      await save(args);
    } catch (error) {
      moduleAPI.deps.core.showError(`Save failed: ${error.message}`);
      throw error;
    }
  }
});
```

## File Operations

### saveFile
```typescript
await moduleAPI.deps.core.files.saveFile('export.json', JSON.stringify(data));
```
Triggers file download in browser, writes to disk in Node.

## Storage (KVStore)

Low-level key-value storage. Prefer `createPersistentState` for most cases.

### KVStore Interface
```typescript
type KVStore = {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  getAll: () => Promise<Record<string, any> | null>;
};
```

### Remote Storage
```typescript
const { remote } = moduleAPI.deps.core.storage;

// Stored on server, shared across devices
await remote.set('settings', { theme: 'dark' });
const settings = await remote.get<Settings>('settings');
```

### UserAgent Storage
```typescript
const { userAgent } = moduleAPI.deps.core.storage;

// Stored locally (localStorage in browser)
await userAgent.set('recentSearches', ['query1', 'query2']);
const searches = await userAgent.get<string[]>('recentSearches');
```

## RPC (Remote Procedure Call)

Low-level RPC access. Usually not needed (use `createActions` instead).

### Rpc Interface
```typescript
type Rpc = {
  callRpc: <Args, Return>(name: string, args: Args) => Promise<Return>;
  broadcastRpc: <Args>(name: string, args: Args) => Promise<void>;
  registerRpc: <Args, Return>(name: string, cb: (args: Args) => Promise<Return>) => void;
  role: 'server' | 'client';
};
```

### Example: Custom RPC
```typescript
const { rpc } = moduleAPI.deps.core;

// Register handler (on server)
rpc.remote.registerRpc('custom:ping', async (args: { message: string }) => {
  return { pong: args.message };
});

// Call from client
const result = await rpc.remote.callRpc('custom:ping', { message: 'hello' });
console.log(result.pong); // 'hello'
```

## isMaestro

Checks if running on the authoritative device (server).

```typescript
if (moduleAPI.deps.core.isMaestro()) {
  // Running on server - do authoritative work
  await syncWithExternalAPI();
} else {
  // Running on client
}
```

**Use cases:**
- Server-only initialization
- Authoritative game logic
- Scheduled tasks

## Module Dependencies (modDeps)

Access via `moduleAPI.deps.module`:

```typescript
type ModuleDependencies = {
  moduleRegistry: ModuleRegistry;
  toast: (options: ToastOptions) => void;
  rpc: { remote: Rpc; local?: Rpc };
  services: {
    remoteSharedStateService: SharedStateService;
    localSharedStateService: SharedStateService;
  };
};
```

### Toast Notifications
```typescript
moduleAPI.deps.module.toast({
  target: 'all',          // 'all' | 'self' | 'others'
  message: 'Hello!',
  variant: 'info',        // 'info' | 'success' | 'warning' | 'error'
  flash: false,           // Brief highlight
  persistent: false       // Stays until dismissed
});
```

## Best Practices

1. **Prefer high-level APIs**: Use `createActions` over raw RPC
2. **Use showError for users**: Don't just log errors silently
3. **Check isMaestro for server logic**: Keep authoritative code on server
4. **Use state APIs over storage**: `createPersistentState` handles sync automatically
