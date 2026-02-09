# Anti-Patterns to Avoid

Common mistakes when developing Springboard modules.

## Module Level getModule

### ❌ Problem
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // DON'T: Called during registration, other module might not exist yet
  const auth = moduleAPI.getModule('auth');
  const user = auth.userState.getState(); // May crash or return undefined

  moduleAPI.registerRoute('/', {}, () => <div>{user?.name}</div>);
});
```

### ✅ Solution
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  moduleAPI.registerRoute('/', {}, () => {
    // DO: Called at render time, all modules registered
    const auth = moduleAPI.getModule('auth');
    const user = auth.userState.useState();

    return <div>{user?.name}</div>;
  });
});
```

## Missing Optional Chaining

### ❌ Problem
```typescript
const maybeModule = moduleAPI.getModule('optionalFeature');
maybeModule.actions.doSomething(); // Crashes if module doesn't exist
```

### ✅ Solution
```typescript
const maybeModule = moduleAPI.getModule('optionalFeature');
maybeModule?.actions?.doSomething(); // Safe

// Or with explicit check
if (maybeModule) {
  await maybeModule.actions.doSomething();
}
```

## Direct State Mutation

### ❌ Problem
```typescript
const items = itemsState.getState();
items.push(newItem); // Mutating directly - won't trigger updates
itemsState.setState(items); // Same reference, may not trigger re-render
```

### ✅ Solution
```typescript
// Option 1: Immutable update
itemsState.setState([...items, newItem]);

// Option 2: setStateImmer (recommended)
itemsState.setStateImmer(draft => {
  draft.push(newItem);
});
```

## Computed Values in State

### ❌ Problem
```typescript
const [items, setItems] = useState([]);
const [filteredItems, setFilteredItems] = useState([]); // Derived state

useEffect(() => {
  setFilteredItems(items.filter(i => i.active)); // Redundant state
}, [items]);
```

### ✅ Solution
```typescript
const items = itemsState.useState();

// Compute on each render, memoize if expensive
const filteredItems = useMemo(
  () => items.filter(i => i.active),
  [items]
);
```

## Race Conditions in Initialization

### ❌ Problem
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // These run in parallel - state2 might use state1 before it's ready
  const state1Promise = moduleAPI.statesAPI.createPersistentState('a', {});
  const state2Promise = moduleAPI.statesAPI.createPersistentState('b', {
    aRef: state1Promise.getState() // state1 not resolved yet!
  });
});
```

### ✅ Solution
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // Await in sequence if there are dependencies
  const state1 = await moduleAPI.statesAPI.createPersistentState('a', {});
  const state2 = await moduleAPI.statesAPI.createPersistentState('b', {
    aRef: state1.getState() // Safe - state1 is resolved
  });

  // Or use Promise.all if truly independent
  const [stateA, stateB] = await Promise.all([
    moduleAPI.statesAPI.createPersistentState('a', {}),
    moduleAPI.statesAPI.createPersistentState('b', {})
  ]);
});
```

## Missing Cleanup

### ❌ Problem
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  const subscription = someObservable.subscribe(handleChange);
  // Subscription never cleaned up - memory leak!

  setInterval(pollData, 5000);
  // Interval never cleared - runs forever!
});
```

### ✅ Solution
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  const subscription = someObservable.subscribe(handleChange);
  moduleAPI.onDestroy(() => subscription.unsubscribe());

  const intervalId = setInterval(pollData, 5000);
  moduleAPI.onDestroy(() => clearInterval(intervalId));
});
```

## Wrong State Type Choice

### ❌ Problem
```typescript
// Using SharedState for data that should persist
const userPrefs = await moduleAPI.statesAPI.createSharedState('prefs', {
  theme: 'light'
});
// Lost on server restart!

// Using PersistentState for ephemeral UI state
const isModalOpen = await moduleAPI.statesAPI.createPersistentState('modal', false);
// Unnecessary database writes!
```

### ✅ Solution
```typescript
// Persistent for data that should survive restarts
const userPrefs = await moduleAPI.statesAPI.createPersistentState('prefs', {
  theme: 'light'
});

// UserAgent for local UI state
const isModalOpen = await moduleAPI.statesAPI.createUserAgentState('modal', false);

// Shared for real-time sync without persistence
const cursorPosition = await moduleAPI.statesAPI.createSharedState('cursor', null);
```

## Blocking Actions

### ❌ Problem
```typescript
const actions = moduleAPI.createActions({
  processLargeData: async (args: { data: BigData }) => {
    // Blocks UI for entire processing time
    for (const item of args.data.items) {
      await heavyProcessing(item);
    }
  }
});
```

### ✅ Solution
```typescript
const actions = moduleAPI.createActions({
  processLargeData: async (args: { data: BigData }) => {
    // Process in chunks, yield to UI
    const chunks = chunkArray(args.data.items, 100);

    for (const chunk of chunks) {
      await Promise.all(chunk.map(heavyProcessing));
      // Allow UI to update
      await new Promise(r => setTimeout(r, 0));
      progressState.setStateImmer(d => { d.processed += chunk.length; });
    }
  }
});
```

## Sync getModule in Render

### ❌ Problem
```typescript
function MyComponent() {
  // Called on every render - inefficient
  const otherModule = moduleAPI.getModule('other');
  const data = otherModule.state.useState();

  return <div>{data}</div>;
}
```

### ✅ Solution
```typescript
// Get module reference once
const otherModule = moduleAPI.getModule('other');

function MyComponent() {
  // Just use the state hook
  const data = otherModule.state.useState();
  return <div>{data}</div>;
}

// Or if conditional:
function MyComponent() {
  const otherModule = useMemo(() => moduleAPI.getModule('other'), []);
  const data = otherModule?.state?.useState() ?? defaultValue;
  return <div>{data}</div>;
}
```

## Summary Checklist

Before completing a module:

- [ ] No `getModule` calls at module registration level
- [ ] All optional modules accessed with `?.`
- [ ] State updated via `setState` or `setStateImmer`, never mutated directly
- [ ] No derived state stored - use `useMemo` instead
- [ ] All subscriptions cleaned up in `onDestroy`
- [ ] All timers/intervals cleared in `onDestroy`
- [ ] Correct state type chosen (Shared/Persistent/UserAgent)
- [ ] Heavy operations chunked or run in background
