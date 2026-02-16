# Actions & RPC

Actions are async functions that automatically work across client/server via RPC.

## Creating Actions

### createActions (recommended)
```typescript
const actions = moduleAPI.createActions({
  increment: async () => {
    const current = counter.getState();
    counter.setState(current + 1);
    return { newValue: current + 1 };
  },

  addItem: async (args: { text: string }) => {
    items.setStateImmer(draft => {
      draft.push({ id: uuid(), text: args.text });
    });
  },

  fetchData: async (args: { id: string }) => {
    const response = await fetch(`/api/data/${args.id}`);
    return response.json();
  }
});
```

### createAction (single action)
```typescript
const doSomething = moduleAPI.createAction(
  'doSomething',
  {},
  async (args: { value: number }) => {
    return args.value * 2;
  }
);
```

## How RPC Works

1. **Client calls action** → Serialized and sent via WebSocket
2. **Server receives** → Executes action callback
3. **Result returned** → Sent back to client

```typescript
// On browser (client)
const result = await actions.increment();
// ↓ RPC call to server
// ↓ Server executes increment()
// ↓ Result returned
console.log(result.newValue); // From server
```

## Execution Modes

### Default: Remote (RPC)
```typescript
await actions.doSomething(args); // Uses RPC
```

### Force Local Execution
```typescript
await actions.doSomething(args, { mode: 'local' });
```
Runs directly without RPC. Use for:
- Actions that only affect local state
- Performance-critical operations
- Offline mode

### Force Remote Execution
```typescript
await actions.doSomething(args, { mode: 'remote' });
```

### Module-Level RPC Mode
```typescript
// All actions in this module run locally
moduleAPI.setRpcMode('local');
```

## isMaestro Check

The "maestro" is the authoritative device (usually server).

```typescript
const actions = moduleAPI.createActions({
  syncData: async () => {
    if (moduleAPI.deps.core.isMaestro()) {
      // Running on server - do authoritative work
      return await fetchFromDatabase();
    } else {
      // Running on client - this shouldn't happen with default RPC
    }
  }
});
```

## Error Handling

```typescript
const actions = moduleAPI.createActions({
  riskyAction: async (args) => {
    try {
      return await doRiskyThing(args);
    } catch (error) {
      moduleAPI.deps.core.showError(`Failed: ${error.message}`);
      throw error; // Re-throw to inform caller
    }
  }
});
```

## Action Patterns

### Optimistic Updates
```typescript
const actions = moduleAPI.createActions({
  addTodo: async (args: { text: string }) => {
    const tempId = `temp-${Date.now()}`;

    // Optimistic update
    todos.setStateImmer(draft => {
      draft.push({ id: tempId, text: args.text, pending: true });
    });

    try {
      const realId = await saveTodoToServer(args.text);
      // Replace temp with real
      todos.setStateImmer(draft => {
        const item = draft.find(t => t.id === tempId);
        if (item) {
          item.id = realId;
          item.pending = false;
        }
      });
    } catch (error) {
      // Rollback
      todos.setStateImmer(draft => {
        const idx = draft.findIndex(t => t.id === tempId);
        if (idx >= 0) draft.splice(idx, 1);
      });
      throw error;
    }
  }
});
```

### Debounced Actions
```typescript
let saveTimeout: NodeJS.Timeout;

const actions = moduleAPI.createActions({
  saveDocument: async (args: { content: string }) => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await persistToDatabase(args.content);
    }, 1000);
  }
});
```

## Calling Actions from Components

```typescript
function MyComponent() {
  const handleClick = async () => {
    const result = await actions.doSomething({ value: 42 });
    console.log(result);
  };

  return <button onClick={handleClick}>Do Something</button>;
}
```
