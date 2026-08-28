# Module Lifecycle

Understanding when modules initialize and how to clean up resources.

## Initialization Order

```
1. Springboard Engine created
2. RPC connections established
3. SharedStateServices initialized
4. Modules registered (in import order):
   a. Module object created
   b. ModuleAPI instantiated
   c. registerModule callback executed
   d. Module added to registry
5. React app renders
6. Module Providers stacked
7. Routes become active
```

## Registration Phase

```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // This runs during registration (step 4c)
  // - RPC is available
  // - Other modules may not be registered yet

  const state = await moduleAPI.statesAPI.createSharedState('data', {});

  moduleAPI.registerRoute('/', {}, () => {
    // This runs during render (step 7)
    // - All modules are registered
    // - Safe to call getModule
    return <div>Hello</div>;
  });

  return { state };
});
```

## onDestroy - Cleanup

Register cleanup callbacks with `moduleAPI.onDestroy()`:

```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // Create subscription
  const subscription = someObservable.subscribe(handleChange);

  // Create interval
  const intervalId = setInterval(checkUpdates, 5000);

  // Register cleanup
  moduleAPI.onDestroy(() => {
    subscription.unsubscribe();
    clearInterval(intervalId);
  });
});
```

### When onDestroy Runs

- Module is explicitly destroyed
- App is unmounting
- Hot module replacement (development)

### Multiple Cleanup Callbacks

```typescript
moduleAPI.onDestroy(() => {
  console.log('Cleanup 1');
});

moduleAPI.onDestroy(() => {
  console.log('Cleanup 2');
});
// Both will be called
```

## Common Cleanup Scenarios

### RxJS Subscriptions
```typescript
const sub = state.subject.subscribe(handleChange);
moduleAPI.onDestroy(() => sub.unsubscribe());
```

### Event Listeners
```typescript
window.addEventListener('resize', handleResize);
moduleAPI.onDestroy(() => {
  window.removeEventListener('resize', handleResize);
});
```

### Timers
```typescript
const timerId = setInterval(poll, 1000);
moduleAPI.onDestroy(() => clearInterval(timerId));
```

### WebSocket Connections
```typescript
const ws = new WebSocket(url);
moduleAPI.onDestroy(() => ws.close());
```

### Third-Party Library Cleanup
```typescript
const chart = new Chart(canvas, config);
moduleAPI.onDestroy(() => chart.destroy());
```

## Provider Pattern

Each module can have a React Provider:

```typescript
springboard.registerClassModule(async (coreDeps, modDeps) => {
  const MyContext = createContext<MyState | null>(null);

  return {
    moduleId: 'myModule',
    Provider: ({ children }) => {
      const [state, setState] = useState(initialState);
      return (
        <MyContext.Provider value={{ state, setState }}>
          {children}
        </MyContext.Provider>
      );
    }
  };
});
```

Providers are stacked in registration order:
```
<Module1Provider>
  <Module2Provider>
    <Module3Provider>
      <Routes />
    </Module3Provider>
  </Module2Provider>
</Module1Provider>
```

## Splash Screen

Register a loading screen shown during initialization:

```typescript
springboard.registerSplashScreen(() => (
  <div className="loading">
    <Spinner />
    <p>Loading...</p>
  </div>
));
```

Shown until all modules are registered and initial state is loaded.

## Async Initialization

Module registration callbacks can be async:

```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // Await initial data
  const initialData = await fetchInitialData();

  const state = await moduleAPI.statesAPI.createPersistentState(
    'data',
    initialData
  );

  // Module isn't "ready" until this callback completes
  return { state };
});
```

## Best Practices

1. **Always clean up subscriptions**: Use `onDestroy` for every subscription
2. **Don't call getModule during registration**: Wait for routes/actions
3. **Keep registration fast**: Defer heavy work to actions or effects
4. **Use splash screen**: Show loading state during async init
5. **Import order matters**: Dependencies before dependents
