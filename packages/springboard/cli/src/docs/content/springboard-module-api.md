# ModuleAPI Reference

The `ModuleAPI` is the primary interface for module development. Received as parameter in `registerModule` callback.

## Properties

```typescript
moduleAPI.moduleId        // string - Unique module identifier
moduleAPI.fullPrefix      // string - Namespaced prefix
moduleAPI.statesAPI       // StatesAPI - State management
moduleAPI.deps.core       // CoreDependencies
moduleAPI.deps.module     // ModuleDependencies
```

## State Management

### createSharedState
```typescript
const state = await moduleAPI.statesAPI.createSharedState<T>(name: string, initial: T)
```
Cross-device synchronized state. Use for real-time features.

### createPersistentState
```typescript
const state = await moduleAPI.statesAPI.createPersistentState<T>(name: string, initial: T)
```
Database-backed state. Survives restarts, syncs across devices.

### createUserAgentState
```typescript
const state = await moduleAPI.statesAPI.createUserAgentState<T>(name: string, initial: T)
```
Local-only state (localStorage). Device-specific preferences.

### StateSupervisor Methods
```typescript
state.getState()                    // Get current value
state.setState(newValue)            // Set new value
state.setState(prev => newValue)    // Set with callback
state.setStateImmer(draft => {})    // Mutate with Immer
state.useState()                    // React hook
state.subject                       // RxJS Subject
```

## Actions

### createActions
```typescript
const actions = moduleAPI.createActions({
  actionName: async (args: Args) => {
    // Automatically RPC-enabled
    return result;
  }
});
```

### createAction (single)
```typescript
const action = moduleAPI.createAction('name', {}, async (args) => result);
```

### Action Options
```typescript
// Force local execution (skip RPC)
await actions.doSomething(args, { mode: 'local' });

// Force remote execution
await actions.doSomething(args, { mode: 'remote' });
```

## Routing

### registerRoute
```typescript
moduleAPI.registerRoute(path, options, Component);

// Examples:
moduleAPI.registerRoute('/', {}, HomePage);           // Absolute: /
moduleAPI.registerRoute('items/:id', {}, ItemPage);   // Relative: /modules/MyModule/items/:id
moduleAPI.registerRoute('/admin', {                   // Absolute with options
  hideApplicationShell: true,
  documentMeta: { title: 'Admin' }
}, AdminPage);
```

### Route Options
```typescript
type RegisterRouteOptions = {
  hideApplicationShell?: boolean;  // Hide app shell
  documentMeta?: {
    title?: string;
    description?: string;
    'og:image'?: string;
    // ... SEO metadata
  };
}
```

### registerApplicationShell
```typescript
moduleAPI.registerApplicationShell(({ children, modules }) => (
  <Layout>{children}</Layout>
));
```

## Module Communication

### getModule
```typescript
const otherModule = moduleAPI.getModule('OtherModuleId');
await otherModule.actions.doSomething();
```

**Important**: Call inside routes/actions, not at module level.

## Lifecycle

### onDestroy
```typescript
moduleAPI.onDestroy(() => {
  // Cleanup subscriptions, timers, etc.
  subscription.unsubscribe();
});
```

## RPC Mode

### setRpcMode
```typescript
moduleAPI.setRpcMode('local');  // All actions run locally
moduleAPI.setRpcMode('remote'); // All actions use RPC (default)
```
